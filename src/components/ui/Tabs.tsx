"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

// ─── Context ─────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab components must be used within <Tabs>");
  return ctx;
}

// ─── Tabs Root ────────────────────────────────────────────────────────────────

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className = "" }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ─── TabList ─────────────────────────────────────────────────────────────────

export interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = "" }: TabListProps) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export interface TabProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, icon, disabled = false, className = "" }: TabProps) {
  const { value: activeValue, onChange } = useTabsContext();
  const isActive = activeValue === value;
  const uid = useId();

  return (
    <button
      id={`tab-${uid}`}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${uid}`}
      disabled={disabled}
      onClick={() => !disabled && onChange(value)}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00C1D]/50",
        isActive
          ? "bg-[#E00C1D] text-white shadow-sm shadow-[#E00C1D]/20"
          : "text-gray-400 hover:text-white hover:bg-white/[0.06]",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {icon && <span className="shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>}
      {children}
    </button>
  );
}

// ─── TabPanel ────────────────────────────────────────────────────────────────

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
  keepMounted?: boolean;
}

export function TabPanel({ value, children, className = "", keepMounted = false }: TabPanelProps) {
  const { value: activeValue } = useTabsContext();
  const isActive = activeValue === value;

  if (!keepMounted && !isActive) return null;

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      className={className}
    >
      {children}
    </div>
  );
}
