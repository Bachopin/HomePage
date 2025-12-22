import { getDatabaseItems, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';
import ErrorBoundary from '@/components/ErrorBoundary';

// Incremental Static Regeneration (ISR) - revalidate every hour
// This provides periodic synchronization with Notion while serving cached pages
export const revalidate = 3600;

// Define category order for sorting (must match actual category names from Notion)
const CATEGORY_ORDER = ['相关链接', '认知投研', '历史项目', '技术分析'];

export default async function Home() {
  let items: NotionItem[] = [];
  let categories: string[] = ['All'];
  
  try {
    // Fetch data from Notion
    const rawData = await getDatabaseItems();
    
    // Sort Logic - "Sandwich" Order:
    // 1. Filter out item where type === 'intro' -> Place FIRST
    // 2. Filter out item where type === 'outro' -> Place LAST
    // 3. All other type === 'project' items go in the middle, grouped by category
    const introItem = rawData.find(item => item.type === 'intro');
    const outroItem = rawData.find(item => item.type === 'outro');
    const projectItems = rawData.filter(item => item.type === 'project');
    
    // Get all unique categories from project items
    const projectCategories = projectItems
      .map(p => p.category)
      .filter((cat): cat is string => !!cat);
    const uniqueProjectCategories = [...new Set(projectCategories)];
    
    // Sort categories by CATEGORY_ORDER, then add any extras
    const orderedCategories = CATEGORY_ORDER.filter(cat => 
      uniqueProjectCategories.includes(cat)
    );
    const extraCategories = uniqueProjectCategories.filter(cat => 
      !CATEGORY_ORDER.includes(cat)
    );
    
    // Final category order for navigation (matches card order)
    const finalCategoryOrder = [...orderedCategories, ...extraCategories];
    
    // Sort project items by category order (group by category)
    // Within each category, strictly sort by Sort field (ascending)
    // Items with sort come first (1, 2, 3...), items without sort come after
    const sortedProjectItems: NotionItem[] = [];
    for (const category of finalCategoryOrder) {
      const itemsInCategory = projectItems
        .filter(item => item.category === category)
        .sort((a, b) => {
          const hasSortA = a.sort !== undefined && a.sort !== null;
          const hasSortB = b.sort !== undefined && b.sort !== null;

          if (hasSortA && hasSortB) {
            // Both have sort, sort by value ascending (1, 2, 3...)
            return a.sort! - b.sort!;
          } else if (hasSortA && !hasSortB) {
            // A has sort, A comes first
            return -1;
          } else if (!hasSortA && hasSortB) {
            // B has sort, B comes first
            return 1;
          }
          // Neither has sort, maintain original relative order
          return 0;
        });
      sortedProjectItems.push(...itemsInCategory);
    }
    
    // Filter out items without category (do not display them)
    
    const sortedItems: NotionItem[] = [];
    if (introItem) sortedItems.push(introItem);
    sortedItems.push(...sortedProjectItems);
    if (outroItem) sortedItems.push(outroItem);
    
    // Filter out invalid items (isValid: false)
    items = sortedItems.filter(item => item.isValid === true);
    
    // Log validation errors for debugging
    const invalidItems = sortedItems.filter(item => item.isValid === false);
    if (invalidItems.length > 0) {
      console.warn(`Filtered out ${invalidItems.length} invalid item(s):`, 
        invalidItems.map(item => ({ id: item.id, title: item.title, error: item.validationError }))
      );
    }
    
    // Navigation categories - must match the order of cards
    categories = ['All', ...finalCategoryOrder];
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    // Fallback to empty array if Notion fails
    items = [];
  }

  // Empty State: Show friendly message if no valid items
  if (items.length === 0) {
    return (
      <div className="bg-stone-100 dark:bg-neutral-700 min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">
            暂无内容
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            当前没有可显示的内容。
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            请检查 Notion 数据库配置，确保有标记为 "Live" 状态的项目。
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HomeClient items={items} categories={categories} />
    </ErrorBoundary>
  );
}
