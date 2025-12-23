'use client';

import { useState, useEffect } from 'react';
import type { MotionValue } from 'framer-motion';
import { motion, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useParallax, useProgressiveImage } from '@/hooks';
import type { ImageSize } from '@/hooks';
import { ScrambleText, ScrollingText, ScrollHint } from '@/components/ui';
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
  /** 滚动进度 (0-1)，用于 ScrollHint */
  scrollYProgress?: MotionValue<number>;
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
  // Intro 独立缩放
  introScale?: MotionValue<number>;
  // Outro 独立缩放
  outroScale?: MotionValue<number>;
  // 卡片透明度
  cardOpacity?: MotionValue<number>;
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
  introScale?: MotionValue<number>;
  outroScale?: MotionValue<number>;
  scrollYProgress?: MotionValue<number>;
}

function IntroOutroCard({
  title,
  year,
  description,
  link,
  absolutePosition,
  gridArea,
  width,
  introScale,
  outroScale,
  scrollYProgress,
}: IntroOutroCardProps) {
  const hasLink = Boolean(link && link !== '#');
  const isIntro = Boolean(introScale);

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

  // 使用 introScale 或 outroScale
  const cardScale = introScale || outroScale;

  return (
    <motion.div
      className={`group relative overflow-visible bg-black dark:bg-white ${hasLink ? 'cursor-pointer' : 'cursor-default'} ${absolutePosition ? '' : gridArea}`}
      style={{
        ...positionStyle,
        borderRadius: UI.cardBorderRadius,
        scale: cardScale,
        transformOrigin: 'center center',
      }}
      whileHover={{ scale: cardScale ? undefined : ANIMATION.cardHoverScale }}
      transition={{ duration: ANIMATION.hoverDuration }}
    >
      {/* Scroll Hint - 只在 Intro 卡片上方显示 */}
      {isIntro && scrollYProgress && (
        <ScrollHint scrollProgress={scrollYProgress} />
      )}
      
      <CardWrapper {...wrapperProps} className="block w-full h-full">
        <IntroOutroLinkIndicator visible={hasLink} />
        
        <div className="w-full h-full flex flex-col justify-center items-center p-8 text-white dark:text-black overflow-hidden" style={{ borderRadius: UI.cardBorderRadius }}>
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
  opacity: number; // 新增：透明度控制
}

function ProjectCardImage({
  image,
  imgSize,
  isHorizontalMove,
  parallaxX,
  parallaxY,
  scale,
  opacity,
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
        opacity, // 应用透明度
        backgroundImage: `url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        transformOrigin: 'center center',
      }}
      animate={{ opacity }}
      transition={{ duration: ANIMATION.fadeDuration, ease: 'easeOut' }}
    />
  );
}

// ============================================================================
// Project Card Skeleton (Shimmer Effect)
// ============================================================================

function ProjectCardSkeleton() {
  return (
    <motion.div 
      className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: ANIMATION.skeletonDuration }}
    >
      {/* 更简洁的骨架屏 - 减少动画复杂度 */}
      <div className="absolute inset-0">
        {/* 主要区域 */}
        <div className="w-full h-full bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800" />
      </div>
      
      {/* 底部文字骨架 - 更小更简洁 */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="space-y-1">
          {/* Year skeleton */}
          <div className="h-2 w-12 bg-neutral-300 dark:bg-neutral-700 rounded" />
          {/* Title skeleton */}
          <div className="h-3 w-24 bg-neutral-300 dark:bg-neutral-700 rounded" />
        </div>
      </div>
    </motion.div>
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
// Project Card Text Overlay - 图片卡片上的文字（带 Scramble 效果）
// ============================================================================

interface ProjectCardTextOverlayProps {
  title: string;
  year: string;
  description?: string;
  scrambleTrigger?: number;
}

function ProjectCardTextOverlay({
  title,
  year,
  description,
  scrambleTrigger,
}: ProjectCardTextOverlayProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  if (!year && !title) return null;

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 p-6 z-20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="text-white">
        {year && (
          <ScrambleText
            text={year}
            as="span"
            className="text-xs font-mono opacity-70 text-white/90 mb-1 block"
            triggerReplay={scrambleTrigger}
          />
        )}
        {title && (
          <ScrambleText
            text={title}
            as="h3"
            className="text-lg font-bold mb-1 opacity-100"
            triggerReplay={scrambleTrigger}
          />
        )}
        {description && (
          <p 
            className="text-sm text-white/90 line-clamp-2 transition-all duration-300"
            style={{
              opacity: isHovered ? 0.9 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(4px)',
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Text Card Content - 纯文字卡片（带 Scramble 效果 + 背景滚动大字）
// ============================================================================

interface TextCardContentProps {
  title: string;
  year: string;
  description?: string;
  size: CardSize;
  scrambleTrigger?: number;
  scrollProgress?: MotionValue<number>;
  cardPosition?: number;
  viewportWidth?: number;
}

function TextCardContent({
  title,
  year,
  description,
  size,
  scrambleTrigger,
  scrollProgress,
  cardPosition = 0,
  viewportWidth = 1920,
}: TextCardContentProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const isLarge = size === '2x2' || size === '2x1';
  const isTall = size === '1x2' || size === '2x2';
  const bgText = title || year || '';

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ containerType: 'size' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 背景滚动大字 */}
      {bgText && (
        <ScrollingText
          text={bgText}
          size={size}
          scrollProgress={scrollProgress}
          cardPosition={cardPosition}
          viewportWidth={viewportWidth}
        />
      )}

      {/* 前景文字内容 */}
      <div className="text-center px-6 z-10 relative">
        {year && (
          <ScrambleText
            text={year}
            as="span"
            className={`font-mono text-neutral-500 dark:text-neutral-400 mb-3 block ${isLarge ? 'text-sm' : 'text-xs'}`}
            triggerReplay={scrambleTrigger}
          />
        )}
        
        {title && (
          <ScrambleText
            text={title}
            as="h3"
            className={`font-semibold text-neutral-700 dark:text-neutral-200 mb-2 ${isLarge ? 'text-xl md:text-2xl' : 'text-lg'}`}
            triggerReplay={scrambleTrigger}
          />
        )}
        
        {description && (
          <p 
            className={`text-neutral-500 dark:text-neutral-400 transition-all duration-300 ${isLarge ? 'text-sm' : 'text-xs'} ${isTall ? 'line-clamp-4' : 'line-clamp-2'}`}
            style={{
              opacity: isHovered ? 0.9 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(8px)',
            }}
          >
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
  scrollYProgress,
  type = 'project',
  description,
  cardPosition,
  absolutePosition,
  introScale,
  outroScale,
  cardOpacity,
}: MasonryCardProps) {
  const [imgSize, setImgSize] = useState<ImageSize | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0);
  const [scrambleTrigger, setScrambleTrigger] = useState(0);

  // 使用渐进式图片加载
  const { 
    currentImageUrl, 
    isOptimized, 
    isLoading, 
    hasError,
    loadingProgress 
  } = useProgressiveImage(image || '', {
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    enableOptimization: true,
  });

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

  // 获取图片尺寸和设置透明度
  useEffect(() => {
    if (type === 'project' && currentImageUrl && currentImageUrl.trim() !== '' && !isLoading && !hasError) {
      // 图片已加载，获取尺寸
      const img = new window.Image();
      img.src = currentImageUrl;
      img.onload = () => {
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
        // 根据加载进度调整淡入速度
        const fadeDelay = loadingProgress === 'complete' ? 10 : 50;
        setTimeout(() => setImageOpacity(1), fadeDelay);
      };
    } else if (type === 'project' && (!currentImageUrl || hasError)) {
      // 无图片或图片错误
      setImgSize(null);
      setImageOpacity(1);
    }
  }, [currentImageUrl, type, isLoading, hasError, loadingProgress]);

  // 判断是否有图片
  const hasImage = currentImageUrl && currentImageUrl.trim() !== '';
  // 判断是否应该显示占位符（只在有图片但正在加载且未出错时才显示）
  const shouldShowPlaceholder = hasImage && isLoading && !hasError;
  // 判断是否有内容（Name、Summary、Year 任意一个有文字）
  const hasContent = (title && title.trim() !== '') || (description && description.trim() !== '') || (year && year.trim() !== '');
  // 判断是否应该显示为文字卡片（无图片 或 图片加载失败）
  const shouldShowAsTextCard = !hasImage || hasError;

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
        introScale={introScale}
        outroScale={outroScale}
        scrollYProgress={scrollYProgress}
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

  // 完全空白的卡片（无图片且无内容）应该透明
  const isEmptyPlaceholder = shouldShowAsTextCard && !hasContent;

  // 当卡片透明度为0时禁用点击
  const pointerEvents = useTransform(
    cardOpacity || { get: () => 1 } as MotionValue<number>,
    (opacity: number) => opacity < 0.1 ? 'none' : 'auto'
  );

  return (
    <motion.div
      className={`group relative overflow-hidden ${isEmptyPlaceholder ? 'bg-transparent' : 'bg-neutral-200 dark:bg-neutral-800'} ${hasLink ? 'cursor-pointer' : 'cursor-default'} ${absolutePosition ? '' : gridAreaClass}`}
      style={{
        ...positionStyle,
        borderRadius: isEmptyPlaceholder ? 0 : UI.cardBorderRadius,
        opacity: cardOpacity,
        pointerEvents: cardOpacity ? pointerEvents : 'auto',
      }}
      whileHover={isEmptyPlaceholder ? undefined : { scale: ANIMATION.cardHoverScale }}
      transition={{ duration: ANIMATION.hoverDuration }}
      onMouseEnter={() => setScrambleTrigger(prev => prev + 1)}
    >
      <CardWrapper {...wrapperProps} className="block w-full h-full">
        <div className={`w-full h-full relative overflow-hidden flex items-center justify-center ${isEmptyPlaceholder ? 'bg-transparent' : 'bg-neutral-200 dark:bg-neutral-800'}`}>
          {/* Loading Skeleton - 只在有图片但正在加载时显示 */}
          {shouldShowPlaceholder && (
            <ProjectCardSkeleton />
          )}

          {/* Image with Parallax - 只在有图片且加载成功时显示 */}
          {hasImage && !isLoading && !hasError && imgSize && (
            <ProjectCardImage
              image={currentImageUrl}
              imgSize={imgSize}
              isHorizontalMove={isHorizontalMove}
              parallaxX={parallaxX}
              parallaxY={parallaxY}
              scale={scale}
              opacity={imageOpacity}
            />
          )}

          {/* 优化状态指示器（开发时可选显示） */}
          {process.env.NODE_ENV === 'development' && 
           process.env.NEXT_PUBLIC_SHOW_IMAGE_DEBUG === 'true' && 
           hasImage && !isLoading && !hasError && (
            <div className="absolute top-2 left-2 z-30">
              <div className={`px-2 py-1 rounded text-xs font-mono ${
                isOptimized 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-black'
              }`}>
                {isOptimized ? 'OPT' : 'ORIG'}
              </div>
            </div>
          )}

          {/* 文字卡片内容 - 无图片或图片加载失败时显示 */}
          {shouldShowAsTextCard && hasContent && (
            <TextCardContent
              title={title}
              year={year}
              description={description}
              size={size}
              scrambleTrigger={scrambleTrigger}
              scrollProgress={scrollProgress}
              cardPosition={cardPosition}
              viewportWidth={viewportWidth}
            />
          )}

          {/* 完全空白的卡片 - 透明占位，不显示任何内容 */}
          {isEmptyPlaceholder && null}

          {/* Gradient Overlay - 只在有图片且有文字时显示 */}
          {hasImage && !isLoading && !hasError && showText && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
          )}

          {/* Link Indicator */}
          <LinkIndicator visible={hasLink} />

          {/* Text Overlay - 只在有图片且成功加载时显示 */}
          {hasImage && !isLoading && !hasError && (
            <ProjectCardTextOverlay
              title={title}
              year={year}
              description={description}
              scrambleTrigger={scrambleTrigger}
            />
          )}
        </div>
      </CardWrapper>
    </motion.div>
  );
}
