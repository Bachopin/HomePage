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
    // Try with Status filter first, fallback to no filter if it fails
    let response;
    const baseParams: any = {
      database_id: process.env.NOTION_DATABASE_ID,
    };

    // Try to sort by Sort Order, fallback to created_time
    try {
      baseParams.sorts = [
        {
          property: 'Sort Order',
          direction: 'ascending',
        },
      ];
    } catch {
      // Fallback to created_time if Sort Order doesn't exist
      baseParams.sorts = [
        {
          timestamp: 'created_time',
          direction: 'ascending',
        },
      ];
    }

    // Try query with Status filter first
    try {
      const paramsWithFilter = {
        ...baseParams,
        filter: {
          property: 'Status',
          select: {
            equals: 'Live',
          },
        },
      };
      response = await (notion as any).databases.query(paramsWithFilter);
      console.log(`Query with Status='Live' filter returned ${response.results.length} items`);
    } catch (filterError: any) {
      // If Status filter fails (property doesn't exist or no 'Live' items), try without filter
      console.warn('Status filter failed, trying without filter:', filterError?.message);
      try {
        response = await (notion as any).databases.query(baseParams);
        console.log(`Query without filter returned ${response.results.length} items`);
      } catch (error: any) {
        throw error; // Re-throw if base query also fails
      }
    }

    console.log(`Fetched ${response.results.length} items from Notion`);

    return response.results.map((page: any) => {
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
      };
    });
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

