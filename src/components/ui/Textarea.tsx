import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, hint, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          "w-full rounded-xl bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500",
          "px-3 py-2.5 transition-all duration-150 outline-none resize-none",
          "hover:border-black/20 hover:bg-black/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
          "focus:border-[#E00C1D]/50 focus:ring-2 focus:ring-[#E00C1D]/20 dark:focus:bg-white/[0.06]",
          error ? "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20" : "",
          props.disabled ? "opacity-50 cursor-not-allowed" : "",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
