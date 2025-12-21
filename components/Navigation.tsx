'use client';

import { useState } from 'react';

const navItems = [
  { href: '#', label: 'All', id: 'all' },
  { href: '#about', label: 'About', id: 'about' },
  { href: '#projects', label: 'Projects', id: 'projects' },
  { href: '#other', label: 'Others', id: 'other' },
];

export default function Navigation() {
  const [activeLink, setActiveLink] = useState('all');

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveLink(id);
    
    // 获取所有卡片
    const cards = document.querySelectorAll('.card');
    
    // 移除所有卡片的模糊效果
    cards.forEach(card => {
      card.classList.remove('blur-sm');
    });

    // 根据点击的链接添加模糊效果
    if (id === 'all') {
      // 所有卡片都不模糊
      return;
    }

    if (id === 'about') {
      const busyElement = document.getElementById('busy');
      const twitter = document.getElementById('twitter');
      if (busyElement) busyElement.classList.remove('blur-sm');
      if (twitter) twitter.classList.remove('blur-sm');
      
      // 模糊其他卡片
      cards.forEach(card => {
        if (card.id !== 'busy' && card.id !== 'twitter') {
          card.classList.add('blur-sm');
        }
      });
    }

    if (id === 'projects') {
      const projectsElement = document.getElementById('projects');
      if (projectsElement) projectsElement.classList.remove('blur-sm');
      
      // 模糊其他卡片
      cards.forEach(card => {
        if (card.id !== 'projects') {
          card.classList.add('blur-sm');
        }
      });
    }

    if (id === 'other') {
      const queueContainer = document.getElementById('queueContainer');
      const otherElement = document.getElementById('other');
      if (otherElement) otherElement.classList.remove('blur-sm');
      if (queueContainer) queueContainer.classList.remove('blur-sm');
      
      // 模糊其他卡片
      cards.forEach(card => {
        if (card.id !== 'other' && card.id !== 'queueContainer') {
          card.classList.add('blur-sm');
        }
      });
    }
  };

  return (
    <header
      id="navbar"
      className="flex flex-col justify-between items-center py-4 gap-6 sticky top-0 left-0 z-20 tablet:static bg-stone-100 dark:bg-neutral-700 dark:shadow-sm tablet:dark:shadow-none tablet:shadow-none desktop:h-32 tablet:flex-row tablet:px-[3.5vw]"
    >
      <a href="#" className="font-['Cabinet_Grotesk'] text-xl font-extrabold bg-gradient-to-tl from-violet-600 to-indigo-300 bg-clip-text text-transparent">
        Your Name
      </a>
      <div className="p-[5px] bg-white rounded-full flex dark:backdrop-blur-2xl dark:bg-transparent dark:bg-gradient-to-tl from-transparent to-white/30 from-[0%] to-[1000%] dark:border dark:border-stone-300;">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.id)}
            className={activeLink === item.id ? 'link linkActive' : 'link'}
          >
            {item.label}
          </a>
        ))}
      </div>
      <a href="#contact" className="font-bold text-neutral-950 hover:text-neutral-400 dark:text-neutral-300 dark:hover:text-white hidden tablet:block desktop:block">
        Contact
      </a>
    </header>
  );
}
