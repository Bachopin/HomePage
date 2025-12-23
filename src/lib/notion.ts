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

const DEFAULT_SITE_TITLE = 'Mextric Homepage';

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

export interface DatabaseWithItems {
  title: string;
  items: NotionItem[];
}

export async function getDatabaseItems(): Promise<DatabaseWithItems> {
  if (!process.env.NOTION_DATABASE_ID) {
    console.warn('NOTION_DATABASE_ID is not set, returning empty result');
    return { title: DEFAULT_SITE_TITLE, items: [] };
  }

  try {
    if (!notion) {
      console.warn('Notion client not initialized');
      return { title: DEFAULT_SITE_TITLE, items: [] };
    }

    const apiKey = process.env.NOTION_API_KEY!;
    const databaseId = process.env.NOTION_DATABASE_ID!;
    
    // 1. Get database info (for title) and items in parallel
    const [databaseResponse, itemsResponse] = await Promise.all([
      // Database metadata
      fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      }),
      // Database items
      fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      })
    ]);

    // Extract title from database metadata
    let title = DEFAULT_SITE_TITLE;
    if (databaseResponse.ok) {
      try {
        const database = await databaseResponse.json();
        if (database.title && Array.isArray(database.title) && database.title.length > 0) {
          const extractedTitle = database.title.map((t: any) => t.plain_text).join('');
          if (extractedTitle.trim()) {
            title = extractedTitle.trim();
          }
        }
      } catch (error) {
        console.warn('Failed to extract database title, using default');
      }
    }

    // Handle items response
    if (!itemsResponse.ok) {
      if (itemsResponse.status === 429) {
        console.warn('Notion API rate limit exceeded (429). Returning empty array.');
        return { title, items: [] };
      }

      let errorData: any;
      try {
        const errorText = await itemsResponse.text();
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        console.error('Error parsing Notion API error response:', parseError);
        return { title, items: [] };
      }
      
      // If Status filter fails, try without filter
      if (errorData.code === 'validation_error' && errorData.message?.includes('Status')) {
        console.warn('Status filter failed, trying without filter:', errorData.message);
        try {
          const fallbackResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sorts: [
                {
                  timestamp: 'created_time',
                  direction: 'ascending',
                },
              ],
            }),
          });
          
          if (!fallbackResponse.ok) {
            if (fallbackResponse.status === 429) {
              console.warn('Notion API rate limit exceeded (429) in fallback.');
              return { title, items: [] };
            }
            console.error(`Notion API error in fallback: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
            return { title, items: [] };
          }
          
          const fallbackData = await fallbackResponse.json();
          const mappedItems = fallbackData.results.map((page: any) => ({
            item: mapPageToItem(page),
            pageId: page.id,
          }));

          // Update Debug fields
          const updatePromises = mappedItems.map(({ item, pageId }: { item: NotionItem; pageId: string }) => {
            if (!item.isValid && item.validationError) {
              return updateNotionDebugField(pageId, item.validationError);
            } else {
              return updateNotionDebugField(pageId, null);
            }
          });

          await Promise.allSettled(updatePromises).then((results) => {
            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length > 0) {
              console.warn(`Failed to update Debug field for ${failures.length} page(s) in fallback.`);
            }
          });

          return { 
            title, 
            items: mappedItems.map(({ item }: { item: NotionItem; pageId: string }) => item) 
          };
        } catch (fallbackError: any) {
          console.error('Network error in fallback fetch:', fallbackError?.message || fallbackError);
          return { title, items: [] };
        }
      }
      
      console.error(`Notion API error: ${itemsResponse.status} ${itemsResponse.statusText}`, errorData);
      return { title, items: [] };
    }

    // Parse successful items response
    let data: any;
    try {
      data = await itemsResponse.json();
    } catch (parseError) {
      console.error('Error parsing Notion API response:', parseError);
      return { title, items: [] };
    }

    // Process items
    const mappedItems = data.results.map((page: any) => ({
      item: mapPageToItem(page),
      pageId: page.id,
    }));

    // Update Debug fields
    const updatePromises = mappedItems.map(({ item, pageId }: { item: NotionItem; pageId: string }) => {
      if (!item.isValid && item.validationError) {
        return updateNotionDebugField(pageId, item.validationError);
      } else {
        return updateNotionDebugField(pageId, null);
      }
    });

    await Promise.allSettled(updatePromises).then((results) => {
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`Failed to update Debug field for ${failures.length} page(s).`);
      }
    });

    return { 
      title, 
      items: mappedItems.map(({ item }: { item: NotionItem; pageId: string }) => item) 
    };
  } catch (error: any) {
    console.error('Error fetching Notion database:', error);
    return { title: DEFAULT_SITE_TITLE, items: [] };
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

