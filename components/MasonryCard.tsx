'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Map size prop to grid area and dimensions
  const sizeConfig = {
    '1x1': { gridArea: 'row-span-1 col-span-1', width: '300px', height: '300px', aspect: 1 },
    '1x2': { gridArea: 'row-span-2 col-span-1', width: '300px', height: '624px', aspect: 0.5 },
    '2x1': { gridArea: 'row-span-1 col-span-2', width: '624px', height: '300px', aspect: 2 },
    '2x2': { gridArea: 'row-span-2 col-span-2', width: '624px', height: '624px', aspect: 1 },
  };

  const config = sizeConfig[size];

  // Smart parallax effect - adapts to image vs card aspect ratio
  const parallaxX = scrollProgress && imgSize.w > 0 && imgSize.h > 0
    ? useTransform(scrollProgress, (latest) => {
        if (latest >= 0) return 0;
        
        // Calculate image and card aspect ratios
        const imageAspect = imgSize.w / imgSize.h;
        const cardAspect = config.aspect;
        
        // Determine movement axis based on aspect ratio comparison
        const shouldPanX = imageAspect > cardAspect; // Image is wider than card
        
        if (!shouldPanX) return 0; // Don't pan X if image is taller
        
        // Calculate safe movement range
        const containerWidth = containerRef.current?.offsetWidth || parseInt(config.width);
        const imageWidth = containerWidth * 1.25; // Account for scale-125
        const maxOffset = Math.max(0, (imageWidth - containerWidth) / 2);
        
        // Clamp to safe range
        const progress = Math.min(Math.abs(latest) / 3000, 1);
        const movement = progress * Math.min(maxOffset, 30); // Max 30px or available space
        return Math.min(Math.max(movement, -maxOffset), maxOffset);
      })
    : 0;

  const parallaxY = scrollProgress && imgSize.w > 0 && imgSize.h > 0
    ? useTransform(scrollProgress, (latest) => {
        if (latest >= 0) return 0;
        
        // Calculate image and card aspect ratios
        const imageAspect = imgSize.w / imgSize.h;
        const cardAspect = config.aspect;
        
        // Determine movement axis based on aspect ratio comparison
        const shouldPanY = imageAspect < cardAspect; // Image is taller than card
        
        if (!shouldPanY) return 0; // Don't pan Y if image is wider
        
        // Calculate safe movement range
        const containerHeight = containerRef.current?.offsetHeight || parseInt(config.height);
        const imageHeight = containerHeight * 1.25; // Account for scale-125
        const maxOffset = Math.max(0, (imageHeight - containerHeight) / 2);
        
        // Clamp to safe range
        const progress = Math.min(Math.abs(latest) / 3000, 1);
        const movement = progress * Math.min(maxOffset, 30); // Max 30px or available space
        return Math.min(Math.max(movement, -maxOffset), maxOffset);
      })
    : 0;

  // Preload image
  useEffect(() => {
    if (type === 'project' && image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        setImageLoaded(true);
        // Dimensions will be set by the img onLoad handler
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        console.error('Failed to load image:', image);
        setImageError(true);
      };
    }
  }, [image, type]);

  // Check if card should show text (not "Untitled" or empty)
  const showText = title && title !== 'Untitled';
  const hasLink = link && link !== '#';

  // Intro/Outro Card - Minimalist Typography
  if (type === 'intro' || type === 'outro') {
    return (
      <motion.div
        ref={containerRef}
        className={`group relative overflow-hidden rounded-[32px] cursor-pointer bg-black dark:bg-white ${config.gridArea}`}
        style={{ width: config.width }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <a 
          href={link} 
          className="block w-full h-full"
          target={hasLink ? '_blank' : undefined}
          rel={hasLink ? 'noopener noreferrer' : undefined}
        >
          <div className="w-full h-full flex flex-col justify-center items-center p-8 text-white dark:text-black relative">
            {/* Link Indicator - Top Right (for text cards) */}
            {hasLink && (
              <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-black/40 dark:bg-white/40 backdrop-blur-sm rounded-full p-2">
                  <ArrowUpRight className="w-4 h-4 text-white dark:text-black" />
                </div>
              </div>
            )}
            
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
      ref={containerRef}
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
        target={hasLink ? '_blank' : undefined}
        rel={hasLink ? 'noopener noreferrer' : undefined}
      >
        {/* Image Container */}
        <div className="w-full h-full relative overflow-hidden">
          {/* Background Image with Smart Parallax */}
          {imageLoaded && !imageError && (
            <>
              {/* Hidden img for dimension measurement */}
              <img
                ref={imageRef}
                src={image}
                alt=""
                className="hidden"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
              <motion.div 
                className="card-image absolute inset-0 bg-cover bg-center"
                style={{ 
                  backgroundImage: `url(${image})`,
                  x: parallaxX,
                  y: parallaxY,
                  scale: 1.25, // Fixed scale-125 for overflow buffer
                }}
              />
            </>
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
          {hasLink && imageLoaded && !imageError && (
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
