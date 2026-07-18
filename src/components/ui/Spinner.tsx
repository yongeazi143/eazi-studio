type SpinnerSize = "sm" | "md" | "lg" | "xl";
type SpinnerColor = "red" | "white" | "gray";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
  xl: "w-12 h-12 border-[3px]",
};

const colorClasses: Record<SpinnerColor, string> = {
  red:   "border-[#E00C1D]/20 border-t-[#E00C1D]",
  white: "border-white/20 border-t-white",
  gray:  "border-gray-700 border-t-gray-400",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
  label?: string;
}

export function Spinner({ size = "md", color = "red", className = "", label }: SpinnerProps) {
  return (
    <div role="status" className={`flex flex-col items-center gap-3 ${className}`}>
      <div className={`rounded-full border-solid animate-spin ${sizeClasses[size]} ${colorClasses[color]}`} />
      {label && <p className="text-sm text-gray-400 animate-pulse">{label}</p>}
      <span className="sr-only">Loading\u2026</span>
    </div>
  );
}
