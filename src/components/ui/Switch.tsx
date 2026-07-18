"use client";

import { useId } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, description, disabled = false, id }: SwitchProps) {
  const uid = useId();
  const switchId = id ?? uid;

  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={switchId}
              className={`text-sm font-medium ${disabled ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-200"} cursor-pointer`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-450 mt-0.5">{description}</p>
          )}
        </div>
      )}

      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00C1D]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0e0e10]",
          checked ? "bg-[#E00C1D]" : "bg-black/10 dark:bg-white/10",
          disabled ? "opacity-40 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md",
            "transform transition-transform duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
