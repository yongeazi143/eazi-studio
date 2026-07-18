"use client";

import { useTheme, type Theme } from "@/context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

export interface ThemeSwitcherProps {
  isCollapsed?: boolean;
}

export function ThemeSwitcher({ isCollapsed = false }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; label: string; Icon: any }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  if (isCollapsed) {
    // Cycle theme on click in collapsed mode
    const handleCycle = () => {
      const currentIndex = options.findIndex((opt) => opt.value === theme);
      const nextIndex = (currentIndex + 1) % options.length;
      setTheme(options[nextIndex].value);
    };

    const activeOption = options.find((opt) => opt.value === theme) || options[2];
    const ActiveIcon = activeOption.Icon;

    return (
      <div className="relative group shrink-0">
        <button
          onClick={handleCycle}
          className="p-2 text-gray-500 hover:text-[#E00C1D] dark:text-gray-500 dark:hover:text-[#E00C1D] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
        >
          <ActiveIcon className="w-4 h-4" />
        </button>
        <span className="
          absolute left-full ml-5 px-3 py-1.5 z-50 top-1/2 -translate-y-1/2
          bg-white dark:bg-[#121214]/95 backdrop-blur-md text-gray-900 dark:text-white text-[12.5px] font-semibold
          rounded-xl border border-black/10 dark:border-red-500/20 shadow-[0_4px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(224,12,29,0.15)]
          whitespace-nowrap pointer-events-none
          opacity-0 translate-x-[-6px]
          group-hover:opacity-100 group-hover:translate-x-0
          transition-all duration-200
        ">
          Theme: {activeOption.label} (Click to cycle)
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center p-0.5 bg-black/[0.04] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl w-full">
      {options.map((opt) => {
        const isActive = theme === opt.value;
        const Icon = opt.Icon;

        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer
              ${isActive
                ? "bg-[#E00C1D] !text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.04]"
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
