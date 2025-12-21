'use client';

import { useState, useEffect, useRef } from 'react';
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

  // Track active section based on x value
  useMotionValueEvent(springX, 'change', (latest) => {
    if (categories.length <= 1) {
      setActiveSection('All');
      return;
    }
    
    // Divide scroll into sections based on number of categories
    const sectionCount = categories.length - 1; // Exclude 'All'
    const sectionSize = maxScroll / sectionCount;
    
    for (let i = sectionCount; i > 0; i--) {
      if (latest <= sectionSize * i) {
        setActiveSection(categories[i] || 'All');
        return;
      }
    }
    setActiveSection(categories[0] || 'All');
  });

  // Scroll to category function
  const scrollToCategory = (category: string) => {
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Find the index of the first card belonging to this category
    const categoryIndex = items.findIndex((item) => {
      if (item.type === 'intro' || item.type === 'outro') return false;
      return item.category === category;
    });

    if (categoryIndex === -1) return;

    // Calculate actual horizontal position by measuring card positions
    // We need to account for intro card padding and actual card widths
    if (!contentRef.current) return;

    // Get all card elements
    const cards = contentRef.current.children;
    if (categoryIndex >= cards.length) return;

    // Estimate horizontal distance: index * (card width + gap)
    // Account for intro card padding: calc(50vw - 312px)
    const cardWidth = 300;
    const gap = 24;
    const introPadding = typeof window !== 'undefined' ? window.innerWidth / 2 - 312 : 0;
    
    // Calculate target X position
    let targetX = introPadding;
    for (let i = 0; i < categoryIndex; i++) {
      const item = items[i];
      if (item.size === '2x1' || item.size === '2x2') {
        targetX += 624 + gap; // Wide cards
      } else {
        targetX += cardWidth + gap;
      }
    }

    // Inverse map: find scrollY that produces this translateX
    // x maps scrollY [300, 4000] -> x [0, maxScroll]
    // Formula: targetScrollY = 300 + (targetX / Math.abs(maxScroll)) * (4000 - 300)
    if (maxScroll === 0 || Math.abs(maxScroll) === 0) return;
    
    // targetX is positive (right), maxScroll is negative (left)
    // We want to find scrollY that makes x = -targetX (moving left)
    const targetXNegative = -targetX;
    const progress = Math.abs(targetXNegative / maxScroll);
    const targetScrollY = 300 + progress * (4000 - 300);
    
    window.scrollTo({ top: Math.min(targetScrollY, 4000), behavior: 'smooth' });
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
              {items.map((item) => (
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
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
