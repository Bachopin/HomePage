'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MasonryCard from '@/components/MasonryCard';

// Sample data - replace with your actual content
const items = [
  { id: 1, title: 'Attention Lab', year: '2025', image: '/img1.jpg', size: '1x1' as const },
  { id: 2, title: 'Creative Project', year: '2024', image: '/img2.jpg', size: '1x2' as const },
  { id: 3, title: 'Design System', year: '2023', image: '/img3.jpg', size: '2x1' as const },
  { id: 4, title: 'Web Experience', year: '2024', image: '/img4.jpg', size: '1x1' as const },
  { id: 5, title: 'Mobile App', year: '2023', image: '/img5.jpg', size: '1x1' as const },
  { id: 6, title: 'Brand Identity', year: '2024', image: '/img6.jpg', size: '1x2' as const },
  { id: 7, title: 'Experimental', year: '2025', image: '/img7.jpg', size: '2x1' as const },
  { id: 8, title: 'Research Lab', year: '2024', image: '/img8.jpg', size: '1x1' as const },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 400, damping: 40 });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Map vertical scroll to horizontal movement
      const deltaX = e.deltaY;
      
      // Get current x value
      const currentX = x.get();
      
      // Calculate new x value (inverted for natural feel)
      const newX = currentX - deltaX;
      
      // Set bounds - calculate dynamically based on grid content
      const container = containerRef.current;
      if (container) {
        const gridElement = container.querySelector('[style*="grid"]') as HTMLElement;
        if (gridElement) {
          const contentWidth = gridElement.scrollWidth;
          const viewportWidth = window.innerWidth;
          const minX = Math.min(0, -(contentWidth - viewportWidth + 64)); // +64 for padding
          const maxX = 0;
          const clampedX = Math.max(minX, Math.min(maxX, newX));
          x.set(clampedX);
        } else {
          x.set(newX);
        }
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
      <Navigation />
      
      {/* Main Container - Fixed height, centered vertically */}
      <main className="h-[80vh] mt-[20vh] overflow-hidden">
        <div ref={containerRef} className="h-full overflow-hidden">
          <motion.div
            className="h-full"
            style={{ x: springX }}
          >
            {/* Horizontal Masonry Grid */}
            <div
              className="h-full px-8 inline-grid"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(2, 1fr)',
                gridAutoFlow: 'column',
                gap: '1.5rem',
                width: 'max-content',
              }}
            >
              {items.map((item) => (
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
