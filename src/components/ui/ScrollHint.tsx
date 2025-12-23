'use client';

import { motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useTransform } from 'framer-motion';

// ============================================================================
// ScrollHint - 简洁的滚动提示组件（鼠标滚轮图标）
// 只在 Intro 停留区间（scrollProgress < 0.06）显示
// ============================================================================

export interface ScrollHintProps {
  /** 滚动进度 (0-1) */
  scrollProgress: MotionValue<number>;
  /** 自定义样式类 */
  className?: string;
}

// Intro 停留区间结束点（与 HomeClient PHASES.introPauseEnd 保持一致）
const INTRO_PAUSE_END = 0.06;

export default function ScrollHint({ 
  scrollProgress,
  className = '',
}: ScrollHintProps) {
  // 只在停留区间显示，开始缩放时立即消失
  const opacity = useTransform(
    scrollProgress, 
    [0, INTRO_PAUSE_END * 0.8, INTRO_PAUSE_END], 
    [1, 1, 0]
  );

  return (
    <motion.div
      className={`absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none ${className}`}
      style={{ opacity }}
    >
      {/* 鼠标滚轮图标 */}
      <div className="relative w-6 h-10 rounded-full border-2 border-neutral-400 dark:border-neutral-500">
        {/* 滚轮滑块动画 - 向上滚动 */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-1 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full"
          animate={{ y: [16, 6, 16] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </motion.div>
  );
}
