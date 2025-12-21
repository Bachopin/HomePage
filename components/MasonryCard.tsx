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
  cardIndex?: number; // Index for calculating card position
  totalCards?: number; // Total number of cards
  cardPosition?: number; // Absolute X position of card center (from parent)
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
  description,
  cardIndex = 0,
  totalCards = 1,
  cardPosition
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
  const IMAGE_SCALE = 1.15;

  // Calculate safe parallax limits based on geometry (memoized)
  const { maxOffset, isHorizontalMove, initialOffset } = useMemo(() => {
    if (!imgSize) return { maxOffset: 0, isHorizontalMove: false, initialOffset: 0 };

    const cardW = config.cardW;
    const cardH = config.cardH;
    const imgRatio = imgSize.w / imgSize.h;
    const cardRatio = cardW / cardH;

    // Determine movement direction based on aspect ratio comparison
    const isHorizontalMove = imgRatio > cardRatio;

    // Calculate rendered dimensions (assuming object-cover behavior with scale)
    let maxOffset = 0;
    let initialOffset = 0;

    if (isHorizontalMove) {
      // Image fills height, calculate rendered width with scale
      const renderedImgWidth = cardH * imgRatio * IMAGE_SCALE;
      // Available overflow on each side
      const totalOverflow = renderedImgWidth - cardW;
      maxOffset = totalOverflow / 2;
      // Initial position: center the image (no offset)
      initialOffset = 0;
    } else if (imgRatio < cardRatio) {
      // Image fills width, calculate rendered height with scale
      const renderedImgHeight = (cardW / imgRatio) * IMAGE_SCALE;
      // Available overflow on each side
      const totalOverflow = renderedImgHeight - cardH;
      maxOffset = totalOverflow / 2;
      // Initial position: start from top (negative offset to show bottom of image)
      // As card moves, image moves down (positive) to reveal top
      initialOffset = -maxOffset;
    } else {
      // Ratios match perfectly, no movement
      return { maxOffset: 0, isHorizontalMove: false, initialOffset: 0 };
    }

    // Safety buffer: Reduce limit by 30% to ensure no whitespace (more conservative)
    const safeLimit = Math.max(0, maxOffset * 0.7);

    return { maxOffset: safeLimit, isHorizontalMove, initialOffset };
  }, [imgSize, config.cardW, config.cardH, IMAGE_SCALE]);

  // Create a default motion value to use when scrollProgress is not available
  const defaultScrollProgress = useMotionValue(0);
  
  // Use scrollProgress if provided, otherwise use default
  // This ensures we always have a valid MotionValue for useTransform
  const scrollMotionValue = scrollProgress || defaultScrollProgress;

  // Use cardPosition from parent if provided, otherwise calculate approximate position
  const cardAbsoluteX = useMemo(() => {
    if (cardPosition !== undefined) return cardPosition;
    
    // Fallback: approximate calculation
    if (typeof window === 'undefined') return 0;
    
    const gap = 24;
    const introPadding = window.innerWidth / 2 - 312;
    let x = introPadding;
    
    // Sum up widths of all cards before this one (approximate as 300px each)
    for (let i = 0; i < cardIndex; i++) {
      x += 300 + gap;
    }
    // Add half of this card's width to get center
    x += config.cardW / 2;
    
    return x;
  }, [cardPosition, cardIndex, config.cardW]);

  // X Parallax: for wide images (horizontal movement)
  // Only move when card center has passed viewport center
  // latest is negative (content moving left), image should move right (positive) for parallax
  const parallaxX = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || !isHorizontalMove || latest >= 0 || maxOffset === 0) return initialOffset;
    
    // Calculate card's current position (accounting for scroll transform)
    const viewportCenter = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const cardCurrentX = cardAbsoluteX + latest; // latest is negative, so card moves left
    
    // Only start parallax when card center has passed viewport center (moved to right side)
    if (cardCurrentX >= viewportCenter) return initialOffset;
    
    // Calculate how far past center the card has moved
    const distancePastCenter = viewportCenter - cardCurrentX;
    // Use card width as the range for full parallax effect
    const parallaxRange = config.cardW;
    const progress = Math.min(distancePastCenter / parallaxRange, 1);
    
    // Image moves right (positive) as card moves left past center
    // Range: [initialOffset (0), initialOffset + maxOffset]
    const movement = initialOffset + progress * maxOffset;
    return Math.min(Math.max(movement, initialOffset), initialOffset + maxOffset);
  });

  // Y Parallax: for tall images (vertical movement)
  // Only move when card center has passed viewport center
  const parallaxY = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || isHorizontalMove || latest >= 0 || maxOffset === 0) return initialOffset;
    
    // Calculate card's current position
    const viewportCenter = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const cardCurrentX = cardAbsoluteX + latest;
    
    // Only start parallax when card center has passed viewport center
    if (cardCurrentX >= viewportCenter) return initialOffset;
    
    // Calculate progress
    const distancePastCenter = viewportCenter - cardCurrentX;
    const parallaxRange = config.cardW;
    const progress = Math.min(distancePastCenter / parallaxRange, 1);
    
    // Image moves down (positive) as card moves left past center
    // Range: [initialOffset (-maxOffset), initialOffset + 2*maxOffset (+maxOffset)]
    const movement = initialOffset + progress * (2 * maxOffset);
    return Math.min(Math.max(movement, initialOffset), initialOffset + 2 * maxOffset);
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
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
          {/* Loading Placeholder */}
          {(!imageLoaded || imageError || !imgSize) && (
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

          {/* Background Image with Geometry-Aware Parallax */}
          {imageLoaded && !imageError && imgSize && (
            <motion.div 
              className="card-image"
              style={{ 
                // Dynamic sizing based on aspect ratio comparison
                // IF moving horizontally (Square img in Tall card), Height fixes to 100%, Width flows naturally
                ...(isHorizontalMove ? { 
                  height: '100%', 
                  width: 'auto',
                } : { 
                  // IF moving vertically (Square img in Wide card), Width fixes to 100%, Height flows naturally
                  width: '100%', 
                  height: 'auto',
                }),
                // Force the aspect ratio to match the natural image
                aspectRatio: `${imgSize.w} / ${imgSize.h}`,
                // Apply parallax transforms
                x: isHorizontalMove ? parallaxX : 0,
                y: !isHorizontalMove ? parallaxY : 0,
                scale: IMAGE_SCALE,
                // Background image styling
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                // Ensure image is centered initially
                transformOrigin: 'center center',
              }}
            />
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
