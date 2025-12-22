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
        
        const mappedItems = fallbackData.results.map((page: any) => {
          return mapPageToItem(page);
        });
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

    const mappedItems = data.results.map((page: any) => {
      return mapPageToItem(page);
    });

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

// Helper function to map Notion page to our item format
function mapPageToItem(page: any): NotionItem {
  const props = page.properties;

      // Extract title (Name property)
      const title = props.Name?.title?.[0]?.plain_text || 'Untitled';

      // Extract year (Year property - can be text like "Trade | Research")
      const year = props.Year?.rich_text?.[0]?.plain_text || 
                  props.Year?.title?.[0]?.plain_text || 
                  '';

      // Extract description (Summary property) - support multi-line text
      // Join all rich_text blocks to preserve line breaks
      let description = '';
      if (props.Summary?.rich_text && props.Summary.rich_text.length > 0) {
        description = props.Summary.rich_text.map((text: any) => text.plain_text).join('');
      } else if (props.Summary?.title && props.Summary.title.length > 0) {
        description = props.Summary.title.map((text: any) => text.plain_text).join('');
      }

      // Extract type (Type select)
      const typeRaw = props.Type?.select?.name?.toLowerCase() || 'project';
      const type = typeRaw === 'intro' ? 'intro' : 
                   typeRaw === 'outro' ? 'outro' : 
                   'project';

      // Extract image (Cover files)
      let image = '';
      if (props.Cover?.files && props.Cover.files.length > 0) {
        const file = props.Cover.files[0];
        image = file.file?.url || file.external?.url || '';
      }

      // Extract link (Link URL)
      const link = props.Link?.url || '#';

      // Extract size (Grid Size select)
      const sizeRaw = props['Grid Size']?.select?.name?.toLowerCase() || '1x1';
      const size = (['1x1', '1x2', '2x1', '2x2'].includes(sizeRaw) 
        ? sizeRaw 
        : '1x1') as '1x1' | '1x2' | '2x1' | '2x2';

      // Extract category (Category select)
      const category = props.Category?.select?.name || '';

      // Extract sort (Sort number field)
      let sort: number | undefined = undefined;
      if (props.Sort) {
        if (props.Sort.type === 'number' && props.Sort.number !== null && props.Sort.number !== undefined) {
          sort = props.Sort.number;
        }
      }

  return {
    id: page.id,
    title,
    year,
    description,
    type,
    image,
    link,
    size,
    category,
    sort,
  };
}

