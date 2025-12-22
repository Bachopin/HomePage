import { getDatabaseItems, getCategoryOrder, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';
import ErrorBoundary from '@/components/ErrorBoundary';

// Incremental Static Regeneration (ISR) - revalidate every hour
// This provides periodic synchronization with Notion while serving cached pages
export const revalidate = 36;

export default async function Home() {
  let items: NotionItem[] = [];
  let categories: string[] = ['All'];
  
  try {
    // Fetch category order from Notion database schema (dynamic)
    const categoryOrder = await getCategoryOrder();
    console.log('[Home] Retrieved categoryOrder from Notion:', categoryOrder);
    
    // Fetch data from Notion
    const rawData = await getDatabaseItems();
    
    // Step 1: Filter out invalid items FIRST (isValid: false)
    // This ensures we only work with valid data throughout the rest of the logic
    const validItems = rawData.filter(item => item.isValid === true);
    
    // Log validation errors for debugging
    const invalidItems = rawData.filter(item => item.isValid === false);
    if (invalidItems.length > 0) {
      console.warn(`Filtered out ${invalidItems.length} invalid item(s):`, 
        invalidItems.map(item => ({ id: item.id, title: item.title, type: item.type, error: item.validationError }))
      );
    }
    
    // Step 2: Extract items by type from VALID items only
    // Sort Logic - "Sandwich" Order:
    // 1. Filter out item where type === 'intro' -> Place FIRST
    // 2. Filter out item where type === 'outro' -> Place LAST
    // 3. All other type === 'project' items go in the middle, grouped by category
    const introItem = validItems.find(item => item.type === 'intro');
    const outroItem = validItems.find(item => item.type === 'outro');
    const projectItems = validItems.filter(item => item.type === 'project');
    
    // Get all unique categories from project items
    const projectCategories = projectItems
      .map(p => p.category)
      .filter((cat): cat is string => !!cat);
    const uniqueProjectCategories = [...new Set(projectCategories)];
    
    // Sort categories by dynamic categoryOrder from Notion, then add any extras
    // IMPORTANT: Use the exact order from Notion API, filtering only categories that exist in project items
    let finalCategoryOrder: string[] = [];
    
    if (categoryOrder.length > 0) {
      // Use Notion's order: filter to only include categories that exist in project items
      const orderedCategories = categoryOrder.filter(cat => uniqueProjectCategories.includes(cat));
      
      // Add any categories from project items that are not in Notion's order (new categories)
      const extraCategories = uniqueProjectCategories.filter(cat => !categoryOrder.includes(cat));
      
      // Final order: Notion's order first, then extras
      finalCategoryOrder = [...orderedCategories, ...extraCategories];
      
      console.log('[Home] ✅ Using Notion category order');
      console.log('[Home] Notion order:', categoryOrder);
      console.log('[Home] Ordered categories (filtered):', orderedCategories);
      console.log('[Home] Extra categories (not in Notion):', extraCategories);
    } else {
      // Fallback: use natural order from project items
      finalCategoryOrder = uniqueProjectCategories;
      console.warn('[Home] ⚠️ No category order from Notion, using fallback order:', finalCategoryOrder);
    }
    
    console.log('[Home] Final category order:', finalCategoryOrder);
    console.log('[Home] Unique project categories:', uniqueProjectCategories);
    
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
    
    // Step 3: Build sorted items array (all items are already valid at this point)
    const sortedItems: NotionItem[] = [];
    if (introItem) sortedItems.push(introItem);
    sortedItems.push(...sortedProjectItems);
    if (outroItem) sortedItems.push(outroItem);
    
    items = sortedItems;
    
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
