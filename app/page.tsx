'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, useMotionValueEvent } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MasonryCard from '@/components/MasonryCard';

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

// Generate 24-30 items by repeating the base array
const allItems = [
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 1 })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 9, title: `${item.title} II` })),
  ...baseItems.map((item, idx) => ({ ...item, id: idx + 17, title: `${item.title} III` })),
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 20, mass: 0.5 });
  const [activeSection, setActiveSection] = useState<'work' | 'lab' | 'life'>('work');

  // Scroll sync logic: Track x value changes
  useMotionValueEvent(springX, 'change', (latest) => {
    if (latest > -1000) {
      setActiveSection('work');
    } else if (latest > -2000) {
      setActiveSection('lab');
    } else {
      setActiveSection('life');
    }
  });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Map vertical scroll to horizontal movement with multiplier
      const deltaX = e.deltaY * 1.5;
      
      // Get current x value
      const currentX = x.get();
      
      // Calculate new x value (inverted for natural feel)
      const newX = currentX - deltaX;
      
      // Set bounds using gridRef
      if (gridRef.current) {
        const contentWidth = gridRef.current.scrollWidth;
        const viewportWidth = window.innerWidth;
        const minX = Math.min(0, -(contentWidth - viewportWidth + 64)); // +64 for padding
        const maxX = 0;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        x.set(clampedX);
      } else {
        x.set(newX);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [x]);

  return (
    <div className="h-screen overflow-hidden bg-stone-100 dark:bg-neutral-700">
      <Navigation activeSection={activeSection} />
      
      {/* Main Container - Fixed height: 640px */}
      <main className="h-[640px] mt-[20vh] overflow-hidden">
        <div ref={containerRef} className="h-full overflow-hidden">
          <motion.div
            className="h-full"
            style={{ x: springX }}
          >
            {/* Horizontal Masonry Grid */}
            <div
              ref={gridRef}
              className="h-full px-8 inline-grid"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(2, 300px)',
                gridAutoFlow: 'column',
                gap: '1.5rem', // gap-6 (24px)
                width: 'max-content',
              }}
            >
              {allItems.map((item) => (
                <MasonryCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  year={item.year}
                  image={item.image}
                  size={item.size}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
