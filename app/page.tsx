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
    
    // Sort project items by category order - Group by category first
    const sortedProjectItems: NotionItem[] = [];
    
    // First, add items in CATEGORY_ORDER
    for (const category of CATEGORY_ORDER) {
      const categoryItems = projectItems.filter(item => item.category === category);
      sortedProjectItems.push(...categoryItems);
    }
    
    // Then, add items with categories not in CATEGORY_ORDER
    const remainingItems = projectItems.filter(item => 
      !item.category || !CATEGORY_ORDER.includes(item.category)
    );
    sortedProjectItems.push(...remainingItems);
    
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
