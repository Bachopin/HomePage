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
  // Also pre-calculates categoryAnchorPositions for O(1) lookup during scroll
  const { categoryOffsets, cardPositions, cardLeftEdges, cardWidths, categoryAnchorPositions } = useMemo(() => {
    const offsets: Record<string, number> = {};
    const positions: number[] = [];
    const leftEdges: number[] = [];
    const widths: number[] = [];
    const anchorPositions: Record<string, number> = {}; // Map: category -> centerX of first card (lowest sort)
    const gap = 24; // 1.5rem
    const columnWidth = 300; // Base column width
    // Calculate intro padding safely (windowWidth should be set by useEffect on client)
    const introPadding = (windowWidth && windowWidth > 0) ? windowWidth / 2 - 312 : 0;

    // Early return if no items
    if (!items || items.length === 0) {
      return { 
        categoryOffsets: offsets, 
        cardPositions: positions, 
        cardLeftEdges: leftEdges, 
        cardWidths: widths,
        categoryAnchorPositions: anchorPositions
      };
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

      // Track category offsets (first card of each category) - using leftEdge
      if (item.type !== 'intro' && item.type !== 'outro' && item.category) {
        if (offsets[item.category] === undefined) {
          offsets[item.category] = leftEdge;
        }
      }

      // Track category anchor positions (centerX of first card with lowest sort) - using centerX
      // Since items are already sorted by sort value within each category,
      // the first card we encounter for a category is the anchor card
      if (item.type !== 'intro' && item.type !== 'outro' && item.category) {
        if (anchorPositions[item.category] === undefined) {
          anchorPositions[item.category] = centerX;
        }
      }
    });

    return { 
      categoryOffsets: offsets, 
      cardPositions: positions, 
      cardLeftEdges: leftEdges, 
      cardWidths: widths,
      categoryAnchorPositions: anchorPositions
    };
  }, [items, windowWidth]);

  // Track active section based on card center passing through viewport center (crosshair position)
  // Optimized: Uses pre-calculated categoryAnchorPositions for O(1) lookup instead of nested loops
  useMotionValueEvent(springX, 'change', (latest) => {
    try {
      // Safety checks: ensure we have valid data
      // Allow empty categoryAnchorPositions during initial render - just set to 'All'
      if (!categoryAnchorPositions || Object.keys(categoryAnchorPositions).length === 0) {
        setActiveSection('All');
        return;
      }

      // If at the start (springX >= 0), show 'All'
      if (latest >= 0 || isNaN(latest)) {
        setActiveSection('All');
        return;
      }

      // Ensure windowWidth is valid
      if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
        setActiveSection('All');
        return;
      }

      const viewportCenter = windowWidth / 2; // Crosshair position (center of viewport)
      
      // O(1) lookup: Use pre-calculated categoryAnchorPositions to find closest category
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

      // O(n) iteration over categories (typically 3-5 categories), not O(n*m) over items
      for (const category of orderedCategories) {
        try {
          const anchorCenterX = categoryAnchorPositions[category];
          
          // Skip if anchor position not found
          if (anchorCenterX === undefined || isNaN(anchorCenterX)) {
            continue;
          }

          // Calculate current anchor card center position (accounting for scroll transform)
          const cardCurrentCenterX = anchorCenterX + latest; // latest is negative
          
          // Calculate distance from anchor card center to viewport center
          const distance = Math.abs(cardCurrentCenterX - viewportCenter);
          
          // Track the category whose anchor card center is closest to viewport center
          if (distance < minDistance && !isNaN(distance)) {
            minDistance = distance;
            closestCategory = category;
          }
        } catch (err) {
          // Silently skip this category if there's an error
          console.warn('Error processing category:', category, err);
        }
      }

      // Use the closest category, or 'All' if none found
      if (closestCategory !== 'All') {
        activeCategory = closestCategory;
      } else if (orderedCategories.length > 0) {
        // If no category found yet, check if we're at the very end
        // In that case, select the last category
        try {
          const lastCategory = orderedCategories[orderedCategories.length - 1];
          const lastAnchorCenterX = categoryAnchorPositions[lastCategory];
          
          if (lastAnchorCenterX !== undefined && !isNaN(lastAnchorCenterX)) {
            const cardCurrentCenterX = lastAnchorCenterX + latest;
            // If the last category's anchor card center has passed center, select it
            if (cardCurrentCenterX < viewportCenter && !isNaN(cardCurrentCenterX)) {
              activeCategory = lastCategory;
            }
          }
        } catch (err) {
          // Fallback to 'All' if there's an error
          console.warn('Error processing last category:', err);
        }
      }

      setActiveSection(activeCategory);
    } catch (error) {
      // Catch any unexpected errors and prevent component crash
      console.error('Error in useMotionValueEvent:', error);
      setActiveSection('All');
    }
  });

  // Scroll to category function - align card center to viewport center (crosshair position)
  // Optimized: Uses pre-calculated categoryAnchorPositions for O(1) lookup
  const scrollToCategory = (category: string) => {
    try {
      if (category === 'All') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Safety checks
      if (!categoryAnchorPositions || Object.keys(categoryAnchorPositions).length === 0) {
        console.warn('Cannot scroll: missing categoryAnchorPositions');
        return;
      }

      if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
        console.warn('Cannot scroll: invalid windowWidth');
        return;
      }

      // O(1) lookup: Get the anchor card center position for this category
      const firstCardCenterX = categoryAnchorPositions[category.trim()];
      
      if (firstCardCenterX === undefined || isNaN(firstCardCenterX)) {
        // Debug: Log all available categories
        const availableCategories = Object.keys(categoryAnchorPositions);
        console.warn(`No anchor position found for category: "${category}"`);
        console.log('Available categories:', availableCategories);
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
      
      // Defensive check: Ensure maxScroll is never 0 when used as a divisor
      if (maxScroll === 0 || Math.abs(maxScroll) < 0.001 || isNaN(maxScroll)) {
        console.warn('Max scroll is 0 or invalid, cannot scroll. maxScroll:', maxScroll);
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
      // Additional safety: Check for division by zero or invalid values
      if (Math.abs(maxScroll) < 0.001) {
        console.warn('Max scroll too small for division, cannot scroll');
        return;
      }
      
      const progress = Math.abs(clampedTranslateX / maxScroll);
      if (isNaN(progress) || !isFinite(progress)) {
        console.warn('Invalid progress calculation, cannot scroll. progress:', progress, 'clampedTranslateX:', clampedTranslateX, 'maxScroll:', maxScroll);
        return;
      }
      
      const targetScrollY = 300 + progress * (4000 - 300);
      
      // Clamp to valid scroll range
      const clampedScrollY = Math.min(Math.max(targetScrollY, 300), 4000);
      
      if (!isNaN(clampedScrollY)) {
        window.scrollTo({ top: clampedScrollY, behavior: 'smooth' });
      }
    } catch (error) {
      // Catch any unexpected errors and prevent component crash
      console.error('Error in scrollToCategory:', error);
    }
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
