'use client';

import { useEffect } from 'react';
import { useScramble } from 'use-scramble';

// ============================================================================
// ScrambleText - 通用的文字乱码解码效果组件
// ============================================================================

export interface ScrambleTextProps {
  /** 要显示的文字 */
  text: string;
  /** 自定义样式类 */
  className?: string;
  /** 渲染的 HTML 标签 */
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p';
  /** 动画速度 (0-1)，默认 0.6 */
  speed?: number;
  /** 每个字符乱码次数，默认 4 */
  scramble?: number;
  /** 是否在挂载时播放动画，默认 true */
  playOnMount?: boolean;
  /** 外部触发重播（当值变化时触发） */
  triggerReplay?: number;
}

export default function ScrambleText({ 
  text, 
  className, 
  as: Component = 'span',
  speed = 0.6,
  scramble = 4,
  playOnMount = true,
  triggerReplay,
}: ScrambleTextProps) {
  const { ref, replay } = useScramble({
    text,
    speed,
    tick: 1,
    step: 1,
    scramble,
    seed: 2,
    chance: 0.8,
    overdrive: false,
    overflow: true,
    playOnMount,
  });

  // 外部触发重播
  useEffect(() => {
    if (triggerReplay !== undefined && triggerReplay > 0) {
      replay();
    }
  }, [triggerReplay, replay]);

  return (
    <Component
      ref={ref}
      className={className}
    />
  );
}
