import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightElement, error, wrapperClassName = "", className = "", ...props }, ref) => {
    return (
      <div className={`relative flex items-center ${wrapperClassName}`}>
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none [&_svg]:w-4 [&_svg]:h-4">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={[
            "w-full min-h-9 rounded-xl bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "px-3 py-2 transition-all duration-150 outline-none",
            "hover:border-black/20 hover:bg-black/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
            "focus:border-[#E00C1D]/50 focus:ring-2 focus:ring-[#E00C1D]/20 dark:focus:bg-white/[0.06]",
            error ? "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20" : "",
            leftIcon ? "pl-9" : "",
            rightElement ? "pr-10" : "",
            props.disabled ? "opacity-50 cursor-not-allowed" : "",
            className,
          ].join(" ")}
          {...props}
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:w-4 [&_svg]:h-4">
            {rightElement}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ─── Field ────────────────────────────────────────────────────────────────────

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Field({ label, hint, error, required, children, className = "", id }: FieldProps) {
  const uid = useId();
  const fieldId = id ?? uid;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-0.5"
        >
          {label}
          {required && <span className="text-[#E00C1D] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-600 ml-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 ml-0.5">{error}</p>
      )}
    </div>
  );
}
