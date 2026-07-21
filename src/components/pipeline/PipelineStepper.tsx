"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, FileText, Mic, Image, Play, Check, Tv } from "lucide-react";

interface PipelineStepperProps {
  projectId?: string;
  projectStatus?: string;
}

const STEPS = [
  {
    id: "ideation",
    label: "Ideation",
    icon: Sparkles,
    route: (id: string) => `/dashboard/ideation?id=${id}`,
    unlockedBy: ["IDEA", "TITLE", "SCRIPT", "AUDIO", "TRANSCRIPT", "PROMPTS", "FLOW_PENDING", "FLOW_COMPLETE", "ASSETS_READY", "EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
  {
    id: "script",
    label: "Scripting",
    icon: FileText,
    route: (id: string) => `/dashboard/script/${id}`,
    unlockedBy: ["SCRIPT", "AUDIO", "TRANSCRIPT", "PROMPTS", "FLOW_PENDING", "FLOW_COMPLETE", "ASSETS_READY", "EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
  {
    id: "audio",
    label: "Voiceover",
    icon: Mic,
    route: (id: string) => `/dashboard/audio-transcript/${id}`,
    unlockedBy: ["AUDIO", "TRANSCRIPT", "PROMPTS", "FLOW_PENDING", "FLOW_COMPLETE", "ASSETS_READY", "EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
  {
    id: "images",
    label: "Storyboard",
    icon: Image,
    route: (id: string) => `/dashboard/storyboard-images/${id}`,
    unlockedBy: ["PROMPTS", "FLOW_PENDING", "FLOW_COMPLETE", "ASSETS_READY", "EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
  {
    id: "thumbnail",
    label: "Thumbnail",
    icon: Tv,
    route: (id: string) => `/dashboard/thumbnail/${id}`,
    unlockedBy: ["PROMPTS", "FLOW_PENDING", "FLOW_COMPLETE", "ASSETS_READY", "EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
  {
    id: "publish",
    label: "Publish",
    icon: Play,
    route: (id: string) => `/dashboard/publish/${id}`,
    unlockedBy: ["EDITING", "METADATA", "THUMBNAIL", "DONE"],
  },
];

/* ── Shared class helpers ──────────────────────────────────────────────────── */

/** Circle bg/border/icon color for each state */
const circleClass = (isActive: boolean, isCompleted: boolean, locked = false) => {
  if (isActive)
    return "bg-[#E00C1D] border-[#E00C1D] text-white shadow-[0_0_18px_rgba(224,12,29,0.45)] scale-110";
  if (isCompleted)
    return "bg-green-500/15 border-green-500 text-green-500 dark:text-green-400";
  if (locked)
    // locked step: subtle in both themes
    return [
      "bg-black/[0.04] dark:bg-[#0e0e10]",
      "border-black/10 dark:border-white/5",
      "text-gray-300 dark:text-gray-700",
    ].join(" ");
  // unlocked but not active / not completed
  return [
    "bg-black/[0.06] dark:bg-[#0e0e10]",
    "border-black/15 dark:border-white/15",
    "text-gray-500 dark:text-gray-400",
  ].join(" ");
};

/** Label color for each state */
const labelClass = (isActive: boolean, isCompleted: boolean, locked = false) => {
  if (isActive)    return "text-[#E00C1D]";
  if (isCompleted) return "text-green-500 dark:text-green-400";
  if (locked)      return "text-gray-300 dark:text-gray-700";
  return "text-gray-500 dark:text-gray-500";
};

export default function PipelineStepper({ projectId, projectStatus = "IDEA" }: PipelineStepperProps) {
  const pathname = usePathname();

  const getActiveStepIndex = () => {
    if (pathname.includes("/ideation"))         return 0;
    if (pathname.includes("/script"))           return 1;
    if (pathname.includes("/audio"))            return 2;
    if (pathname.includes("/storyboard-images")) return 3;
    if (pathname.includes("/thumbnail"))        return 4;
    if (pathname.includes("/publish"))          return 5;
    return -1;
  };

  const activeIndex = getActiveStepIndex();

  return (
    <div className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/5 rounded-2xl px-6 py-4 mb-2 backdrop-blur-md">
      {/* Row: nodes with connector lines between them */}
      <div className="flex items-start justify-between max-w-2xl mx-auto">
        {STEPS.map((step, idx) => {
          const isUnlocked = projectId && step.unlockedBy.includes(projectStatus);
          const isActive   = activeIndex === idx;
          const isCompleted = activeIndex > idx;
          const isLocked   = !isUnlocked;

          const circleBase = `relative w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300`;

          const node = (
            <div key={step.id} className="flex items-center">
              {/* Step node */}
              <div className="flex flex-col items-center gap-2">
                {isUnlocked && projectId ? (
                  /* Unlocked — clickable */
                  <Link href={step.route(projectId)} className="flex flex-col items-center gap-2 group cursor-pointer">
                    <div
                      className={`${circleBase} group-hover:scale-105 ${circleClass(isActive, isCompleted)}`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <step.icon className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] md:text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors hidden sm:block ${labelClass(isActive, isCompleted)} ${!isActive && !isCompleted ? "group-hover:text-gray-800 dark:group-hover:text-gray-300" : ""}`}
                    >
                      {step.label}
                    </span>
                  </Link>
                ) : (
                  /* Locked — not clickable */
                  <div className="flex flex-col items-center gap-2 cursor-not-allowed">
                    <div className={`${circleBase} ${circleClass(isActive, isCompleted, isLocked)}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] md:text-[11px] font-semibold tracking-wide whitespace-nowrap hidden sm:block ${labelClass(isActive, isCompleted, isLocked)}`}>
                      {step.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Connector line after this step (not after the last step) */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2 mb-0 sm:mb-5">
                  <div className="h-[2px] w-full bg-black/[0.06] dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-[#E00C1D] transition-all duration-500 ease-in-out"
                      style={{ width: activeIndex > idx ? "100%" : activeIndex === idx ? "50%" : "0%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          );

          return node;
        })}
      </div>
      
      {/* Mobile-only active step text */}
      {activeIndex >= 0 && (
        <div className="text-center mt-3 sm:hidden border-t border-black/5 dark:border-white/5 pt-2">
          <span className="text-[9px] text-gray-500 font-mono font-bold uppercase tracking-wider">Active Workspace Step</span>
          <h4 className="text-xs font-extrabold text-[#E00C1D] mt-0.5">{STEPS[activeIndex]?.label}</h4>
        </div>
      )}
    </div>
  );
}
