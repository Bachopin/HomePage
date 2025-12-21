'use client';

import { useState } from 'react';
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

// Generate items: Intro card first, then repeat base array
const allItems = [
  introCard,
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 1 })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 9, title: `${item.title} II` })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 17, title: `${item.title} III` })),
];

export default function Home() {
  const [activeSection, setActiveSection] = useState<'work' | 'lab' | 'life'>('work');

  // Use native scroll from framer-motion (page scroll)
  const { scrollY } = useScroll();

  // Stage 1: Scale transform - Map scrollY [0, 300] -> scale [1.15, 1]
  const scale = useTransform(scrollY, [0, 300], [1.15, 1]);
  const springScale = useSpring(scale, { stiffness: 100, damping: 20 });

  // Stage 2: X transform - Map scrollY [300, 3000] -> x [0, -2000]
  const x = useTransform(scrollY, [300, 3000], [0, -2000]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });

  // Opacity: Map scrollY [0, 100] -> opacity [0, 1] (smooth entry)
  const opacity = useTransform(scrollY, [0, 100], [0, 1]);
  const springOpacity = useSpring(opacity, { stiffness: 100, damping: 20 });

  // Track active section based on x value
  useMotionValueEvent(springX, 'change', (latest) => {
    if (latest > -1000) {
      setActiveSection('work');
    } else if (latest > -2000) {
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
              opacity: springOpacity,
            }}
          >
            {/* Horizontal Masonry Grid - Centered with dynamic padding */}
            <div
              className="h-full inline-grid"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(2, 300px)',
                gridAutoFlow: 'column',
                gap: '1.5rem',
                width: 'max-content',
                paddingLeft: 'calc(50vw - 312px)', // Center the intro card (624px width / 2)
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
