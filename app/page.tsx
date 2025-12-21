import { getDatabaseItems, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';

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
    
    const sortedItems: NotionItem[] = [];
    if (introItem) sortedItems.push(introItem);
    sortedItems.push(...projectItems);
    if (outroItem) sortedItems.push(outroItem);
    
    items = sortedItems;
    
    // Dynamic Nav - Generate categories from project data
    const projectCategories = projectItems
      .map(p => p.category)
      .filter((cat): cat is string => !!cat);
    categories = ['All', ...new Set(projectCategories)];
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    // Fallback to empty array if Notion fails
    items = [];
  }

  return <HomeClient items={items} categories={categories} />;
}
