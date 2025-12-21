'use client';

import { useState, useEffect } from 'react';
import { motion, MotionValue, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

interface MasonryCardProps {
  id: number | string;
  title: string;
  year: string;
  image: string;
  size: '1x1' | '1x2' | '2x1' | '2x2';
  link?: string;
  scrollProgress?: MotionValue<number>;
  type?: 'intro' | 'project' | 'outro';
  description?: string;
}

export default function MasonryCard({ 
  id, 
  title, 
  year, 
  image, 
  size, 
  link = '#',
  scrollProgress,
  type = 'project',
  description
}: MasonryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Map size prop to grid area and dimensions
  const sizeConfig = {
    '1x1': { gridArea: 'row-span-1 col-span-1', width: '300px' },
    '1x2': { gridArea: 'row-span-2 col-span-1', width: '300px' },
    '2x1': { gridArea: 'row-span-1 col-span-2', width: '624px' }, // 300*2 + 24px gap
    '2x2': { gridArea: 'row-span-2 col-span-2', width: '624px' }, // Large square for intro
  };

  const config = sizeConfig[size];

  // Enhanced parallax effect - constrained to prevent whitespace
  // Limit movement to [-30px, 30px] to prevent revealing edges
  const parallaxX = scrollProgress 
    ? useTransform(scrollProgress, (latest) => {
        // Map global scrollProgress to constrained image movement
        // latest is negative (moving left), so we want positive movement (right)
        if (latest >= 0) return 0;
        const maxScroll = Math.abs(latest);
        const progress = Math.min(Math.abs(latest) / 3000, 1); // Normalize to 0-1
        // Constrain to [-30px, 30px] range
        const movement = progress * 30; // Max 30px movement
        return Math.min(Math.max(movement, -30), 30);
      })
    : 0;

  // Preload image on mount (only for project cards)
  useEffect(() => {
    if (type === 'project' && image) {
      const img = new Image();
      img.src = image;
      img.onload = () => setImageLoaded(true);
      img.onerror = () => {
        console.error('Failed to load image:', image);
        setImageError(true);
      };
    }
  }, [image, type]);

  // Check if card should show text (not "Untitled" or empty)
  const showText = title && title !== 'Untitled';

  // Intro/Outro Card - Minimalist Typography
  if (type === 'intro' || type === 'outro') {
    return (
      <motion.div
        className={`relative overflow-hidden rounded-[32px] cursor-pointer bg-black dark:bg-white ${config.gridArea}`}
        style={{ width: config.width }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <a href={link} className="block w-full h-full">
          <div className="w-full h-full flex flex-col justify-center items-center p-8 text-white dark:text-black">
            <span className="text-xs font-mono opacity-60 text-white/60 dark:text-black/60 mb-4">
              {year}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-white/80 dark:text-black/80 text-center max-w-md whitespace-pre-wrap">
                {description}
              </p>
            )}
          </div>
        </a>
      </motion.div>
    );
  }

  // Project Card - Image based with hybrid text visibility
  return (
    <motion.div
      className={`group relative overflow-hidden rounded-[32px] cursor-pointer bg-neutral-200 dark:bg-neutral-800 ${config.gridArea}`}
      style={{ width: config.width }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <a 
        href={link} 
        className="block w-full h-full"
        target={link !== '#' ? '_blank' : undefined}
        rel={link !== '#' ? 'noopener noreferrer' : undefined}
      >
        {/* Image Container */}
        <div className="w-full h-full relative overflow-hidden">
          {/* Background Image with Enhanced Parallax */}
          {imageLoaded && !imageError && (
            <motion.div 
              className="card-image absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${image})`,
                x: parallaxX,
                scale: 1.25, // Fixed scale-125 for overflow buffer
              }}
            />
          )}

          {/* Fallback: Show title in center if image fails or while loading */}
          {(!imageLoaded || imageError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
              <div className="text-center px-4">
                <span className="text-xs font-mono opacity-60 text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {year}
                </span>
                <h3 className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                  {title}
                </h3>
                {imageError && (
                  <p className="text-xs text-red-500 mt-2">Loading...</p>
                )}
              </div>
            </div>
          )}

          {/* Permanent Gradient Overlay for text readability */}
          {imageLoaded && !imageError && showText && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
          )}

          {/* Link Indicator - Top Right (Hover Only) */}
          {link && link !== '#' && imageLoaded && !imageError && (
            <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-black/40 backdrop-blur-sm rounded-full p-2">
                <ArrowUpRight className="w-4 h-4 text-white/90" />
              </div>
            </div>
          )}

          {/* Text Overlay - Bottom Left (Hybrid Visibility) */}
          {imageLoaded && !imageError && showText && (
            <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
              <div className="text-white">
                {/* Always Visible: Year and Title */}
                {year && (
                  <span className="text-xs font-mono opacity-70 text-white/90 mb-1 block">
                    {year}
                  </span>
                )}
                {title && (
                  <h3 className="text-lg font-bold mb-1 opacity-100">{title}</h3>
                )}
                {/* Hover Only: Description */}
                {description && (
                  <p className="text-sm opacity-0 group-hover:opacity-90 text-white/90 line-clamp-2 transition-opacity duration-300">
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </a>
    </motion.div>
  );
}
