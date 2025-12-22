'use client';

import { useEffect, useRef } from 'react';
import Typed from 'typed.js';

export default function TypedText() {
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!el.current) return;

    const typed = new Typed(el.current, {
      strings: [
        "Busy coding!",
        "Code: focused",
        "Learning: immersed",
        "Dev: in progress",
        "Coding: intense",
        "Development: deep dive",
        "Immersed: coding"
      ],
      typeSpeed: 50,
      backDelay: 75,
      loop: true,
    });

    return () => {
      typed.destroy();
    };
  }, []);

  return (
    <h3 className="text-neutral-950 font-black text-2xl font-['Satoshi'] dark:text-white">
      <span ref={el} />
    </h3>
  );
}

