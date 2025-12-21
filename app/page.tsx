import { getDatabaseItems, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';

// Define category order for sorting
const CATEGORY_ORDER = ['Work', 'Lab', 'Signal', 'Reading'];

export default async function Home() {
  let items: NotionItem[] = [];
  let categories: string[] = ['All'];
  
  try {
    // Fetch data from Notion
    const rawData = await getDatabaseItems();
    
    // Sort Logic - "Sandwich" Order:
    // 1. Filter out item where type === 'intro' -> Place FIRST
    // 2. Filter out item where type === 'outro' -> Place LAST
    // 3. All other type === 'project' items go in the middle
    const introItem = rawData.find(item => item.type === 'intro');
    const outroItem = rawData.find(item => item.type === 'outro');
    const projectItems = rawData.filter(item => item.type === 'project');
    
    // Sort project items by category order
    const sortedProjectItems = [...projectItems].sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category || '');
      const bIndex = CATEGORY_ORDER.indexOf(b.category || '');
      
      // If both categories are in the order, sort by index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // If only one is in the order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // If neither is in the order, maintain original order
      return 0;
    });
    
    const sortedItems: NotionItem[] = [];
    if (introItem) sortedItems.push(introItem);
    sortedItems.push(...sortedProjectItems);
    if (outroItem) sortedItems.push(outroItem);
    
    items = sortedItems;
    
    // Dynamic Nav - Generate categories from project data, respecting CATEGORY_ORDER
    const projectCategories = sortedProjectItems
      .map(p => p.category)
      .filter((cat): cat is string => !!cat);
    
    // Sort categories by CATEGORY_ORDER, then add any extras
    const orderedCategories = CATEGORY_ORDER.filter(cat => 
      projectCategories.includes(cat)
    );
    const extraCategories = projectCategories.filter(cat => 
      !CATEGORY_ORDER.includes(cat)
    );
    
    categories = ['All', ...orderedCategories, ...extraCategories];
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    // Fallback to empty array if Notion fails
    items = [];
  }

  return <HomeClient items={items} categories={categories} />;
}
