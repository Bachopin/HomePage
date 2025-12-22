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
  const scrollContainerRef = useRef<HTMLElement>(null); // Scroll container ref for container-based scrolling
  const [activeSection, setActiveSection] = useState<string>('All');
  const [windowWidth, setWindowWidth] = useState(1920); // Default width, will be updated on mount
  const [windowHeight, setWindowHeight] = useState(1080); // Default height, will be updated on mount
  const [baseScale, setBaseScale] = useState(1); // Base scale (kept at 1 to avoid width conflicts on mobile)

  // Dynamic width and height measurement with responsive scaling
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setWindowWidth(width);
      setWindowHeight(height);
      // Keep baseScale at 1 to allow full-width mobile cards without shrinking
      setBaseScale(1);
    };

    // Set initial values
    handleResize();
    
    window.addEventListener('resize', handleResize);
    
    const timeoutId = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [items.length]);

  // Use scroll progress with container-based scrolling
  // Track scroll progress (0 to 1) through the scroll container
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
  });

  // Stage 1: Scale transform - Map scrollYProgress [0, 0.05] -> scale [baseScale * 1.15, baseScale]
  const scale = useTransform(scrollYProgress, [0, 0.05], [baseScale * 1.15, baseScale]);
  const springScale = useSpring(scale, { stiffness: 400, damping: 40 });

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

  // Task 2: Switch to Absolute Positioning with Mobile-Responsive Layout
  // Grid simulator: Calculate absolute positions (top, left, width, height) for EVERY item
  const { cardPositions, categoryStartX, containerWidth } = useMemo(() => {
    const positions: CardPosition[] = [];
    const categoryStarts: Record<string, number> = {};
    const gap = 24; // 1.5rem
    
    // Determine layout mode
    const isMobile = windowWidth < 640;
    
    // Responsive column width:
    // - Desktop: fixed 300px
    // - Mobile: calculate so that two columns plus gap fit within screen width minus padding
    const mobilePadding = 32; // 16px each side
    const columnWidth = isMobile
      ? (windowWidth - mobilePadding - gap) / 2
      : 300;
    // Maintain square grid unit for all viewports
    const rowHeight = columnWidth;

    // Early return if no items
    if (!sortedItems || sortedItems.length === 0) {
      return { 
        cardPositions: positions,
        categoryStartX: categoryStarts,
        containerWidth: 0
      };
    }

    // Helper function to get card dimensions in grid units
    const getCardDimensions = (size: string): { rows: number; cols: number; width: number; height: number } => {
      // Standard grid logic for all viewports
      switch (size) {
        case '1x1': return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
        case '1x2': return { rows: 2, cols: 1, width: columnWidth, height: rowHeight * 2 + gap };
        case '2x1': return { rows: 1, cols: 2, width: columnWidth * 2 + gap, height: rowHeight };
        case '2x2': return { rows: 2, cols: 2, width: columnWidth * 2 + gap, height: rowHeight * 2 + gap };
        default: return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
      }
    };

    // Determine first and last item widths for asymmetric padding
    const firstItem = sortedItems[0];
    const lastItem = sortedItems[sortedItems.length - 1];
    const firstDims = firstItem ? getCardDimensions(firstItem.size || '1x1') : { width: columnWidth };
    const lastDims = lastItem ? getCardDimensions(lastItem.size || '1x1') : { width: columnWidth };

    // Asymmetric padding for perfect centering of first/last cards
    const paddingLeft = Math.max(24, (windowWidth - (firstDims as any).width) / 2);
    const paddingRight = Math.max(24, (windowWidth - (lastDims as any).width) / 2);

    // Grid occupancy map: 2 rows for both desktop and mobile
    const maxRows = 2;
    const occupied: boolean[][] = [];
    for (let i = 0; i < maxRows; i++) {
      occupied.push([]);
    }
    let maxColumn = -1;

    // Helper function to check if a position can fit a card
    const canFit = (startRow: number, startCol: number, rows: number, cols: number): boolean => {
      if (startRow + rows > maxRows) return false;
      
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
      
      // For mobile, force cols = 1
      const dims = getCardDimensions(item.size);
      const rows = dims.rows;
      const cols = isMobile ? 1 : dims.cols;
      const width = isMobile ? columnWidth : dims.width;
      const height = dims.height;
      
      // Find the first available position
      let placed = false;
      let startRow = 0;
      let startCol = 0;

      for (let col = 0; col <= Math.max(maxColumn + 1, 0); col++) {
        for (let row = 0; row <= maxRows - rows; row++) {
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
      const left = paddingLeft + startCol * (columnWidth + gap);
      const top = startRow * (rowHeight + gap);
      const centerX = left + width / 2;
      const right = left + width; // Right edge for container width calculation

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

    // Calculate container width: Find rightmost edge of last card + paddingRight
    let maxContentRightEdge = 0;
    positions.forEach((pos) => {
      const rightEdge = pos.left + pos.width;
      if (rightEdge > maxContentRightEdge) {
        maxContentRightEdge = rightEdge;
      }
    });
    
    // Container width = rightmost content edge + right padding
    const finalWidth = maxContentRightEdge + paddingRight;

    return {
      cardPositions: positions,
      categoryStartX: categoryStarts,
      containerWidth: finalWidth
    };
  }, [sortedItems, windowWidth]);

  // Stage 2: X transform - Map scrollYProgress [0.05, 1.0] -> x [0, maxScroll]
  // maxScroll calculated based on containerWidth: ensures last card centers perfectly at scroll 100%
  const maxScroll = containerWidth > windowWidth ? -(containerWidth - windowWidth) : 0;
  
  const x = useTransform(scrollYProgress, (latest) => {
    if (latest < 0.05) return 0;
    if (latest >= 1.0) return maxScroll;
    // Map progress from 0.05 to 1.0 to translateX from 0 to maxScroll
    const progress = (latest - 0.05) / (1.0 - 0.05); // Normalize to 0-1
    return progress * maxScroll;
  });
  const springX = useSpring(x, { stiffness: 400, damping: 40 });

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

  // Scroll to category function - uses percentage-based scrolling for responsive behavior
  const scrollToCategory = (category: string) => {
    try {
      if (category === 'All') {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
      
      // Map clampedTranslateX to scroll progress (0.0 to 1.0)
      // Horizontal scroll happens from progress 0.05 to 1.0
      // So: progress = 0.05 + (0.95 * normalizedTranslateX)
      const normalizedTranslateX = Math.abs(clampedTranslateX / maxScroll);
      const targetProgress = 0.05 + (normalizedTranslateX * 0.95); // Map to [0.05, 1.0]
      
      if (isNaN(targetProgress) || !isFinite(targetProgress)) {
        console.warn('Invalid progress calculation, cannot scroll.');
        return;
      }
      
      // Calculate target scroll position as percentage of container height
      if (!scrollContainerRef.current) {
        console.warn('Scroll container ref not available');
        return;
      }
      
      const containerHeight = scrollContainerRef.current.scrollHeight;
      const targetScrollY = containerHeight * targetProgress;
      
      if (!isNaN(targetScrollY) && containerHeight > 0) {
        scrollContainerRef.current.scrollTo({ top: targetScrollY, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error in scrollToCategory:', error);
    }
  };

  // Early return if no items
  if (!sortedItems || sortedItems.length === 0) {
    return (
      <main className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-stone-100 dark:bg-neutral-700 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No content available</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Please check your Notion database configuration.</p>
        </div>
      </main>
    );
  }

  return (
    <main 
      ref={scrollContainerRef}
      className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-stone-100 dark:bg-neutral-700 no-scrollbar"
    >
      <Navigation 
        activeSection={activeSection} 
        categories={categories}
        onNavClick={scrollToCategory}
      />
      
      {/* Scrollable Content Container - Large height for vertical scrolling */}
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
    </main>
  );
}
