import { Client } from '@notionhq/client';

if (!process.env.NOTION_API_KEY) {
  console.warn('NOTION_API_KEY is not set');
  // Return a mock client that will fail gracefully
}

export const notion = process.env.NOTION_API_KEY 
  ? new Client({
      auth: process.env.NOTION_API_KEY,
    })
  : null;

export interface NotionItem {
  id: string;
  title: string;
  year: string;
  description?: string;
  type: 'intro' | 'project' | 'outro';
  image: string;
  link?: string;
  size: '1x1' | '1x2' | '2x1' | '2x2';
  category?: string;
  sort?: number;
  isValid: boolean;
  validationError?: string;
}

export async function getDatabaseItems(): Promise<NotionItem[]> {
  if (!process.env.NOTION_DATABASE_ID) {
    console.warn('NOTION_DATABASE_ID is not set, returning empty array');
    return [];
  }

  try {
    if (!notion) {
      console.warn('Notion client not initialized');
      return [];
    }

    // Build query with filters and sorting
    const apiKey = process.env.NOTION_API_KEY!;
    const databaseId = process.env.NOTION_DATABASE_ID!;
    
    // Build request body with filter and sorting
    const requestBody: any = {
      filter: {
        property: 'Status',
        select: {
          equals: 'Live',
        },
      },
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'ascending',
        },
      ],
    };

    // Query database using direct HTTP request
    let response: Response;
    try {
      response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError: any) {
      console.error('Network error fetching from Notion API:', fetchError?.message || fetchError);
      return []; // Return empty array instead of crashing
    }

    if (!response.ok) {
      // Handle rate limiting (429) gracefully
      if (response.status === 429) {
        console.warn('Notion API rate limit exceeded (429). Returning empty array. Will retry on next revalidation.');
        return []; // Return empty array instead of crashing
      }

      let errorText: string;
      let errorData: any;
      try {
        errorText = await response.text();
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        console.error('Error parsing Notion API error response:', parseError);
        return []; // Return empty array if we can't parse the error
      }
      
      // If Status filter fails, try without filter
      if (errorData.code === 'validation_error' && errorData.message?.includes('Status')) {
        console.warn('Status filter failed, trying without filter:', errorData.message);
        let fallbackResponse: Response;
        try {
          fallbackResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sorts: requestBody.sorts,
            }),
          });
        } catch (fallbackFetchError: any) {
          console.error('Network error in fallback fetch:', fallbackFetchError?.message || fallbackFetchError);
          return []; // Return empty array instead of crashing
        }
        
        if (!fallbackResponse.ok) {
          if (fallbackResponse.status === 429) {
            console.warn('Notion API rate limit exceeded (429) in fallback. Returning empty array.');
            return [];
          }
          console.error(`Notion API error in fallback: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
          return []; // Return empty array instead of crashing
        }
        
        let fallbackData: any;
        try {
          fallbackData = await fallbackResponse.json();
        } catch (fallbackParseError) {
          console.error('Error parsing fallback response:', fallbackParseError);
          return []; // Return empty array if we can't parse
        }
        
        const mappedItems = await Promise.all(
          fallbackData.results.map(async (page: any) => {
            const item = mapPageToItem(page);
            // Update Debug field in Notion
            if (!item.isValid && item.validationError) {
              await updateNotionDebugField(page.id, item.validationError).catch(() => {
                // Silently handle errors
              });
            } else {
              // Clear Debug field if item is valid
              await updateNotionDebugField(page.id, null).catch(() => {
                // Silently handle errors
              });
            }
            return item;
          })
        );
        return mappedItems;
      }
      
      // For other errors, log and return empty array
      console.error(`Notion API error: ${response.status} ${response.statusText}`, errorData);
      return []; // Return empty array instead of crashing
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Error parsing Notion API response:', parseError);
      return []; // Return empty array if we can't parse the response
    }

    const mappedItems = await Promise.all(
      data.results.map(async (page: any) => {
        const item = mapPageToItem(page);
        // Update Debug field in Notion
        if (!item.isValid && item.validationError) {
          await updateNotionDebugField(page.id, item.validationError).catch(() => {
            // Silently handle errors
          });
        } else {
          // Clear Debug field if item is valid
          await updateNotionDebugField(page.id, null).catch(() => {
            // Silently handle errors
          });
        }
        return item;
      })
    );

    return mappedItems;
  } catch (error: any) {
    console.error('Error fetching Notion database:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    return [];
  }
}

// Helper function to update Notion Debug field
async function updateNotionDebugField(pageId: string, errorMessage: string | null): Promise<void> {
  if (!notion) {
    console.warn('Notion client not initialized, cannot update Debug field');
    return;
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Debug: {
          rich_text: errorMessage 
            ? [{ text: { content: errorMessage } }]
            : []
        }
      }
    });
  } catch (error: any) {
    // Silently fail - Debug field update is not critical
    console.warn(`Failed to update Debug field for page ${pageId}:`, error?.message || error);
  }
}

// Helper function to map Notion page to our item format with validation
function mapPageToItem(page: any): NotionItem {
  const validationErrors: string[] = [];
  let isValid = true;

  try {
    const props = page.properties;

    // Extract title (Name property) - REQUIRED, cannot be empty or 'Untitled'
    let title = '';
    try {
      title = props.Name?.title?.[0]?.plain_text || '';
    } catch (error) {
      validationErrors.push('Title extraction failed');
      isValid = false;
    }

    if (!title || title.trim() === '' || title === 'Untitled') {
      validationErrors.push('Title is empty or "Untitled"');
      isValid = false;
    }

    // Extract year (Year property - can be text like "Trade | Research")
    let year = '';
    try {
      year = props.Year?.rich_text?.[0]?.plain_text || 
             props.Year?.title?.[0]?.plain_text || 
             '';
    } catch (error) {
      // Year is optional, so we don't fail validation
      year = '';
    }

    // Extract description (Summary property) - support multi-line text
    // Join all rich_text blocks to preserve line breaks
    let description = '';
    try {
      if (props.Summary?.rich_text && props.Summary.rich_text.length > 0) {
        description = props.Summary.rich_text.map((text: any) => text.plain_text).join('');
      } else if (props.Summary?.title && props.Summary.title.length > 0) {
        description = props.Summary.title.map((text: any) => text.plain_text).join('');
      }
    } catch (error) {
      // Description is optional, so we don't fail validation
      description = '';
    }

    // Extract type (Type select)
    let typeRaw = '';
    let type: 'intro' | 'project' | 'outro' = 'project';
    try {
      typeRaw = props.Type?.select?.name?.toLowerCase() || 'project';
      type = typeRaw === 'intro' ? 'intro' : 
             typeRaw === 'outro' ? 'outro' : 
             'project';
    } catch (error) {
      validationErrors.push('Type extraction failed');
      isValid = false;
    }

    // Extract image (Cover files) - REQUIRED: must be able to safely get URL
    let image = '';
    try {
      if (props.Cover?.files && Array.isArray(props.Cover.files) && props.Cover.files.length > 0) {
        const file = props.Cover.files[0];
        image = file.file?.url || file.external?.url || '';
        
        if (!image || image.trim() === '') {
          validationErrors.push('Image URL is empty or invalid');
          isValid = false;
        }
      } else {
        validationErrors.push('Cover files array is missing or empty');
        isValid = false;
      }
    } catch (error) {
      validationErrors.push('Image extraction failed');
      isValid = false;
    }

    // Extract link (Link URL)
    let link = '#';
    try {
      link = props.Link?.url || '#';
    } catch (error) {
      // Link is optional, default to '#'
      link = '#';
    }

    // Extract size (Grid Size select) - REQUIRED: must match union type
    let sizeRaw = '';
    let size: '1x1' | '1x2' | '2x1' | '2x2' = '1x1';
    try {
      sizeRaw = props['Grid Size']?.select?.name?.toLowerCase() || '1x1';
      if (['1x1', '1x2', '2x1', '2x2'].includes(sizeRaw)) {
        size = sizeRaw as '1x1' | '1x2' | '2x1' | '2x2';
      } else {
        validationErrors.push(`Invalid size: ${sizeRaw}`);
        isValid = false;
      }
    } catch (error) {
      validationErrors.push('Size extraction failed');
      isValid = false;
    }

    // Extract category (Category select) - REQUIRED for project type
    let category = '';
    try {
      category = props.Category?.select?.name || '';
      
      if (type === 'project' && (!category || category.trim() === '')) {
        validationErrors.push('Category is required for project type');
        isValid = false;
      }
    } catch (error) {
      if (type === 'project') {
        validationErrors.push('Category extraction failed');
        isValid = false;
      }
    }

    // Extract sort (Sort number field)
    let sort: number | undefined = undefined;
    try {
      if (props.Sort) {
        if (props.Sort.type === 'number' && props.Sort.number !== null && props.Sort.number !== undefined) {
          sort = props.Sort.number;
        }
      }
    } catch (error) {
      // Sort is optional, so we don't fail validation
      sort = undefined;
    }

    const validationError = validationErrors.length > 0 ? validationErrors.join('; ') : undefined;

    return {
      id: page.id,
      title: title || 'Untitled', // Fallback for invalid items
      year,
      description,
      type,
      image,
      link,
      size,
      category,
      sort,
      isValid,
      validationError,
    };
  } catch (error: any) {
    // Catch any unexpected errors during mapping
    const errorMessage = `Mapping failed: ${error?.message || 'Unknown error'}`;
    return {
      id: page.id,
      title: 'Untitled',
      year: '',
      description: '',
      type: 'project',
      image: '',
      link: '#',
      size: '1x1',
      category: '',
      sort: undefined,
      isValid: false,
      validationError: errorMessage,
    };
  }
}

