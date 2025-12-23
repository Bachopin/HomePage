'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ANIMATION } from '@/lib/config';

export default function CrosshairToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial dark mode state
    const darkMode = localStorage.getItem('darkMode') === 'true' || 
                     (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div 
      className="fixed top-0 left-0 w-full flex items-center justify-center z-[9999] pointer-events-none"
      style={{ height: '100svh' }}
    >
      <motion.button
        onClick={toggleDarkMode}
        className="relative pointer-events-auto cursor-pointer group"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: ANIMATION.hoverDuration }}
        aria-label="Toggle dark mode"
      >
        {/* 背景圆圈增强对比度 */}
        <div className="absolute inset-0 w-8 h-8 -m-2 bg-white/80 dark:bg-black/80 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative z-10 text-neutral-800 dark:text-neutral-200 drop-shadow-sm"
        >
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      </motion.button>
    </div>
  );
}

