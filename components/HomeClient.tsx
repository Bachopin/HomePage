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

  // Grid simulator: Calculate card positions in a 2-row grid layout
  // This simulates CSS grid-auto-flow: column behavior (fills columns top-to-bottom, then moves to next column)
  const { categoryOffsets, cardPositions, cardLeftEdges, cardWidths } = useMemo(() => {
    const offsets: Record<string, number> = {};
    const positions: number[] = [];
    const leftEdges: number[] = [];
    const widths: number[] = [];
    const gap = 24; // 1.5rem
    const columnWidth = 300; // Base column width
    // Calculate intro padding safely (windowWidth should be set by useEffect on client)
    const introPadding = (windowWidth && windowWidth > 0) ? windowWidth / 2 - 312 : 0;

    // Early return if no items
    if (!items || items.length === 0) {
      return { categoryOffsets: offsets, cardPositions: positions, cardLeftEdges: leftEdges, cardWidths: widths };
    }

    // Grid occupancy map: 2 rows, dynamically expanding columns
    // occupied[row][column] = true if that cell is occupied
    const occupied: boolean[][] = [[], []]; // [row0, row1]
    let maxColumn = -1;

    // Helper function to get card dimensions in grid units
    const getCardDimensions = (size: string): { rows: number; cols: number; width: number } => {
      switch (size) {
        case '1x1': return { rows: 1, cols: 1, width: columnWidth };
        case '1x2': return { rows: 2, cols: 1, width: columnWidth };
        case '2x1': return { rows: 1, cols: 2, width: columnWidth * 2 + gap };
        case '2x2': return { rows: 2, cols: 2, width: columnWidth * 2 + gap };
        default: return { rows: 1, cols: 1, width: columnWidth };
      }
    };

    // Helper function to check if a position can fit a card
    const canFit = (startRow: number, startCol: number, rows: number, cols: number): boolean => {
      // Check if out of bounds
      if (startRow + rows > 2) return false;
      
      // Check all cells that would be occupied
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
    // CSS grid-auto-flow: column behavior:
    // - Fills columns first (top-to-bottom within each column)
    // - Then moves to the next column
    // - For multi-column items, they span from their start column
    items.forEach((item, index) => {
      // Safety check: ensure item.size is valid
      if (!item || !item.size) {
        console.warn(`Item at index ${index} has invalid size:`, item);
        return; // Skip invalid items
      }
      
      const { rows, cols, width } = getCardDimensions(item.size);
      
      // Find the first available position
      // Search column by column (left to right), row by row within each column (top to bottom)
      let placed = false;
      let startRow = 0;
      let startCol = 0;

      // Start from column 0, check each column
      // For each column, check rows from top (0) to bottom (2-rows)
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

      // If still not placed (shouldn't happen, but safety), place at next column
      if (!placed) {
        startCol = maxColumn + 1;
        startRow = 0;
        placed = true;
      }

      // Mark cells as occupied
      markOccupied(startRow, startCol, rows, cols);

      // Calculate actual pixel positions based on column position
      // Each column is columnWidth wide, with gap between columns
      // For multi-column items (2x1, 2x2), they span 2 columns, so width includes gap
      const leftEdge = introPadding + startCol * (columnWidth + gap);
      const centerX = leftEdge + width / 2;

      // Store positions
      leftEdges[index] = leftEdge;
      positions[index] = centerX;
      widths[index] = width;

      // Track category offsets (first card of each category)
      if (item.type !== 'intro' && item.type !== 'outro' && item.category) {
        if (offsets[item.category] === undefined) {
          offsets[item.category] = leftEdge;
        }
      }
    });

    return { categoryOffsets: offsets, cardPositions: positions, cardLeftEdges: leftEdges, cardWidths: widths };
  }, [items, windowWidth]);

  // Track active section based on card center passing through viewport center (crosshair position)
  // Since items are sorted, the first card in each category is the one with lowest sort value
  useMotionValueEvent(springX, 'change', (latest) => {
    // Safety checks: ensure we have valid data
    if (!items || items.length === 0 || !cardPositions || cardPositions.length === 0) {
      setActiveSection('All');
      return;
    }

    // If at the start (springX >= 0), show 'All'
    if (latest >= 0) {
      setActiveSection('All');
      return;
    }

    // Ensure windowWidth is valid
    if (!windowWidth || windowWidth <= 0) {
      setActiveSection('All');
      return;
    }

    const viewportCenter = windowWidth / 2; // Crosshair position (center of viewport)
    
    // Calculate which category's first card (lowest sort) has its center closest to viewport center
    // latest is negative (content moving left), so card position = cardAbsoluteX + latest
    let activeCategory = 'All';
    let closestCategory = 'All';
    let minDistance = Infinity;
    
    // Get ordered categories (excluding 'All' - it's a virtual tab)
    const orderedCategories = categories.filter((c) => c !== 'All');
    if (!orderedCategories.length) {
      setActiveSection('All');
      return;
    }

    // For each category, find the first card (which is already sorted - lowest sort comes first)
    orderedCategories.forEach((category) => {
      let targetCardIndex = -1;

      // Find the first card in this category (already sorted by sort value)
      items.forEach((item, index) => {
        if (item.type === 'intro' || item.type === 'outro') return;
        if (!item.category) return;
        
        const itemCategory = item.category.trim();
        const targetCategory = category.trim();
        if (itemCategory !== targetCategory) return;

        // Since items are already sorted, the first matching card is the one with lowest sort
        if (targetCardIndex === -1) {
          targetCardIndex = index;
        }
      });

      if (targetCardIndex === -1) return;

      const cardCenterX = cardPositions[targetCardIndex];
      if (cardCenterX === undefined) return;

      // Calculate current card center position (accounting for scroll transform)
      const cardCurrentCenterX = cardCenterX + latest; // latest is negative
      
      // Calculate distance from card center to viewport center
      // Use absolute distance to find the closest card to center
      const distance = Math.abs(cardCurrentCenterX - viewportCenter);
      
      // Track the category whose card center is closest to viewport center
      if (distance < minDistance) {
        minDistance = distance;
        closestCategory = category;
      }
    });

    // Use the closest category, or 'All' if none found
    if (closestCategory !== 'All') {
      activeCategory = closestCategory;
    } else if (orderedCategories.length > 0) {
      // If no category found yet, check if we're at the very end
      // In that case, select the last category
      const lastCategory = orderedCategories[orderedCategories.length - 1];
      let targetCardIndex = -1;

      // Find the first card in the last category (already sorted)
      items.forEach((item, index) => {
        if (item.type === 'intro' || item.type === 'outro') return;
        if (!item.category) return;
        
        const itemCategory = item.category.trim();
        if (itemCategory !== lastCategory.trim()) return;

        // Since items are already sorted, the first matching card is the one with lowest sort
        if (targetCardIndex === -1) {
          targetCardIndex = index;
        }
      });
      
      if (targetCardIndex !== -1) {
        const cardCenterX = cardPositions[targetCardIndex];
        if (cardCenterX !== undefined) {
          const cardCurrentCenterX = cardCenterX + latest;
          // If the last category's card center has passed center, select it
          if (cardCurrentCenterX < viewportCenter) {
            activeCategory = lastCategory;
          }
        }
      }
    }

    setActiveSection(activeCategory);
  });

  // Scroll to category function - align card center to viewport center (crosshair position)
  // Jump to the first card of the category (which is the one with lowest sort value, since items are sorted)
  const scrollToCategory = (category: string) => {
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Safety checks
    if (!items || items.length === 0 || !cardPositions || cardPositions.length === 0) {
      console.warn('Cannot scroll: missing items or cardPositions');
      return;
    }

    if (!windowWidth || windowWidth <= 0) {
      console.warn('Cannot scroll: invalid windowWidth');
      return;
    }

    // Find the first card belonging to this category (anchor card with lowest sort value)
    // Since items are already sorted by sort value, the first matching card is the target
    let firstCardIndex = -1;

    items.forEach((item, index) => {
      if (item.type === 'intro' || item.type === 'outro') return;
      if (!item.category) return;
      
      const itemCategory = item.category.trim();
      const targetCategory = category.trim();
      if (itemCategory !== targetCategory) return;
      
      // Since items are already sorted, the first matching card is the one with lowest sort (anchor card)
      if (firstCardIndex === -1) {
        firstCardIndex = index;
      }
    });

    if (firstCardIndex === -1) {
      // Debug: Log all available categories and items
      const availableCategories = [...new Set(items.filter(i => i.type === 'project' && i.category).map(i => i.category))];
      console.warn(`No card found for category: "${category}"`);
      console.log('Available categories:', availableCategories);
      console.log('All project items:', items.filter(i => i.type === 'project').map((item, idx) => ({
        index: idx,
        title: item.title,
        category: item.category,
        categoryTrimmed: item.category?.trim(),
        sort: item.sort
      })));
      return;
    }

    const firstCardCenterX = cardPositions[firstCardIndex];
    if (firstCardCenterX === undefined) {
      console.warn(`Card center position undefined for index: ${firstCardIndex}, card:`, items[firstCardIndex]);
      return;
    }

    // Calculate the target translateX value to align card center to viewport center (crosshair)
    // cardPositions[index] is the absolute position of card center (relative to page left)
    // When springX = 0, card center is at cardPositions[index]
    // When springX = -100, card moves left by 100px, so card center is at cardPositions[index] - 100
    // We want: cardPositions[index] + springX = viewportCenter
    // So: springX = viewportCenter - cardPositions[index]
    const viewportCenter = windowWidth / 2; // Crosshair position
    const targetTranslateX = viewportCenter - firstCardCenterX;

    // Inverse map: find scrollY that produces this translateX
    // x maps scrollY [300, 4000] -> x [0, maxScroll]
    // Formula: x = (scrollY - 300) / (4000 - 300) * maxScroll
    // Solving for scrollY: scrollY = 300 + (x / maxScroll) * (4000 - 300)
    if (maxScroll === 0 || Math.abs(maxScroll) === 0) {
      console.warn('Max scroll is 0, cannot scroll');
      return;
    }
    
    // targetTranslateX is what we want springX to be
    // If targetTranslateX is positive, card is to the left, we can't scroll right (springX can only be negative)
    // If targetTranslateX is negative, card is to the right, we can scroll left
    // Clamp targetTranslateX to valid range [maxScroll, 0]
    const clampedTranslateX = Math.max(Math.min(targetTranslateX, 0), maxScroll);
    
    // Map clampedTranslateX to scrollY
    // Since maxScroll is negative, we need: progress = clampedTranslateX / maxScroll
    // But clampedTranslateX is also negative, so progress will be positive
    const progress = Math.abs(clampedTranslateX / maxScroll);
    const targetScrollY = 300 + progress * (4000 - 300);
    
    // Clamp to valid scroll range
    const clampedScrollY = Math.min(Math.max(targetScrollY, 300), 4000);
    
    window.scrollTo({ top: clampedScrollY, behavior: 'smooth' });
  };

  // Early return if no items (should not happen, but safety check)
  if (!items || items.length === 0) {
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
            className="h-[640px] w-full"
            style={{
              scale: springScale,
              x: springX,
            }}
          >
            {/* Horizontal Masonry Grid - Centered with dynamic padding */}
            <div
              ref={contentRef}
              className="h-full inline-grid"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(2, 300px)',
                gridAutoFlow: 'column',
                gap: '1.5rem',
                width: 'max-content',
                paddingLeft: 'calc(50vw - 312px)',
                paddingRight: 'calc(50vw - 312px)',
              }}
            >
              {items.map((item, index) => (
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
                  totalCards={items.length}
                  cardPosition={cardPositions[index]}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
