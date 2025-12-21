import { getDatabaseItems, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';

// Force dynamic rendering - fetch on every request
export const revalidate = 0;

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
    // Within each category, sort by Sort field (ascending)
    // Cards without a Sort value should appear after those with a Sort value
    const sortedProjectItems: NotionItem[] = [];
    for (const category of finalCategoryOrder) {
      const itemsInCategory = projectItems
        .filter(item => item.category === category)
        .sort((a, b) => {
          const hasSortA = a.sortOrder !== undefined && a.sortOrder !== null;
          const hasSortB = b.sortOrder !== undefined && b.sortOrder !== null;

          if (hasSortA && hasSortB) {
            return a.sortOrder! - b.sortOrder!; // Both have sortOrder, sort by value
          } else if (hasSortA && !hasSortB) {
            return -1; // A has sortOrder, A comes first
          } else if (!hasSortA && hasSortB) {
            return 1; // B has sortOrder, B comes first
          }
          return 0; // Neither has sortOrder, maintain original relative order
        });
      sortedProjectItems.push(...itemsInCategory);
    }
    
    // Filter out items without category (do not display them)
    
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

  return <HomeClient items={items} categories={categories} />;
}
