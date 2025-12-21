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
  const [windowWidth, setWindowWidth] = useState(0);

  // Dynamic width measurement
  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current) {
        setContentWidth(contentRef.current.scrollWidth);
        setWindowWidth(window.innerWidth);
      }
    };

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

  // Precompute horizontal offsets for each category and card positions
  const { categoryOffsets, cardPositions } = useMemo(() => {
    const offsets: Record<string, number> = {};
    const positions: number[] = [];
    const gap = 24; // 1.5rem
    const introPadding = windowWidth ? windowWidth / 2 - 312 : 0;

    let currentX = introPadding;

    items.forEach((item, index) => {
      // Intro/Outro also occupy width
      const width = item.size === '2x1' || item.size === '2x2' ? 624 : 300;
      
      // Store card center position
      positions[index] = currentX + width / 2;

      if (item.type !== 'intro' && item.type !== 'outro' && item.category) {
        if (offsets[item.category] === undefined) {
          offsets[item.category] = currentX;
        }
      }

      currentX += width + gap;
    });

    return { categoryOffsets: offsets, cardPositions: positions };
  }, [items, windowWidth]);

  // Track active section based on x value using measured offsets
  useMotionValueEvent(springX, 'change', (latest) => {
    const absX = Math.abs(latest);

    const orderedCategories = categories.filter((c) => c !== 'All');
    if (!orderedCategories.length) {
      setActiveSection('All');
      return;
    }

    const list = orderedCategories
      .map((cat) => ({ cat, offset: categoryOffsets[cat] ?? Number.POSITIVE_INFINITY }))
      .filter((entry) => Number.isFinite(entry.offset))
      .sort((a, b) => a.offset - b.offset);

    if (!list.length) {
      setActiveSection('All');
      return;
    }

    let current = list[0].cat;
    for (const entry of list) {
      if (absX >= entry.offset) {
        current = entry.cat;
      } else {
        break;
      }
    }
    setActiveSection(current);
  });

  // Scroll to category function
  const scrollToCategory = (category: string) => {
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const targetX = categoryOffsets[category];
    if (targetX === undefined || targetX === Number.POSITIVE_INFINITY) return;

    // Calculate the target translateX value
    // The grid starts at introPadding (positive), and we need to move left (negative)
    // To center the category, we need: translateX = -(targetX - viewportCenter)
    const viewportCenter = windowWidth / 2;
    const targetTranslateX = -(targetX - viewportCenter);

    // Inverse map: find scrollY that produces this translateX
    // x maps scrollY [300, 4000] -> x [0, maxScroll]
    if (maxScroll === 0 || Math.abs(maxScroll) === 0) return;
    
    // targetTranslateX is negative (left), maxScroll is also negative
    // We want to find scrollY that makes x = targetTranslateX
    const progress = Math.abs(targetTranslateX / Math.abs(maxScroll));
    const targetScrollY = 300 + progress * (4000 - 300);
    
    window.scrollTo({ top: Math.min(Math.max(targetScrollY, 300), 4000), behavior: 'smooth' });
  };

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
