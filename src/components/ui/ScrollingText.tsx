'use client';

import type { MotionValue } from 'framer-motion';
import { motion, useTransform } from 'framer-motion';
import type { CardSize } from '@/lib/config';

// ============================================================================
// ScrollingText - 背景滚动大字效果
// ============================================================================

export interface ScrollingTextProps {
  /** 显示的文字 */
  text: string;
  /** 卡片尺寸 */
  size: CardSize;
  /** 滚动进度（像素值） */
  scrollProgress?: MotionValue<number>;
  /** 卡片位置 X 坐标 */
  cardPosition?: number;
  /** 视口宽度 */
  viewportWidth?: number;
}

// 颜色池（灰色系，更淡更背景化）
const COLORS = [
  'text-neutral-300/20 dark:text-neutral-600/20',
  'text-neutral-400/15 dark:text-neutral-500/15',
  'text-neutral-300/25 dark:text-neutral-600/25',
  'text-neutral-400/18 dark:text-neutral-500/18',
];

// 镂空钢印阴影效果（更微妙）
const EMBOSS_STYLE = {
  textShadow: `
    1px 1px 0px rgba(255,255,255,0.4),
    -1px -1px 0px rgba(0,0,0,0.03)
  `,
};

// 暗色模式钢印效果（未使用，保留备用）
// const EMBOSS_STYLE_DARK = {
//   textShadow: `
//     1px 1px 0px rgba(0,0,0,0.15),
//     -1px -1px 0px rgba(255,255,255,0.03)
//   `,
// };

// 根据字符索引获取颜色（伪随机但稳定）
function getColor(index: number, char: string): string {
  const seed = char.charCodeAt(0) + index;
  return COLORS[seed % COLORS.length];
}

export default function ScrollingText({
  text,
  size,
  scrollProgress,
  cardPosition = 0,
  viewportWidth = 1920,
}: ScrollingTextProps) {
  const bgText = text.toUpperCase();
  
  const isVertical = size === '1x2';
  const isHorizontal = size === '2x1';

  // 计算背景文字的滚动位移
  // 简单逻辑：文字从卡片右边进入，穿过卡片，从左边离开
  // 基于卡片在屏幕上的当前位置计算
  
  const bgX = useTransform(
    scrollProgress || ({ get: () => 0 } as MotionValue<number>),
    (scrollX: number) => {
      // 卡片当前在屏幕上的位置
      const cardCurrentX = cardPosition + scrollX;
      
      // 当卡片在屏幕右边外面时，文字在卡片右边外（100%）
      // 当卡片在屏幕左边外面时，文字在卡片左边外（-100%）
      // 线性映射：卡片从右到左移动时，文字也从右到左移动
      
      if (isHorizontal || size === '1x1' || size === '2x2') {
        // 卡片位置范围：viewportWidth（右边外）到 0（左边外）
        // 文字位置范围：100%（右边外）到 -100%（左边外）
        const progress = cardCurrentX / viewportWidth; // 1 = 右边，0 = 左边
        const offset = (progress * 2 - 1) * 100; // 映射到 100% ~ -100%
        return `${offset}%`;
      }
      return 0;
    }
  );

  const bgY = useTransform(
    scrollProgress || ({ get: () => 0 } as MotionValue<number>),
    (scrollX: number) => {
      const cardCurrentX = cardPosition + scrollX;
      
      if (isVertical) {
        // 纵向卡片：Y方向移动
        const progress = cardCurrentX / viewportWidth;
        const offset = (progress * 2 - 1) * 100;
        return `${offset}%`;
      }
      if (size === '1x1' || size === '2x2') {
        // 方形卡片：轻微Y移动
        const progress = cardCurrentX / viewportWidth;
        const offset = (progress * 2 - 1) * 30;
        return `${offset}%`;
      }
      return 0;
    }
  );

  if (!bgText) return null;

  // 根据卡片尺寸决定布局
  const renderContent = () => {
    const chars = bgText.split('');
    const shouldBeVertical = isVertical || (bgText.length <= 4 && !isHorizontal);

    if (shouldBeVertical) {
      const fontSize = isVertical ? '80cqw' : (size === '2x2' ? '60cqw' : '70cqw');
      return (
        <div 
          className="flex flex-col items-center justify-center w-full"
          style={{ fontSize, lineHeight: 0.85 }}
        >
          {chars.map((char, i) => (
            <span 
              key={i} 
              className={`font-bold leading-none ${getColor(i, char)} dark:drop-shadow-none`}
              style={EMBOSS_STYLE}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>
      );
    }

    const fontSize = isHorizontal ? '70cqh' : (size === '2x2' ? '50cqh' : '60cqh');
    return (
      <div 
        className="flex items-center justify-center whitespace-nowrap"
        style={{ fontSize, lineHeight: 1 }}
      >
        {chars.map((char, i) => (
          <span 
            key={i} 
            className={`font-bold leading-none ${getColor(i, char)} dark:drop-shadow-none`}
            style={EMBOSS_STYLE}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-visible"
      style={{
        x: scrollProgress ? bgX : 0,
        y: scrollProgress ? bgY : 0,
      }}
    >
      {renderContent()}
    </motion.div>
  );
}
