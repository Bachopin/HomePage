'use client';

import { useState, useEffect } from 'react';
import type { MotionValue } from 'framer-motion';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useParallax } from '@/hooks';
import type { ImageSize } from '@/hooks';
import {
  ANIMATION,
  UI,
  getLayoutConfig,
  getCardPixelDimensions,
} from '@/lib/config';
import type { CardSize } from '@/lib/config';
import { DEFAULTS } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

interface MasonryCardProps {
  id: number | string;
  title: string;
  year: string;
  image: string;
  size: CardSize;
  link?: string;
  scrollProgress?: MotionValue<number>;
  type?: 'intro' | 'project' | 'outro';
  description?: string;
  cardIndex?: number;
  totalCards?: number;
  cardPosition?: number;
  absolutePosition?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface LinkIndicatorProps {
  visible: boolean;
}

function LinkIndicator({ visible }: LinkIndicatorProps) {
  if (!visible) return null;
  
  return (
    <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="bg-black/40 backdrop-blur-sm rounded-full p-2">
        <ArrowUpRight 
          className="text-white/90" 
          style={{ width: UI.iconSize, height: UI.iconSize }} 
        />
      </div>
    </div>
  );
}

interface IntroOutroLinkIndicatorProps {
  visible: boolean;
}

function IntroOutroLinkIndicator({ visible }: IntroOutroLinkIndicatorProps) {
  if (!visible) return null;
  
  return (
    <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="bg-black/40 dark:bg-white/40 backdrop-blur-sm rounded-full p-2">
        <ArrowUpRight 
          className="text-white dark:text-black" 
          style={{ width: UI.iconSize, height: UI.iconSize }} 
        />
      </div>
    </div>
  );
}

// ============================================================================
// Intro/Outro Card
// ============================================================================

interface IntroOutroCardProps {
  title: string;
  year: string;
  description?: string;
  link?: string;
  absolutePosition?: MasonryCardProps['absolutePosition'];
  gridArea: string;
  width: string;
}

function IntroOutroCard({
  title,
  year,
  description,
  link,
  absolutePosition,
  gridArea,
  width,
}: IntroOutroCardProps) {
  const hasLink = Boolean(link && link !== '#');

  const CardWrapper = hasLink ? 'a' : 'div';
  const wrapperProps = hasLink
    ? {
        href: link,
        target: '_blank' as const,
        rel: 'noopener noreferrer' as const,
      }
    : {};

  const positionStyle = absolutePosition
    ? {
        position: 'absolute' as const,
        top: `${absolutePosition.top}px`,
        left: `${absolutePosition.left}px`,
        width: `${absolutePosition.width}px`,
        height: `${absolutePosition.height}px`,
      }
    : { width };

  return (
    <motion.div
      className={`group relative overflow-hidden bg-black dark:bg-white ${hasLink ? 'cursor-pointer' : 'cursor-default'} ${absolutePosition ? '' : gridArea}`}
      style={{
        ...positionStyle,
        borderRadius: UI.cardBorderRadius,
      }}
      whileHover={{ scale: ANIMATION.cardHoverScale }}
      transition={{ duration: ANIMATION.hoverDuration }}
    >
      <CardWrapper {...wrapperProps} className="block w-full h-full">
        <IntroOutroLinkIndicator visible={hasLink} />
        
        <div className="w-full h-full flex flex-col justify-center items-center p-8 text-white dark:text-black">
          {year && (
            <span className="text-xs font-mono opacity-60 text-white/60 dark:text-black/60 mb-4">
              {year}
            </span>
          )}
          {title && (
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">
              {title}
            </h2>
          )}
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

// ============================================================================
// Project Card Image
// ============================================================================

interface ProjectCardImageProps {
  image: string;
  imgSize: ImageSize;
  isHorizontalMove: boolean;
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
  scale: number;
}

function ProjectCardImage({
  image,
  imgSize,
  isHorizontalMove,
  parallaxX,
  parallaxY,
  scale,
}: ProjectCardImageProps) {
  return (
    <motion.div
      className="card-image"
      style={{
        ...(isHorizontalMove
          ? { height: '100%', width: 'auto' }
          : { width: '100%', height: 'auto' }),
        aspectRatio: `${imgSize.w} / ${imgSize.h}`,
        x: isHorizontalMove ? parallaxX : 0,
        y: !isHorizontalMove ? parallaxY : 0,
        scale,
        backgroundImage: `url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        transformOrigin: 'center center',
      }}
    />
  );
}

// ============================================================================
// Project Card Skeleton (Shimmer Effect)
// ============================================================================

function ProjectCardSkeleton() {
  return (
    <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-pulse">
        {/* Main skeleton area */}
        <div className="w-full h-full bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800 bg-[length:200%_100%] animate-shimmer" />
      </div>
      
      {/* Bottom text skeleton */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="space-y-2">
          {/* Year skeleton */}
          <div className="h-3 w-16 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse" />
          {/* Title skeleton */}
          <div className="h-5 w-32 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Project Card Placeholder (Error State)
// ============================================================================

interface ProjectCardPlaceholderProps {
  imageError: boolean;
}

function ProjectCardPlaceholder({
  imageError,
}: ProjectCardPlaceholderProps) {
  // Show skeleton while loading, error state if failed
  if (!imageError) {
    return <ProjectCardSkeleton />;
  }

  // Error state - show minimal error indicator
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
      <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center">
        <span className="text-neutral-500 dark:text-neutral-400 text-xs">!</span>
      </div>
    </div>
  );
}

// ============================================================================
// Project Card Text Overlay
// ============================================================================

interface ProjectCardTextOverlayProps {
  title: string;
  year: string;
  description?: string;
}

function ProjectCardTextOverlay({
  title,
  year,
  description,
}: ProjectCardTextOverlayProps) {
  if (!year && !title) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
      <div className="text-white">
        {year && (
          <span className="text-xs font-mono opacity-70 text-white/90 mb-1 block">
            {year}
          </span>
        )}
        {title && (
          <h3 className="text-lg font-bold mb-1 opacity-100">{title}</h3>
        )}
        {description && (
          <p className="text-sm opacity-0 group-hover:opacity-90 text-white/90 line-clamp-2 transition-opacity duration-300">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MasonryCard({
  title,
  year,
  image,
  size,
  link = '#',
  scrollProgress,
  type = 'project',
  description,
  cardPosition,
  absolutePosition,
}: MasonryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imgSize, setImgSize] = useState<ImageSize | null>(null);

  // 获取布局配置
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : DEFAULTS.windowWidth;
  const layout = getLayoutConfig(viewportWidth);
  const cardDims = getCardPixelDimensions(size, layout);

  // 计算卡片中心 X 坐标
  const cardCenterX = cardPosition ?? 0;

  // 使用视差 Hook
  const { x: parallaxX, y: parallaxY, scale, isHorizontalMove } = useParallax({
    scrollProgress,
    imageSize: imgSize,
    cardDimensions: { width: cardDims.width, height: cardDims.height },
    cardCenterX,
    viewportWidth,
  });

  // 预加载图片并获取尺寸
  useEffect(() => {
    if (type === 'project' && image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        setImageLoaded(true);
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        setImageError(true);
      };
    }
  }, [image, type]);

  // Grid area class (for non-absolute positioning)
  const gridAreaClass = `row-span-${cardDims.rows} col-span-${cardDims.cols}`;
  const widthStyle = cardDims.cols === 1 ? `${cardDims.width}px` : `${cardDims.width}px`;

  // Intro/Outro 卡片
  if (type === 'intro' || type === 'outro') {
    return (
      <IntroOutroCard
        title={title}
        year={year}
        description={description}
        link={link}
        absolutePosition={absolutePosition}
        gridArea={gridAreaClass}
        width={widthStyle}
      />
    );
  }

  // Project 卡片
  const hasLink = Boolean(link && link !== '#');
  const showText = title && title.trim() !== '';

  const CardWrapper = hasLink ? 'a' : 'div';
  const wrapperProps = hasLink
    ? {
        href: link,
        target: '_blank' as const,
        rel: 'noopener noreferrer' as const,
      }
    : {};

  const positionStyle = absolutePosition
    ? {
        position: 'absolute' as const,
        top: `${absolutePosition.top}px`,
        left: `${absolutePosition.left}px`,
        width: `${absolutePosition.width}px`,
        height: `${absolutePosition.height}px`,
      }
    : { width: widthStyle };

  return (
    <motion.div
      className={`group relative overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${hasLink ? 'cursor-pointer' : 'cursor-default'} ${absolutePosition ? '' : gridAreaClass}`}
      style={{
        ...positionStyle,
        borderRadius: UI.cardBorderRadius,
      }}
      whileHover={{ scale: ANIMATION.cardHoverScale }}
      transition={{ duration: ANIMATION.hoverDuration }}
    >
      <CardWrapper {...wrapperProps} className="block w-full h-full">
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
          {/* Loading Skeleton / Error State */}
          {(!imageLoaded || imageError || !imgSize) && (
            <ProjectCardPlaceholder imageError={imageError} />
          )}

          {/* Image with Parallax */}
          {imageLoaded && !imageError && imgSize && (
            <ProjectCardImage
              image={image}
              imgSize={imgSize}
              isHorizontalMove={isHorizontalMove}
              parallaxX={parallaxX}
              parallaxY={parallaxY}
              scale={scale}
            />
          )}

          {/* Gradient Overlay */}
          {imageLoaded && !imageError && showText && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
          )}

          {/* Link Indicator */}
          <LinkIndicator visible={hasLink} />

          {/* Text Overlay */}
          {imageLoaded && !imageError && (
            <ProjectCardTextOverlay
              title={title}
              year={year}
              description={description}
            />
          )}
        </div>
      </CardWrapper>
    </motion.div>
  );
}
