import type { NotionItem } from './notion';

/**
 * 处理后的首页数据结构
 */
export interface ProcessedHomePageData {
  /** 排序后的有效项目列表 */
  items: NotionItem[];
  /** 导航分类列表（包含 'All'） */
  categories: string[];
}

/**
 * 原始数据处理输入
 */
export interface RawHomePageInput {
  /** 从 Notion 获取的原始数据 */
  rawData: NotionItem[];
  /** 从 Notion Schema 获取的分类顺序 */
  categoryOrder: string[];
}

/**
 * 过滤无效数据项
 * @param items 原始数据项
 * @returns 有效数据项
 */
function filterValidItems(items: NotionItem[]): NotionItem[] {
  const validItems = items.filter(item => item.isValid === true);
  
  // 记录被过滤的无效项
  const invalidItems = items.filter(item => item.isValid === false);
  if (invalidItems.length > 0) {
    console.warn(
      `[transformers] Filtered out ${invalidItems.length} invalid item(s):`,
      invalidItems.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        error: item.validationError,
      }))
    );
  }
  
  return validItems;
}

/**
 * 提取三明治结构中的特殊项（intro/outro）和项目项
 */
interface SandwichItems {
  introItem: NotionItem | undefined;
  outroItem: NotionItem | undefined;
  projectItems: NotionItem[];
}

function extractSandwichItems(validItems: NotionItem[]): SandwichItems {
  return {
    introItem: validItems.find(item => item.type === 'intro'),
    outroItem: validItems.find(item => item.type === 'outro'),
    projectItems: validItems.filter(item => item.type === 'project'),
  };
}

/**
 * 计算最终的分类顺序
 * @param projectItems 项目数据项
 * @param categoryOrder Notion Schema 中的分类顺序
 * @returns 最终分类顺序
 */
function computeFinalCategoryOrder(
  projectItems: NotionItem[],
  categoryOrder: string[]
): string[] {
  // 获取项目中实际存在的分类
  const projectCategories = projectItems
    .map(p => p.category)
    .filter((cat): cat is string => !!cat);
  const uniqueProjectCategories = [...new Set(projectCategories)];

  if (categoryOrder.length === 0) {
    console.warn(
      '[transformers] ⚠️ No category order from Notion, using fallback order:',
      uniqueProjectCategories
    );
    return uniqueProjectCategories;
  }

  // 使用 Notion 顺序，只保留项目中实际存在的分类
  const orderedCategories = categoryOrder.filter(cat =>
    uniqueProjectCategories.includes(cat)
  );

  // 添加 Notion 顺序中没有的新分类
  const extraCategories = uniqueProjectCategories.filter(
    cat => !categoryOrder.includes(cat)
  );

  const finalOrder = [...orderedCategories, ...extraCategories];

  return finalOrder;
}

/**
 * 按分类和排序字段对项目进行排序
 * @param projectItems 项目数据项
 * @param categoryOrder 分类顺序
 * @returns 排序后的项目列表
 */
function sortProjectsByCategory(
  projectItems: NotionItem[],
  categoryOrder: string[]
): NotionItem[] {
  const sortedItems: NotionItem[] = [];

  for (const category of categoryOrder) {
    const itemsInCategory = projectItems
      .filter(item => item.category === category)
      .sort((a, b) => {
        const hasSortA = a.sort !== undefined && a.sort !== null;
        const hasSortB = b.sort !== undefined && b.sort !== null;

        if (hasSortA && hasSortB) {
          // 两者都有 sort，按值升序排列
          return a.sort! - b.sort!;
        } else if (hasSortA && !hasSortB) {
          // A 有 sort，A 排前面
          return -1;
        } else if (!hasSortA && hasSortB) {
          // B 有 sort，B 排前面
          return 1;
        }
        // 都没有 sort，保持原始顺序
        return 0;
      });

    sortedItems.push(...itemsInCategory);
  }

  return sortedItems;
}

/**
 * 组装三明治结构：intro -> projects -> outro
 */
function assembleSandwichOrder(
  introItem: NotionItem | undefined,
  sortedProjects: NotionItem[],
  outroItem: NotionItem | undefined
): NotionItem[] {
  const result: NotionItem[] = [];
  
  if (introItem) result.push(introItem);
  result.push(...sortedProjects);
  if (outroItem) result.push(outroItem);
  
  return result;
}

/**
 * 处理首页数据的纯函数
 * 
 * 职责：
 * 1. 过滤无效数据
 * 2. 提取 intro/outro/project 项
 * 3. 计算分类顺序
 * 4. 按分类和排序字段排序项目
 * 5. 组装三明治结构
 * 
 * @param input 原始数据输入
 * @returns 处理后的数据
 */
export function processHomePageItems(input: RawHomePageInput): ProcessedHomePageData {
  const { rawData, categoryOrder } = input;

  // Step 1: 过滤无效数据
  const validItems = filterValidItems(rawData);

  // Step 2: 提取三明治结构
  const { introItem, outroItem, projectItems } = extractSandwichItems(validItems);

  // Step 3: 计算最终分类顺序
  const finalCategoryOrder = computeFinalCategoryOrder(projectItems, categoryOrder);

  // Step 4: 按分类排序项目
  const sortedProjects = sortProjectsByCategory(projectItems, finalCategoryOrder);

  // Step 5: 组装三明治结构
  const items = assembleSandwichOrder(introItem, sortedProjects, outroItem);

  // Step 6: 构建导航分类（包含 'All'）
  const categories = ['All', ...finalCategoryOrder];

  return { items, categories };
}
