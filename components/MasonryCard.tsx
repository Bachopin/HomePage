'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, MotionValue, useTransform, useMotionValue } from 'framer-motion';
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
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // Map size prop to grid area and pixel dimensions
  const sizeConfig = {
    '1x1': { 
      gridArea: 'row-span-1 col-span-1', 
      width: '300px', 
      cardW: 300, 
      cardH: 300,
      aspectRatio: 1.0 
    },
    '1x2': { 
      gridArea: 'row-span-2 col-span-1', 
      width: '300px', 
      cardW: 300, 
      cardH: 624, // 300 + 300 + 24px gap
      aspectRatio: 0.5 
    },
    '2x1': { 
      gridArea: 'row-span-1 col-span-2', 
      width: '624px', 
      cardW: 624, // 300 + 300 + 24px gap
      cardH: 300,
      aspectRatio: 2.0 
    },
    '2x2': { 
      gridArea: 'row-span-2 col-span-2', 
      width: '624px', 
      cardW: 624, // 300 + 300 + 24px gap
      cardH: 624, // 300 + 300 + 24px gap
      aspectRatio: 1.0 
    },
  };

  const config = sizeConfig[size];

  // Calculate safe parallax limits based on geometry (memoized)
  const { maxOffset, isHorizontalMove } = useMemo(() => {
    if (!imgSize) return { maxOffset: 0, isHorizontalMove: false };

    const cardW = config.cardW;
    const cardH = config.cardH;
    const imgRatio = imgSize.w / imgSize.h;
    const cardRatio = cardW / cardH;

    // Determine movement direction based on aspect ratio comparison
    const isHorizontalMove = imgRatio > cardRatio;

    // Calculate rendered dimensions (assuming object-cover behavior)
    // If image is relatively wider than card, it fills height and overflows width
    let maxOffset = 0;

    if (isHorizontalMove) {
      // Image fills height, calculate rendered width
      const renderedImgWidth = cardH * imgRatio;
      // Available overflow on each side
      maxOffset = (renderedImgWidth - cardW) / 2;
    } else if (imgRatio < cardRatio) {
      // Image fills width, calculate rendered height
      const renderedImgHeight = cardW / imgRatio;
      // Available overflow on each side
      maxOffset = (renderedImgHeight - cardH) / 2;
    } else {
      // Ratios match perfectly, no movement
      return { maxOffset: 0, isHorizontalMove: false };
    }

    // Safety buffer: Reduce limit by 20% to ensure no whitespace
    const safeLimit = Math.max(0, maxOffset * 0.8);

    return { maxOffset: safeLimit, isHorizontalMove };
  }, [imgSize, config.cardW, config.cardH]);

  // Create a default motion value to use when scrollProgress is not available
  const defaultScrollProgress = useMotionValue(0);
  
  // Use scrollProgress if provided, otherwise use default
  // This ensures we always have a valid MotionValue for useTransform
  const scrollMotionValue = scrollProgress || defaultScrollProgress;

  // X Parallax: for wide images (horizontal movement)
  const parallaxX = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || !isHorizontalMove || latest >= 0 || maxOffset === 0) return 0;
    const progress = Math.min(Math.abs(latest) / 3000, 1);
    // Map progress to [-maxOffset, maxOffset] range
    const movement = progress * maxOffset;
    return Math.min(Math.max(movement, -maxOffset), maxOffset);
  });

  // Y Parallax: for tall images (vertical movement)
  const parallaxY = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || isHorizontalMove || latest >= 0 || maxOffset === 0) return 0;
    const progress = Math.min(Math.abs(latest) / 3000, 1);
    // Map progress to [-maxOffset, maxOffset] range
    const movement = progress * maxOffset;
    return Math.min(Math.max(movement, -maxOffset), maxOffset);
  });

  // Preload image and capture dimensions
  useEffect(() => {
    if (type === 'project' && image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        setImageLoaded(true);
        // Capture full image dimensions
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
    const CardWrapper = hasLink ? 'a' : 'div';
    const wrapperProps = hasLink
      ? {
          href: link,
          target: '_blank' as const,
          rel: 'noopener noreferrer' as const,
        }
      : {};

    return (
      <motion.div
        className={`group relative overflow-hidden rounded-[32px] ${hasLink ? 'cursor-pointer' : 'cursor-default'} bg-black dark:bg-white ${config.gridArea}`}
        style={{ width: config.width }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <CardWrapper 
          {...wrapperProps}
          className="block w-full h-full"
        >
          {/* Link Indicator - Top Right (for intro/outro cards) */}
          {hasLink && (
            <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-black/40 dark:bg-white/40 backdrop-blur-sm rounded-full p-2">
                <ArrowUpRight className="w-4 h-4 text-white dark:text-black" />
              </div>
            </div>
          )}
          
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
        </CardWrapper>
      </motion.div>
    );
  }

  // Project Card - Image based with smart parallax
  const CardWrapper = hasLink ? 'a' : 'div';
  const wrapperProps = hasLink
    ? {
        href: link,
        target: '_blank' as const,
        rel: 'noopener noreferrer' as const,
      }
    : {};

  return (
    <motion.div
      className={`group relative overflow-hidden rounded-[32px] ${hasLink ? 'cursor-pointer' : 'cursor-default'} bg-neutral-200 dark:bg-neutral-800 ${config.gridArea}`}
      style={{ width: config.width }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <CardWrapper 
        {...wrapperProps}
        className="block w-full h-full"
      >
        {/* Image Container */}
        <div className="w-full h-full relative overflow-hidden">
          {/* Background Image with Geometry-Aware Parallax */}
          {imageLoaded && !imageError && (
            <motion.div 
              className="card-image absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${image})`,
                x: isHorizontalMove ? parallaxX : 0,
                y: !isHorizontalMove ? parallaxY : 0,
                scale: 1.15, // Subtle scale for overflow buffer
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

          {/* Link Indicator - Top Right (Always rendered if link exists) */}
          {hasLink && (
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
      </CardWrapper>
    </motion.div>
  );
}
