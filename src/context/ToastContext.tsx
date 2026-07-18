"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      {/* Toast Container Overlay */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const iconMap = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />,
            info: <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />,
          };

          const styleMap = {
            success: "bg-emerald-50/95 dark:bg-emerald-950/20 border-emerald-500/20 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-100",
            error: "bg-red-50/95 dark:bg-red-950/20 border-red-500/20 dark:border-red-500/30 text-red-900 dark:text-red-100",
            warning: "bg-amber-50/95 dark:bg-amber-950/20 border-amber-500/20 dark:border-amber-500/30 text-amber-900 dark:text-amber-100",
            info: "bg-blue-50/95 dark:bg-blue-950/20 border-blue-500/20 dark:border-blue-500/30 text-blue-900 dark:text-blue-100",
          };

          return (
            <div
              key={toast.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 pointer-events-auto animate-slide-in text-left",
                styleMap[toast.type] || "bg-white/95 dark:bg-[#0F0E15]/95 border-black/10 dark:border-white/10 text-gray-900 dark:text-gray-200"
              )}
            >
              {iconMap[toast.type]}
              <div className="flex-grow text-xs font-semibold leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
