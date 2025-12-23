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

/**
 * Get database title from Notion
 * @returns Promise<string> Database title or fallback
 */
const DEFAULT_SITE_TITLE = 'Mextric Homepage';

/**
 * Get database title from Notion
 * @returns Promise<string> Database title or fallback
 */
export async function getDatabaseTitle(): Promise<string> {
  if (!process.env.NOTION_DATABASE_ID || !process.env.NOTION_API_KEY) {
    console.warn('[getDatabaseTitle] NOTION_DATABASE_ID or NOTION_API_KEY is not set');
    return DEFAULT_SITE_TITLE;
  }

  try {
    const apiKey = process.env.NOTION_API_KEY!;
    const databaseId = process.env.NOTION_DATABASE_ID!;
    
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('[getDatabaseTitle] Failed to fetch database:', response.status);
      return DEFAULT_SITE_TITLE;
    }

    const database = await response.json();
    
    // Extract title from database
    // Notion database title is in title array: { title: [{ plain_text: "..." }] }
    if (database.title && Array.isArray(database.title) && database.title.length > 0) {
      const title = database.title.map((t: any) => t.plain_text).join('');
      if (title.trim()) {
        return title.trim();
      }
    }

    return DEFAULT_SITE_TITLE;
  } catch (error: any) {
    console.error('[getDatabaseTitle] Error:', error?.message || error);
    return DEFAULT_SITE_TITLE;
  }
}

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

/**
 * Get category order from Notion database schema
 * Returns the order of category options as defined in the database
 * @returns Promise<string[]> Array of category names in order
 */
export async function getCategoryOrder(): Promise<string[]> {
  if (!process.env.NOTION_DATABASE_ID || !process.env.NOTION_API_KEY) {
    console.warn('[getCategoryOrder] NOTION_DATABASE_ID or NOTION_API_KEY is not set');
    return [];
  }

  try {
    const apiKey = process.env.NOTION_API_KEY!;
    const databaseId = process.env.NOTION_DATABASE_ID!;
    
    // Use direct HTTP request to get full database structure (same approach as getDatabaseItems)
    // This ensures we get the complete properties including select options
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getCategoryOrder] Failed to fetch database:', response.status, errorText);
      return [];
    }

    const database = await response.json();

    // Check if database has properties
    if (!database.properties || typeof database.properties !== 'object') {
      console.warn('[getCategoryOrder] Database response does not contain properties');
      console.warn('[getCategoryOrder] Database response keys:', Object.keys(database));
      return [];
    }

    // Extract Category property options
    const properties = database.properties as Record<string, any>;
    
    // Find Category property (case-insensitive search)
    const propertyNames = Object.keys(properties);
    const categoryKey = propertyNames.find(key => 
      key.toLowerCase() === 'category' || 
      key.toLowerCase() === '分类' ||
      key.toLowerCase() === 'categories'
    );
    
    if (!categoryKey) {
      console.warn('[getCategoryOrder] Category property not found. Available properties:', propertyNames);
      return [];
    }
    
    const categoryProperty = properties[categoryKey];
    
    if (!categoryProperty) {
      console.warn('[getCategoryOrder] Category property is null or undefined');
      return [];
    }
    
    if (categoryProperty.type !== 'select') {
      console.warn(`[getCategoryOrder] Category property type is "${categoryProperty.type}", expected "select"`);
      return [];
    }

    // Get options array from select property
    // Notion API returns options in the order they appear in the database schema
    const selectConfig = categoryProperty.select;
    if (!selectConfig) {
      console.warn('[getCategoryOrder] Select property has no select configuration');
      return [];
    }
    
    const options = selectConfig.options;
    
    if (!options || !Array.isArray(options) || options.length === 0) {
      console.warn('[getCategoryOrder] No category options found in database schema');
      return [];
    }

    // Extract names from options (order is preserved from Notion API)
    // Each option has structure: { id: string, name: string, color: string }
    const categoryOrder = options
      .map((option: any) => {
        if (typeof option === 'string') {
          return option;
        }
        if (option && typeof option === 'object') {
          // Notion API option structure: { id, name, color }
          return option.name || option.value || option.label || null;
        }
        return null;
      })
      .filter((name): name is string => !!name && name.trim() !== '');

    return categoryOrder;
  } catch (error: any) {
    // Handle errors gracefully - return empty array instead of crashing
    console.error('[getCategoryOrder] Error fetching category order from Notion:', error?.message || error);
    return [];
  }
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
        
        // Step 1: Parse all items first (no API calls)
        const mappedItems = fallbackData.results.map((page: any) => {
          return {
            item: mapPageToItem(page),
            pageId: page.id,
          };
        });

        // Step 2: Extract update promises for Debug field
        const updatePromises = mappedItems.map(({ item, pageId }: { item: NotionItem; pageId: string }) => {
          if (!item.isValid && item.validationError) {
            // Write error to Debug field
            return updateNotionDebugField(pageId, item.validationError);
          } else {
            // Clear Debug field if item is valid
            return updateNotionDebugField(pageId, null);
          }
        });

        // Step 3: Execute all Debug field updates concurrently using Promise.allSettled
        await Promise.allSettled(updatePromises).then((results) => {
          const failures = results.filter(result => result.status === 'rejected');
          if (failures.length > 0) {
            console.warn(`Failed to update Debug field for ${failures.length} page(s) in fallback. This is non-critical.`);
          }
        });

        // Step 4: Return only the items
        return mappedItems.map(({ item }: { item: NotionItem; pageId: string }) => item);
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

    // Step 1: Parse all items first (no API calls)
    const mappedItems = data.results.map((page: any) => {
      return {
        item: mapPageToItem(page),
        pageId: page.id,
      };
    });

    // Step 2: Extract update promises for Debug field
    const updatePromises = mappedItems.map(({ item, pageId }: { item: NotionItem; pageId: string }) => {
      if (!item.isValid && item.validationError) {
        // Write error to Debug field
        return updateNotionDebugField(pageId, item.validationError);
      } else {
        // Clear Debug field if item is valid
        return updateNotionDebugField(pageId, null);
      }
    });

    // Step 3: Execute all Debug field updates concurrently using Promise.allSettled
    // This ensures that even if some API calls fail (e.g., rate limits), 
    // we still return the parsed items
    await Promise.allSettled(updatePromises).then((results) => {
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`Failed to update Debug field for ${failures.length} page(s). This is non-critical.`);
      }
    });

    // Step 4: Return only the items
    return mappedItems.map(({ item }: { item: NotionItem; pageId: string }) => item);
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

    // Extract title (Name property) - OPTIONAL: can be empty
    // Support multiple possible structures: title array, rich_text array
    let title = '';
    try {
      // Try title array first (most common for Title/Name properties)
      if (props.Name?.title && Array.isArray(props.Name.title) && props.Name.title.length > 0) {
        title = props.Name.title[0]?.plain_text || '';
      } 
      // Fallback to rich_text array (some databases use rich_text for Name)
      else if (props.Name?.rich_text && Array.isArray(props.Name.rich_text) && props.Name.rich_text.length > 0) {
        title = props.Name.rich_text[0]?.plain_text || '';
      }
      // Title is optional, so empty title is valid - no validation error
    } catch (error) {
      // Title extraction failure is not critical - title is optional
      title = '';
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

    // Extract type (Type select) - REQUIRED: must exist
    let typeRaw = '';
    let type: 'intro' | 'project' | 'outro' = 'project';
    try {
      // Check if Type property exists
      if (!props.Type || !props.Type.select || !props.Type.select.name) {
        validationErrors.push('Type is missing');
        isValid = false;
      } else {
        typeRaw = props.Type.select.name.toLowerCase();
        type = typeRaw === 'intro' ? 'intro' : 
               typeRaw === 'outro' ? 'outro' : 
               'project';
      }
    } catch (error) {
      validationErrors.push('Type extraction failed');
      isValid = false;
    }

    // Extract image (Cover files) - OPTIONAL: can be empty for text-only cards
    // Image is not a required field according to validation rules
    let image = '';
    try {
      if (props.Cover?.files && Array.isArray(props.Cover.files) && props.Cover.files.length > 0) {
        const file = props.Cover.files[0];
        image = file.file?.url || file.external?.url || '';
        // Image is optional, so we don't fail validation if it's empty
      }
      // If no Cover files, image remains empty string - this is valid
    } catch (error) {
      // Image extraction failure is not critical - image is optional
      image = '';
    }

    // Extract link (Link URL)
    let link = '#';
    try {
      link = props.Link?.url || '#';
    } catch (error) {
      // Link is optional, default to '#'
      link = '#';
    }

    // Extract size (Grid Size select) - REQUIRED: must exist and match union type
    let sizeRaw = '';
    let size: '1x1' | '1x2' | '2x1' | '2x2' = '1x1';
    try {
      // Check if Grid Size property exists
      if (!props['Grid Size'] || !props['Grid Size'].select || !props['Grid Size'].select.name) {
        validationErrors.push('Grid Size is missing');
        isValid = false;
      } else {
        sizeRaw = props['Grid Size'].select.name.toLowerCase();
        if (['1x1', '1x2', '2x1', '2x2'].includes(sizeRaw)) {
          size = sizeRaw as '1x1' | '1x2' | '2x1' | '2x2';
        } else {
          validationErrors.push(`Invalid size: ${sizeRaw}`);
          isValid = false;
        }
      }
    } catch (error) {
      validationErrors.push('Size extraction failed');
      isValid = false;
    }

    // Extract category (Category select) - REQUIRED only for project type
    // Only validate category if type was successfully extracted (isValid check ensures type exists)
    let category = '';
    try {
      category = props.Category?.select?.name || '';
      
      // Category is only required for project type
      // intro and outro types can have empty category
      // Only check category requirement if type is valid (not failed validation)
      if (isValid && type === 'project' && (!category || category.trim() === '')) {
        validationErrors.push('Project requires a Category');
        isValid = false;
      }
      // For intro/outro, category is optional - no validation error
    } catch (error) {
      // Only fail validation if it's a project type and type itself is valid
      if (isValid && type === 'project') {
        validationErrors.push('Category extraction failed');
        isValid = false;
      }
      // For intro/outro, silently allow empty category
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
      title: title || '', // Title is optional, use empty string if not provided
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
      title: '', // Use empty string instead of 'Untitled'
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

