'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MasonryCard from '@/components/MasonryCard';

// Intro Card (Bio) - First item
const introCard = {
  id: 0,
  title: 'Attention Lab',
  year: '2025',
  description: 'Exploring the financialization of attention in the age of AI.',
  type: 'intro' as const,
  size: '2x2' as const,
  image: '', // Not used for intro cards
};

// Outro Card - Last item (symmetrical ending)
const outroCard = {
  id: 999,
  title: 'Get in Touch',
  year: '2025',
  description: 'Open for new collaborations.',
  type: 'intro' as const,
  size: '2x2' as const,
  image: '', // Not used for intro cards
};

// Base sample data with Unsplash URLs
const baseItems = [
  { 
    id: 1, 
    title: 'Attention Lab', 
    year: '2025', 
    image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2700&auto=format&fit=crop', 
    size: '1x1' as const 
  },
  { 
    id: 2, 
    title: 'Creative Project', 
    year: '2024', 
    image: 'https://images.unsplash.com/photo-1565514020176-db7933923051?q=80&w=2000&auto=format&fit=crop', 
    size: '1x2' as const 
  },
  { 
    id: 3, 
    title: 'Design System', 
    year: '2023', 
    image: 'https://images.unsplash.com/photo-1516886635086-2b3c42176d62?q=80&w=2000&auto=format&fit=crop', 
    size: '2x1' as const 
  },
  { 
    id: 4, 
    title: 'Web Experience', 
    year: '2024', 
    image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2000&auto=format&fit=crop', 
    size: '1x1' as const 
  },
  { 
    id: 5, 
    title: 'Mobile App', 
    year: '2023', 
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2000&auto=format&fit=crop', 
    size: '1x1' as const 
  },
  { 
    id: 6, 
    title: 'Brand Identity', 
    year: '2024', 
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2000&auto=format&fit=crop', 
    size: '1x2' as const 
  },
  { 
    id: 7, 
    title: 'Experimental', 
    year: '2025', 
    image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=2000&auto=format&fit=crop', 
    size: '2x1' as const 
  },
  { 
    id: 8, 
    title: 'Research Lab', 
    year: '2024', 
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2000&auto=format&fit=crop', 
    size: '1x1' as const 
  },
];

// Generate items: Intro card first, then repeat base array, outro card last
const allItems = [
  introCard,
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 1 })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 9, title: `${item.title} II` })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 17, title: `${item.title} III` })),
  outroCard,
];

export default function Home() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<'work' | 'lab' | 'life'>('work');
  const [contentWidth, setContentWidth] = useState(0);
  const [windowWidth, setWindowWidth] = useState(0);

  // Dynamic width measurement
  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current) {
        // Calculate total scrollable distance needed
        // We want the Final X to be: -(scrollWidth - viewportWidth)
        setContentWidth(contentRef.current.scrollWidth);
        setWindowWidth(window.innerWidth);
      }
    };

    // Initial measure & Window resize listener
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Also measure after a short delay to ensure content is rendered
    const timeoutId = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [allItems.length]); // Re-measure when items change

  // Use native scroll from framer-motion (page scroll)
  const { scrollY } = useScroll();

  // Stage 1: Scale transform - Map scrollY [0, 300] -> scale [1.15, 1]
  const scale = useTransform(scrollY, [0, 300], [1.15, 1]);
  const springScale = useSpring(scale, { stiffness: 100, damping: 20 });

  // Stage 2: X transform - Dynamic calculation based on content width
  // Map scrollY range [300, 4000] to the Calculated Horizontal Distance
  const maxScroll = contentWidth > windowWidth ? -(contentWidth - windowWidth) : 0;
  
  // Create transform with dynamic maxScroll value using callback
  const x = useTransform(scrollY, (latest) => {
    if (latest < 300) return 0;
    if (latest > 4000) return maxScroll;
    // Linear interpolation between 300 and 4000
    const progress = (latest - 300) / (4000 - 300);
    return progress * maxScroll;
  });
  const springX = useSpring(x, { stiffness: 100, damping: 20 });

  // Track active section based on x value
  useMotionValueEvent(springX, 'change', (latest) => {
    const third = maxScroll / 3;
    if (latest > third) {
      setActiveSection('work');
    } else if (latest > third * 2) {
      setActiveSection('lab');
    } else {
      setActiveSection('life');
    }
  });

  return (
    <div className="bg-stone-100 dark:bg-neutral-700 no-scrollbar">
      <Navigation activeSection={activeSection} />
      
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
                paddingLeft: 'calc(50vw - 312px)', // Center the intro card (624px width / 2)
                paddingRight: 'calc(50vw - 312px)', // Center the final card for perfect symmetry
              }}
            >
              {allItems.map((item) => (
                <MasonryCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  year={item.year}
                  description={(item as any).description}
                  image={item.image}
                  size={item.size}
                  type={(item as any).type}
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
