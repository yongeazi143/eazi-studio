import { type ReactNode } from "react";

type BadgeVariant = "default" | "red" | "green" | "amber" | "blue" | "purple" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/8 text-gray-300 border border-white/10",
  red:     "bg-[#E00C1D]/15 text-red-400 border border-[#E00C1D]/20",
  green:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  amber:   "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  blue:    "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  purple:  "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  outline: "bg-transparent text-gray-400 border border-white/15",
};

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ children, variant = "default", icon, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
