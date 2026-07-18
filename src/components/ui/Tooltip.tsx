"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delayMs?: number;
}

export function Tooltip({ content, children, side = "top", className = "", delayMs = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const positionClasses = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={[
            "absolute z-50 px-2.5 py-1.5 rounded-lg",
            "bg-[#1a1a1e] border border-white/15 shadow-xl shadow-black/40",
            "text-xs text-gray-200 font-medium whitespace-nowrap max-w-[200px] text-wrap",
            "pointer-events-none",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            positionClasses[side],
            className,
          ].join(" ")}
        >
          {content}
        </div>
      )}
    </div>
  );
}
