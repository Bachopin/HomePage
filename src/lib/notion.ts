import { cache } from 'react';
import { Client } from '@notionhq/client';

if (!process.env.NOTION_API_KEY) {
  console.warn('NOTION_API_KEY is not set');
}

export const notion = process.env.NOTION_API_KEY 
  ? new Client({
      auth: process.env.NOTION_API_KEY,
    })
  : null;

const DEFAULT_SITE_TITLE = 'Mextric Homepage';
const NOTION_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

function getNotionHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

type NotionQueryBody = {
  filter?: Record<string, unknown>;
  sorts?: Array<Record<string, unknown>>;
};

/**
 * Query all database pages with Notion pagination (100/page).
 */
async function queryAllDatabasePages(
  databaseId: string,
  headers: HeadersInit,
  body: NotionQueryBody
): Promise<{ ok: true; results: any[] } | { ok: false; status: number; errorData?: any }> {
  const results: any[] = [];
  let startCursor: string | undefined;

  do {
    const response = await fetch(`${NOTION_API_BASE}/databases/${databaseId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...body,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = JSON.parse(await response.text());
      } catch {
        errorData = undefined;
      }
      return { ok: false, status: response.status, errorData };
    }

    const data = await response.json();
    if (Array.isArray(data.results)) {
      results.push(...data.results);
    }
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return { ok: true, results };
}

function scheduleDebugFieldUpdates(
  mappedItems: Array<{ item: NotionItem; pageId: string }>
): void {
  const updatePromises = mappedItems.map(({ item, pageId }) => {
    if (!item.isValid && item.validationError) {
      return updateNotionDebugField(pageId, item.validationError);
    }
    return updateNotionDebugField(pageId, null);
  });

  // Fire-and-forget: do not block ISR / page render on Notion write quota
  void Promise.allSettled(updatePromises).then((results) => {
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`Failed to update Debug field for ${failures.length} page(s).`);
    }
  });
}

export interface DatabaseIcon {
  // 统一为图片 URL，复用现有图片处理逻辑
  url: string;
  type: 'emoji' | 'external' | 'file'; // 保留类型信息用于调试
}

export interface NotionItem {
  id: string;
  title: string;
  quotes: string;
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
 * Extract category option order from Notion database properties.
 * Preserves schema order from the Notion API.
 */
function extractCategoryOrder(properties: Record<string, any> | undefined): string[] {
  if (!properties || typeof properties !== 'object') {
    return [];
  }

  const propertyNames = Object.keys(properties);
  const categoryKey = propertyNames.find(key =>
    key.toLowerCase() === 'category' ||
    key.toLowerCase() === '分类' ||
    key.toLowerCase() === 'categories'
  );

  if (!categoryKey) {
    console.warn('[extractCategoryOrder] Category property not found. Available properties:', propertyNames);
    return [];
  }

  const categoryProperty = properties[categoryKey];
  if (!categoryProperty) {
    return [];
  }

  if (categoryProperty.type !== 'select') {
    console.warn(`[extractCategoryOrder] Category property type is "${categoryProperty.type}", expected "select"`);
    return [];
  }

  const options = categoryProperty.select?.options;
  if (!options || !Array.isArray(options) || options.length === 0) {
    console.warn('[extractCategoryOrder] No category options found in database schema');
    return [];
  }

  return options
    .map((option: any) => {
      if (typeof option === 'string') return option;
      if (option && typeof option === 'object') {
        return option.name || option.value || option.label || null;
      }
      return null;
    })
    .filter((name): name is string => !!name && name.trim() !== '');
}

/**
 * Get category order from Notion database schema.
 * Reuses the request-scoped cached getDatabaseItems() result (no extra Notion call).
 */
export async function getCategoryOrder(): Promise<string[]> {
  const { categoryOrder } = await getDatabaseItems();
  return categoryOrder;
}

/**
 * Parse database icon from Notion API response
 * 统一处理所有图标类型为图片 URL，复用现有图片处理逻辑
 * @param iconData Raw icon data from Notion database
 * @returns Parsed DatabaseIcon with unified URL or undefined
 */
function parseDatabaseIcon(iconData: any): DatabaseIcon | undefined {
  if (!iconData || typeof iconData !== 'object') {
    return undefined;
  }

  try {
    switch (iconData.type) {
      case 'emoji':
        if (iconData.emoji && typeof iconData.emoji === 'string') {
          // 将 emoji 转换为真实的图片 URL，这样就能被现有图片逻辑处理
          const emojiImageUrl = createEmojiImageUrl(iconData.emoji);
          return {
            url: emojiImageUrl,
            type: 'emoji',
          };
        }
        break;
      
      case 'custom_emoji':
        // 处理自定义 emoji（实际上是图片文件）
        if (iconData.custom_emoji?.url && typeof iconData.custom_emoji.url === 'string') {
          return {
            url: iconData.custom_emoji.url,
            type: 'file',
          };
        }
        break;
      
      case 'external':
        if (iconData.external?.url && typeof iconData.external.url === 'string') {
          return {
            url: iconData.external.url,
            type: 'external',
          };
        }
        break;
      
      case 'file':
        if (iconData.file?.url && typeof iconData.file.url === 'string') {
          return {
            url: iconData.file.url,
            type: 'file',
          };
        }
        break;
      
      default:
        console.warn('[parseDatabaseIcon] Unknown icon type:', iconData.type);
        break;
    }
  } catch (error: any) {
    console.warn('[parseDatabaseIcon] Error parsing icon data:', error?.message || error);
  }

  return undefined;
}

/**
 * 创建 emoji 的图片 URL
 * 使用 emoji 转图片服务，这样就能被现有的图片处理逻辑处理
 */
function createEmojiImageUrl(emoji: string): string {
  // 使用 Twemoji CDN 或类似服务
  // 但为了简单，我们先使用一个基于 emoji 的占位符服务
  
  // 方案1: 使用 emoji 的 Unicode 码点生成 Twemoji URL
  const codePoint = emoji.codePointAt(0)?.toString(16).padStart(4, '0');
  if (codePoint) {
    // Twemoji CDN URL
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoint}.png`;
  }
  
  // 方案2: 回退到一个简单的占位符
  // 这里我们可以使用一个生成占位符图片的服务
  return `https://via.placeholder.com/72x72/6366f1/ffffff?text=${encodeURIComponent(emoji)}`;
}

export interface DatabaseWithItems {
  title: string;
  items: NotionItem[];
  icon?: DatabaseIcon;
  /** Category select option order from Notion schema */
  categoryOrder: string[];
}

const EMPTY_DATABASE_RESULT: DatabaseWithItems = {
  title: DEFAULT_SITE_TITLE,
  items: [],
  icon: undefined,
  categoryOrder: [],
};

async function fetchDatabaseItems(): Promise<DatabaseWithItems> {
  if (!process.env.NOTION_DATABASE_ID) {
    console.warn('NOTION_DATABASE_ID is not set, returning empty result');
    return { ...EMPTY_DATABASE_RESULT };
  }

  try {
    if (!notion) {
      console.warn('Notion client not initialized');
      return { ...EMPTY_DATABASE_RESULT };
    }

    const apiKey = process.env.NOTION_API_KEY!;
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const headers = getNotionHeaders(apiKey);

    const liveQueryBody: NotionQueryBody = {
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

    // Metadata + paginated items in parallel
    const [databaseResponse, itemsResult] = await Promise.all([
      fetch(`${NOTION_API_BASE}/databases/${databaseId}`, {
        method: 'GET',
        headers,
      }),
      queryAllDatabasePages(databaseId, headers, liveQueryBody),
    ]);

    // Extract title, icon, and category order from database metadata
    let title = DEFAULT_SITE_TITLE;
    let icon: DatabaseIcon | undefined = undefined;
    let categoryOrder: string[] = [];
    if (databaseResponse.ok) {
      try {
        const database = await databaseResponse.json();
        
        if (database.title && Array.isArray(database.title) && database.title.length > 0) {
          const extractedTitle = database.title.map((t: any) => t.plain_text).join('');
          if (extractedTitle.trim()) {
            title = extractedTitle.trim();
          }
        }
        
        if (database.icon) {
          icon = parseDatabaseIcon(database.icon);
        }

        categoryOrder = extractCategoryOrder(database.properties);
      } catch {
        console.warn('Failed to extract database metadata, using defaults');
      }
    }

    let pageResults: any[] = [];

    if (!itemsResult.ok) {
      if (itemsResult.status === 429) {
        console.warn('Notion API rate limit exceeded (429). Returning empty array.');
        return { title, items: [], icon, categoryOrder };
      }

      const errorData = itemsResult.errorData;
      if (errorData?.code === 'validation_error' && errorData.message?.includes('Status')) {
        console.warn('Status filter failed, trying without filter:', errorData.message);
        const fallback = await queryAllDatabasePages(databaseId, headers, {
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'ascending',
            },
          ],
        });

        if (!fallback.ok) {
          if (fallback.status === 429) {
            console.warn('Notion API rate limit exceeded (429) in fallback.');
            return { title, items: [], icon, categoryOrder };
          }
          console.error(`Notion API error in fallback: ${fallback.status}`);
          return { title, items: [], icon, categoryOrder };
        }

        pageResults = fallback.results;
      } else {
        console.error(`Notion API error: ${itemsResult.status}`, errorData);
        return { title, items: [], icon, categoryOrder };
      }
    } else {
      pageResults = itemsResult.results;
    }

    const mappedItems = pageResults.map((page: any) => ({
      item: mapPageToItem(page),
      pageId: page.id,
    }));

    scheduleDebugFieldUpdates(mappedItems);

    return { 
      title, 
      items: mappedItems.map(({ item }: { item: NotionItem; pageId: string }) => item),
      icon,
      categoryOrder,
    };
  } catch (error: any) {
    console.error('Error fetching Notion database:', error);
    return { ...EMPTY_DATABASE_RESULT };
  }
}

/**
 * Request-scoped cached Notion fetch.
 * Dedupes layout + generateMetadata + page calls within a single render.
 */
export const getDatabaseItems = cache(fetchDatabaseItems);

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
    } catch {
      // Title extraction failure is not critical - title is optional
      title = '';
    }

    // Extract quotes (Quotes property - can be text like "Trade | Research")
    let quotes = '';
    try {
      quotes = props.Quotes?.rich_text?.[0]?.plain_text || 
             props.Quotes?.title?.[0]?.plain_text || 
             '';
    } catch {
      // Quotes is optional, so we don't fail validation
      quotes = '';
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
    } catch {
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
    } catch {
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
    } catch {
      // Image extraction failure is not critical - image is optional
      image = '';
    }

    // Extract link (Link URL)
    let link = '#';
    try {
      link = props.Link?.url || '#';
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      // Sort is optional, so we don't fail validation
      sort = undefined;
    }

    const validationError = validationErrors.length > 0 ? validationErrors.join('; ') : undefined;

    return {
      id: page.id,
      title: title || '', // Title is optional, use empty string if not provided
      quotes,
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
      quotes: '',
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

