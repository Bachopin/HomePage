'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMouse } from '@/hooks';
import { ANIMATION } from '@/lib/config';

interface Item {
  id: number;
  title: string;
  quotes: string;
  image: string;
  link: string;
}

interface InteractiveListProps {
  items: Item[];
}

export default function InteractiveList({ items }: InteractiveListProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const mouse = useMouse();
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // 当开始悬停时，初始化图片位置为鼠标位置
  useEffect(() => {
    if (hoveredId !== null) {
      setImagePosition({ x: mouse.x, y: mouse.y });
    }
  }, [hoveredId]);

  // 使用 requestAnimationFrame 实现阻尼跟随效果
  useEffect(() => {
    if (hoveredId === null) {
      return;
    }

    let rafId: number;
    
    const updatePosition = () => {
      setImagePosition((prev) => {
        const damping = 0.15; // 阻尼系数，值越小跟随越平滑但延迟越大
        // 使用最新的 mouse 值（通过闭包访问）
        const newX = prev.x + (mouse.x - prev.x) * damping;
        const newY = prev.y + (mouse.y - prev.y) * damping;
        return { x: newX, y: newY };
      });
      rafId = requestAnimationFrame(updatePosition);
    };
    
    rafId = requestAnimationFrame(updatePosition);
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]); // 只在 hoveredId 改变时重新创建循环

  const hoveredItem = items.find((item) => item.id === hoveredId);

  return (
    <div className="relative">
      {/* 列表项 */}
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="group cursor-pointer"
          >
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-900 transition-colors group-hover:border-gray-400 dark:group-hover:border-gray-700">
              <div className="flex items-center gap-6">
                <span className="text-xs text-gray-500 dark:text-gray-500 font-mono w-12">
                  {item.quotes}
                </span>
                <h3 className="text-base font-normal text-gray-900 dark:text-gray-100 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {item.title}
                </h3>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 悬停时显示的图片 */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: ANIMATION.hoverDuration }}
            className="fixed pointer-events-none z-50"
            style={{
              left: imagePosition.x,
              top: imagePosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <motion.img
              src={hoveredItem.image}
              alt={hoveredItem.title}
              className="w-80 h-80 object-cover rounded-md shadow-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

