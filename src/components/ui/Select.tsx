"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  label,
  disabled = false,
  className = "",
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const selectId = id ?? uid;

  const selectedOption = options.find((o) => o.value === value);
  const enabledOptions = options.filter((o) => !o.disabled);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const currentEnabled = options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled);
    const currentEnabledIndex = currentEnabled.findIndex(({ i }) => i === highlightedIndex);

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const selIndex = options.findIndex((o) => o.value === value);
          setHighlightedIndex(selIndex >= 0 ? selIndex : currentEnabled[0]?.i ?? 0);
        } else if (highlightedIndex >= 0 && !options[highlightedIndex]?.disabled) {
          onChange(options[highlightedIndex].value);
          setOpen(false);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setHighlightedIndex(currentEnabled[0]?.i ?? 0);
        } else {
          const next = currentEnabled[Math.min(currentEnabledIndex + 1, currentEnabled.length - 1)];
          if (next) setHighlightedIndex(next.i);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) {
          const prev = currentEnabled[Math.max(currentEnabledIndex - 1, 0)];
          if (prev) setHighlightedIndex(prev.i);
        }
        break;
      case "Escape":
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-gray-400 mb-1.5 ml-0.5"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            if (!open) {
              const selIndex = options.findIndex((o) => o.value === value);
              setHighlightedIndex(selIndex >= 0 ? selIndex : 0);
            }
          }
        }}
        onKeyDown={handleKeyDown}
        className={[
          "relative w-full flex items-center justify-between gap-2",
          "min-h-9 px-3 rounded-xl",
          "text-sm text-left",
          "bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/[0.08]",
          "text-gray-900 dark:text-white placeholder:text-gray-500",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00C1D]/50 focus-visible:border-[#E00C1D]/50",
          open ? "border-[#E00C1D]/40 ring-2 ring-[#E00C1D]/20" : "hover:border-black/20 hover:bg-black/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span className={`flex items-center gap-2 truncate ${!selectedOption ? "text-gray-450 dark:text-gray-500" : ""}`}>
          {selectedOption?.icon && (
            <span className="shrink-0 text-gray-400">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          className={`shrink-0 w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popup */}
      {open && (
        <div
          className={[
            "absolute z-50 w-full mt-1.5",
            "bg-white dark:bg-[#1a1a1e] border border-black/10 dark:border-white/10 rounded-xl",
            "shadow-2xl shadow-black/10 dark:shadow-black/60",
            "overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          ].join(" ")}
          style={{ maxHeight: "320px" }}
        >
          <ul
            ref={listRef}
            role="listbox"
            className={[
              "overflow-y-auto p-1.5 pb-2 flex flex-col gap-0.5",
              // Light mode scrollbar
              "[&::-webkit-scrollbar]:w-1.5",
              "[&::-webkit-scrollbar-track]:bg-black/5",
              "[&::-webkit-scrollbar-track]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-black/20",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:hover:bg-black/35",
              // Dark mode scrollbar
              "dark:[&::-webkit-scrollbar-track]:bg-white/5",
              "dark:[&::-webkit-scrollbar-thumb]:bg-white/20",
              "dark:[&::-webkit-scrollbar-thumb]:hover:bg-white/35",
            ].join(" ")}
            style={{ maxHeight: "316px" }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;
              const isDisabled = !!option.disabled;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  onMouseEnter={() => !isDisabled && setHighlightedIndex(index)}
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer",
                    "transition-colors duration-100",
                    isDisabled
                      ? "opacity-45 cursor-not-allowed text-gray-400 dark:text-gray-500"
                      : isHighlighted
                      ? "bg-black/5 dark:bg-white/[0.08] text-gray-900 dark:text-white"
                      : isSelected
                      ? "bg-[#E00C1D]/5 text-[#E00C1D] dark:text-white dark:bg-transparent"
                      : "text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white",
                  ].join(" ")}
                >
                  {option.icon && (
                    <span className="shrink-0 text-gray-400">{option.icon}</span>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-500 truncate mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="shrink-0 w-3.5 h-3.5 text-[#E00C1D]" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
