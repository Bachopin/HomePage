'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MasonryCard from '@/components/MasonryCard';
import { NotionItem } from '@/lib/notion';

interface HomeClientProps {
  items: NotionItem[];
  categories?: string[];
}

interface CardPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  centerX: number;
}

export default function HomeClient({ items, categories = ['All', 'Work', 'Lab', 'Life'] }: HomeClientProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('All');
  const [contentWidth, setContentWidth] = useState(0);
  const [windowWidth, setWindowWidth] = useState(1920); // Default width, will be updated on mount

  // Dynamic width measurement
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      if (contentRef.current) {
        setContentWidth(contentRef.current.scrollWidth);
        setWindowWidth(window.innerWidth);
      }
    };

    // Set initial width
    setWindowWidth(window.innerWidth);
    handleResize();
    
    window.addEventListener('resize', handleResize);
    
    const timeoutId = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [items.length]);

  // Use native scroll from framer-motion (page scroll)
  const { scrollY } = useScroll();

  // Stage 1: Scale transform - Map scrollY [0, 300] -> scale [1.15, 1]
  const scale = useTransform(scrollY, [0, 300], [1.15, 1]);
  const springScale = useSpring(scale, { stiffness: 400, damping: 40 });

  // Stage 2: X transform - Dynamic calculation based on content width
  const maxScroll = contentWidth > windowWidth ? -(contentWidth - windowWidth) : 0;
  
  const x = useTransform(scrollY, (latest) => {
    if (latest < 300) return 0;
    if (latest > 4000) return maxScroll;
    const progress = (latest - 300) / (4000 - 300);
    return progress * maxScroll;
  });
  const springX = useSpring(x, { stiffness: 400, damping: 40 });

  // Task 1: Sort Items (Critical)
  // Sort logic: Map each item's category to the index in the categories prop
  // Primary Sort: Category Index (ascending)
  // Secondary Sort: item.sort (ascending)
  // Tertiary Sort: item.year (descending)
  const sortedItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    // Create a map of category to index for O(1) lookup
    const categoryIndexMap = new Map<string, number>();
    categories.forEach((cat, idx) => {
      if (cat !== 'All') {
        categoryIndexMap.set(cat, idx);
      }
    });

    // Sort items
    return [...items].sort((a, b) => {
      // Handle intro/outro items (always at start/end)
      if (a.type === 'intro' && b.type !== 'intro') return -1;
      if (a.type !== 'intro' && b.type === 'intro') return 1;
      if (a.type === 'outro' && b.type !== 'outro') return 1;
      if (a.type !== 'outro' && b.type === 'outro') return -1;
      
      // Both are projects or both are intro/outro
      if (a.type === 'project' && b.type === 'project') {
        const catA = a.category || '';
        const catB = b.category || '';
        
        // Primary: Category Index
        const idxA = categoryIndexMap.get(catA) ?? Infinity;
        const idxB = categoryIndexMap.get(catB) ?? Infinity;
        
        if (idxA !== idxB) {
          return idxA - idxB;
        }
        
        // Secondary: Sort field (ascending)
        const sortA = a.sort ?? Infinity;
        const sortB = b.sort ?? Infinity;
        
        if (sortA !== sortB) {
          return sortA - sortB;
        }
        
        // Tertiary: Year (descending)
        const yearA = parseInt(a.year || '0', 10) || 0;
        const yearB = parseInt(b.year || '0', 10) || 0;
        
        return yearB - yearA;
      }
      
      // Maintain relative order for intro/outro
      return 0;
    });
  }, [items, categories]);

  // Task 2: Switch to Absolute Positioning
  // Grid simulator: Calculate absolute positions (top, left, width, height) for EVERY item
  const { cardPositions, categoryStartX, containerWidth } = useMemo(() => {
    const positions: CardPosition[] = [];
    const categoryStarts: Record<string, number> = {};
    const gap = 24; // 1.5rem
    const columnWidth = 300; // Base column width
    const rowHeight = 300; // Base row height
    const introPadding = (windowWidth && windowWidth > 0) ? windowWidth / 2 - 312 : 0;

    // Early return if no items
    if (!sortedItems || sortedItems.length === 0) {
      return { 
        cardPositions: positions,
        categoryStartX: categoryStarts,
        containerWidth: 0
      };
    }

    // Grid occupancy map: 2 rows, dynamically expanding columns
    const occupied: boolean[][] = [[], []]; // [row0, row1]
    let maxColumn = -1;

    // Helper function to get card dimensions in grid units
    const getCardDimensions = (size: string): { rows: number; cols: number; width: number; height: number } => {
      switch (size) {
        case '1x1': return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
        case '1x2': return { rows: 2, cols: 1, width: columnWidth, height: rowHeight * 2 + gap };
        case '2x1': return { rows: 1, cols: 2, width: columnWidth * 2 + gap, height: rowHeight };
        case '2x2': return { rows: 2, cols: 2, width: columnWidth * 2 + gap, height: rowHeight * 2 + gap };
        default: return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
      }
    };

    // Helper function to check if a position can fit a card
    const canFit = (startRow: number, startCol: number, rows: number, cols: number): boolean => {
      if (startRow + rows > 2) return false;
      
      for (let r = startRow; r < startRow + rows; r++) {
        for (let c = startCol; c < startCol + cols; c++) {
          if (occupied[r][c] === true) {
            return false;
          }
        }
      }
      return true;
    };

    // Helper function to mark cells as occupied
    const markOccupied = (startRow: number, startCol: number, rows: number, cols: number): void => {
      for (let r = startRow; r < startRow + rows; r++) {
        for (let c = startCol; c < startCol + cols; c++) {
          occupied[r][c] = true;
        }
      }
      maxColumn = Math.max(maxColumn, startCol + cols - 1);
    };

    // Place each card in the grid
    sortedItems.forEach((item, index) => {
      if (!item || !item.size) {
        console.warn(`Item at index ${index} has invalid size:`, item);
        return;
      }
      
      const { rows, cols, width, height } = getCardDimensions(item.size);
      
      // Find the first available position
      let placed = false;
      let startRow = 0;
      let startCol = 0;

      for (let col = 0; col <= Math.max(maxColumn + 1, 0); col++) {
        for (let row = 0; row <= 2 - rows; row++) {
          if (canFit(row, col, rows, cols)) {
            startRow = row;
            startCol = col;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed) {
        startCol = maxColumn + 1;
        startRow = 0;
        placed = true;
      }

      markOccupied(startRow, startCol, rows, cols);

      // Calculate absolute positions
      const left = introPadding + startCol * (columnWidth + gap);
      const top = startRow * (rowHeight + gap);
      const centerX = left + width / 2;

      positions[index] = {
        top,
        left,
        width,
        height,
        centerX
      };

      // Track category start positions (left edge of first card in category)
      if (item.type === 'project' && item.category) {
        if (categoryStarts[item.category] === undefined) {
          categoryStarts[item.category] = left;
        }
      }
    });

    // Calculate container width
    const finalWidth = introPadding * 2 + (maxColumn + 1) * (columnWidth + gap) - gap;

    return {
      cardPositions: positions,
      categoryStartX: categoryStarts,
      containerWidth: finalWidth
    };
  }, [sortedItems, windowWidth]);

  // Update contentWidth when containerWidth changes
  useEffect(() => {
    if (containerWidth > 0) {
      setContentWidth(containerWidth);
    }
  }, [containerWidth]);

  // Task 3: Robust Scroll Spy & Navigation
  // Use ranges, not centers: Active Category is where currentScrollX >= categoryStartX AND currentScrollX < nextCategoryStartX
  // End-of-Scroll Override: If currentScrollX is within 50px of maxScroll, FORCE the active section to be the LAST category
  useMotionValueEvent(springX, 'change', (latest) => {
    try {
      if (!categoryStartX || Object.keys(categoryStartX).length === 0) {
        setActiveSection('All');
        return;
      }

      // If at the start (springX >= 0), show 'All'
      if (latest >= 0 || isNaN(latest)) {
        setActiveSection('All');
        return;
      }

      if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
        setActiveSection('All');
        return;
      }

      // End-of-Scroll Override: If within 50px of maxScroll, force last category
      const scrollThreshold = 50;
      if (Math.abs(latest - maxScroll) < scrollThreshold) {
        const orderedCategories = categories.filter((c) => c !== 'All');
        if (orderedCategories.length > 0) {
          setActiveSection(orderedCategories[orderedCategories.length - 1]);
          return;
        }
      }

      // Range-based logic: Find which category's range contains the current scroll position
      // latest is negative (content moving left), so to find what absolute position is at viewport center:
      // If a card is at absolute position X, and springX = latest, the card's visible position is X + latest
      // We want to find which category's start position, when transformed by latest, is at viewport center
      // So: categoryStartX + latest = viewportCenter
      // Therefore: categoryStartX = viewportCenter - latest
      // But we need to check ranges, so we check if viewportCenter - latest is within a category's range
      const viewportCenter = windowWidth / 2;
      // The absolute position currently visible at viewport center
      const absoluteXAtViewportCenter = viewportCenter - latest;

      const orderedCategories = categories.filter((c) => c !== 'All');
      if (orderedCategories.length === 0) {
        setActiveSection('All');
        return;
      }

      // Find the active category based on ranges
      let activeCategory = 'All';

      for (let i = 0; i < orderedCategories.length; i++) {
        const category = orderedCategories[i];
        const categoryStart = categoryStartX[category];

        if (categoryStart === undefined || isNaN(categoryStart)) {
          continue;
        }

        // Check if this is the last category
        if (i === orderedCategories.length - 1) {
          // Last category: active if absoluteXAtViewportCenter >= categoryStart
          if (absoluteXAtViewportCenter >= categoryStart) {
            activeCategory = category;
            break;
          }
        } else {
          // Not last category: find next category's start
          const nextCategory = orderedCategories[i + 1];
          const nextCategoryStart = categoryStartX[nextCategory];

          if (nextCategoryStart !== undefined && !isNaN(nextCategoryStart)) {
            // Active if absoluteXAtViewportCenter >= categoryStart AND absoluteXAtViewportCenter < nextCategoryStart
            if (absoluteXAtViewportCenter >= categoryStart && absoluteXAtViewportCenter < nextCategoryStart) {
              activeCategory = category;
              break;
            }
          } else {
            // If next category has no start, this category is active if absoluteXAtViewportCenter >= categoryStart
            if (absoluteXAtViewportCenter >= categoryStart) {
              activeCategory = category;
            }
          }
        }
      }

      setActiveSection(activeCategory);
    } catch (error) {
      console.error('Error in useMotionValueEvent:', error);
      setActiveSection('All');
    }
  });

  // Scroll to category function - clamp target scroll value so it doesn't exceed maxScroll
  const scrollToCategory = (category: string) => {
    try {
      if (category === 'All') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (!categoryStartX || Object.keys(categoryStartX).length === 0) {
        console.warn('Cannot scroll: missing categoryStartX');
        return;
      }

      if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
        console.warn('Cannot scroll: invalid windowWidth');
        return;
      }

      const categoryStart = categoryStartX[category.trim()];
      
      if (categoryStart === undefined || isNaN(categoryStart)) {
        const availableCategories = Object.keys(categoryStartX);
        console.warn(`No start position found for category: "${category}"`);
        console.log('Available categories:', availableCategories);
        return;
      }

      // Calculate target: align category start to viewport center
      // When springX = targetTranslateX, the card at categoryStart will be at:
      // categoryStart + targetTranslateX = viewportCenter
      // So: targetTranslateX = viewportCenter - categoryStart
      const viewportCenter = windowWidth / 2;
      const targetTranslateX = viewportCenter - categoryStart;

      // Clamp targetTranslateX to valid range [maxScroll, 0]
      const clampedTranslateX = Math.max(Math.min(targetTranslateX, 0), maxScroll);
      
      // Defensive check: Ensure maxScroll is valid
      if (maxScroll === 0 || Math.abs(maxScroll) < 0.001 || isNaN(maxScroll)) {
        console.warn('Max scroll is 0 or invalid, cannot scroll. maxScroll:', maxScroll);
        return;
      }
      
      // Map clampedTranslateX to scrollY
      const progress = Math.abs(clampedTranslateX / maxScroll);
      if (isNaN(progress) || !isFinite(progress)) {
        console.warn('Invalid progress calculation, cannot scroll.');
        return;
      }
      
      const targetScrollY = 300 + progress * (4000 - 300);
      
      // Clamp to valid scroll range
      const clampedScrollY = Math.min(Math.max(targetScrollY, 300), 4000);
      
      if (!isNaN(clampedScrollY)) {
        window.scrollTo({ top: clampedScrollY, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error in scrollToCategory:', error);
    }
  };

  // Early return if no items
  if (!sortedItems || sortedItems.length === 0) {
    return (
      <div className="bg-stone-100 dark:bg-neutral-700 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No content available</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Please check your Notion database configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-100 dark:bg-neutral-700 no-scrollbar">
      <Navigation 
        activeSection={activeSection} 
        categories={categories}
        onNavClick={scrollToCategory}
      />
      
      {/* Scrollable Container - Large height for vertical scrolling */}
      <div className="h-[400vh] no-scrollbar">
        {/* Fixed Viewport Container */}
        <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
          <motion.div
            className="h-[640px] w-full relative"
            style={{
              scale: springScale,
              x: springX,
            }}
          >
            {/* Absolute Positioned Container */}
            <div
              ref={contentRef}
              className="relative h-full"
              style={{
                width: `${containerWidth}px`,
                minWidth: `${containerWidth}px`,
              }}
            >
              {sortedItems.map((item, index) => {
                const position = cardPositions[index];
                if (!position) return null;

                return (
                  <MasonryCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    year={item.year}
                    description={item.description}
                    image={item.image}
                    size={item.size}
                    type={item.type}
                    link={item.link}
                    scrollProgress={springX}
                    cardIndex={index}
                    totalCards={sortedItems.length}
                    cardPosition={position.centerX}
                    absolutePosition={{
                      top: position.top,
                      left: position.left,
                      width: position.width,
                      height: position.height,
                    }}
                  />
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
