'use client';

import { useEffect, useState } from 'react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // 检查本地存储或系统偏好
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
    <div className="card flex justify-center items-center min-h-[323px] desktop:min-h-[283px] desktop:col-span-1 desktop:order-3">
      <input
        type="checkbox"
        id="toggleBtn"
        className="hidden peer"
        checked={isDark}
        onChange={toggleDarkMode}
      />
      <label
        htmlFor="toggleBtn"
        className="w-[72px] p-[6px] flex justify-start items-center rounded-full bg-neutral-300 peer-checked:justify-end dark:bg-transparent dark:bg-gradient-to-tl from-transparent to-white/30 from-[-90%] to-[70%] dark:border dark:border-stone-300 cursor-pointer"
      >
        <div className="p-[6px] flex flex-row rounded-full bg-neutral-950 toggleCircle">
          <div
            id="btnIcon"
            className={`bg-center bg-cover h-6 w-6 ease-in-out duration-150 ${
              isDark 
                ? "bg-[url('/sun.svg')]" 
                : "bg-[url('/moon.svg')]"
            }`}
          />
        </div>
      </label>
    </div>
  );
}

