import { getDatabaseItems, NotionItem } from '@/lib/notion';
import HomeClient from '@/components/HomeClient';

export default async function Home() {
  let items: NotionItem[] = [];
  
  try {
    // Fetch data from Notion
    items = await getDatabaseItems();
    
    // Sort Logic:
    // 1. Find item with Type === 'Intro' -> Place at Index 0
    // 2. Find item with Type === 'Outro' -> Place at Last Index
    // 3. Place all others in between
    const introItem = items.find(item => item.type === 'intro');
    const outroItem = items.find(item => item.type === 'outro');
    const projectItems = items.filter(item => item.type === 'project');
    
    const sortedItems = [];
    if (introItem) sortedItems.push(introItem);
    sortedItems.push(...projectItems);
    if (outroItem) sortedItems.push(outroItem);
    
    items = sortedItems;
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    // Fallback to empty array if Notion fails
    items = [];
  }

  return <HomeClient items={items} />;
}
