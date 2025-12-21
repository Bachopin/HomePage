'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MasonryCardProps {
  id: number;
  title: string;
  year: string;
  image: string;
  size: '1x1' | '1x2' | '2x1';
  link?: string;
}

export default function MasonryCard({ id, title, year, image, size, link = '#' }: MasonryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Map size prop to grid area and dimensions (matching compact 300px rows)
  const sizeConfig = {
    '1x1': { gridArea: 'row-span-1 col-span-1', width: '300px' },
    '1x2': { gridArea: 'row-span-2 col-span-1', width: '300px' },
    '2x1': { gridArea: 'row-span-1 col-span-2', width: '624px' }, // 300*2 + 24px gap
  };

  const config = sizeConfig[size];

  // Preload image on mount
  useEffect(() => {
    const img = new Image();
    img.src = image;
    img.onload = () => setImageLoaded(true);
    img.onerror = () => {
      console.error('Failed to load image:', image);
      setImageError(true);
    };
  }, [image]);

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
        <div className="w-full h-full relative">
          {/* Background Image */}
          {imageLoaded && !imageError && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${image})`,
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
