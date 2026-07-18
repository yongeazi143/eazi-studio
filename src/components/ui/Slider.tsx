"use client";

import { useId, useRef, useCallback } from "react";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue,
  disabled = false,
  className = "",
}: SliderProps) {
  const uid = useId();
  const trackRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toString();

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, snapped)));
    },
    [disabled, min, max, step, onChange]
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={uid}
              className="text-xs font-semibold text-gray-400"
            >
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-xs font-mono text-gray-300 tabular-nums">
              {displayValue}
            </span>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        className="relative h-5 flex items-center cursor-pointer group"
        onClick={handleTrackClick}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />

        {/* Filled portion */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-[#E00C1D] transition-none"
          style={{ width: `${percentage}%` }}
        />

        {/* Native input for keyboard/accessibility */}
        <input
          id={uid}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={[
            "absolute inset-0 w-full opacity-0 cursor-pointer h-full",
            disabled ? "cursor-not-allowed" : "",
          ].join(" ")}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
        />

        {/* Thumb */}
        <div
          className={[
            "absolute w-4 h-4 rounded-full bg-white shadow-md",
            "border-2 border-[#E00C1D]",
            "transition-transform duration-100",
            "group-hover:scale-110",
            "-translate-x-1/2",
            disabled ? "opacity-40" : "",
          ].join(" ")}
          style={{ left: `${percentage}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
