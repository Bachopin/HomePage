'use client';

import { useState, useEffect } from 'react';
import { motion, MotionValue, useTransform } from 'framer-motion';

interface MasonryCardProps {
  id: number;
  title: string;
  year: string;
  image: string;
  size: '1x1' | '1x2' | '2x1' | '2x2';
  link?: string;
  scrollProgress?: MotionValue<number>;
  type?: 'intro' | 'project';
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

  // Internal parallax effect - move image opposite to scroll direction
  const parallaxX = scrollProgress 
    ? useTransform(scrollProgress, (latest) => {
        // Move image slightly opposite to scroll direction for depth
        // Range: -10px to 10px based on scroll position
        return (latest / 2000) * 10;
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

  // Intro Card - Minimalist Typography
  if (type === 'intro') {
    return (
      <motion.div
        className={`relative overflow-hidden rounded-lg cursor-pointer bg-black dark:bg-white ${config.gridArea}`}
        style={{ width: config.width }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <a href={link} className="block w-full h-full">
          <div className="w-full h-full flex flex-col justify-center items-center p-8 text-white dark:text-black">
            <span className="text-xs font-mono text-white/60 dark:text-black/60 mb-4">
              {year}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-white/80 dark:text-black/80 text-center max-w-md">
                {description}
              </p>
            )}
          </div>
        </a>
      </motion.div>
    );
  }

  // Project Card - Image based
  return (
    <motion.div
      className={`relative overflow-hidden rounded-lg cursor-pointer bg-neutral-200 dark:bg-neutral-800 ${config.gridArea}`}
      style={{ width: config.width }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <a href={link} className="block w-full h-full">
        {/* Image Container */}
        <div className="w-full h-full relative overflow-hidden">
          {/* Background Image with Parallax */}
          {imageLoaded && !imageError && (
            <motion.div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${image})`,
                x: parallaxX,
                scale: 1.1, // Slight scale for parallax effect
              }}
            />
          )}

          {/* Fallback: Show title in center if image fails or while loading */}
          {(!imageLoaded || imageError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
              <div className="text-center px-4">
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-1 block">
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

          {/* Overlay with title and year (shown on hover when image is loaded) */}
          {imageLoaded && !imageError && (
            <motion.div
              className="absolute inset-0 bg-black/40 flex flex-col justify-end p-6 z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-white">
                <span className="text-xs font-mono text-white/80 mb-1 block">{year}</span>
                <h3 className="text-lg font-medium">{title}</h3>
              </div>
            </motion.div>
          )}
        </div>
      </a>
    </motion.div>
  );
}
