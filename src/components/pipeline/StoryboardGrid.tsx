import {
  ImagePlus, Download, Loader2, AlertCircle,
  CheckCircle, RefreshCw, Edit2, Check, X, Maximize2,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/context/ToastContext";

interface Scene {
  id: string;
  text: string;
  prompt: string;
  imageUrl?: string | null;
  startTime?: number;
  endTime?: number;
}

interface StoryboardGridProps {
  scenes: Scene[];
  projectId: string;
  projectTitle?: string;
  statuses?: Record<string, "idle" | "queued" | "generating" | "done" | "failed">;
  errors?: Record<string, string>;
  onRegenerate?: (scene: Scene) => void;
  onUpdatePrompt?: (sceneId: string, newPrompt: string) => Promise<boolean>;
}

export default function StoryboardGrid({
  scenes,
  projectId,
  projectTitle = "",
  statuses = {},
  errors = {},
  onRegenerate,
  onUpdatePrompt
}: StoryboardGridProps) {
  const { showToast } = useToast();
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editPromptValue, setEditPromptValue] = useState<string>("");
  const [savingPromptId, setSavingPromptId] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Swipe gesture state for touch screens
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe Left -> Next scene
      setActiveImageIndex(prev => prev !== null ? (prev + 1) % scenes.length : null);
    } else if (isRightSwipe) {
      // Swipe Right -> Prev scene
      setActiveImageIndex(prev => prev !== null ? (prev - 1 + scenes.length) % scenes.length : null);
    }
  };

  // Keyboard navigation for image modal gallery
  useEffect(() => {
    if (activeImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveImageIndex(prev => prev !== null ? (prev - 1 + scenes.length) % scenes.length : null);
      } else if (e.key === "ArrowRight") {
        setActiveImageIndex(prev => prev !== null ? (prev + 1) % scenes.length : null);
      } else if (e.key === "Escape") {
        setActiveImageIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, scenes.length]);

  if (!scenes || scenes.length === 0) return null;

  const startEditing = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditPromptValue(scene.prompt);
  };

  const cancelEditing = () => {
    setEditingSceneId(null);
    setEditPromptValue("");
  };

  const savePrompt = async (sceneId: string) => {
    if (!onUpdatePrompt || !editPromptValue.trim()) return;
    setSavingPromptId(sceneId);
    try {
      const success = await onUpdatePrompt(sceneId, editPromptValue.trim());
      if (success) {
        setEditingSceneId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPromptId(null);
    }
  };


  const handleDownloadZip = async () => {
    const generatedScenes = scenes.filter(s => s.imageUrl);
    if (generatedScenes.length === 0) {
      showToast("No generated images to download yet.", "warning");
      return;
    }

    setIsZipping(true);
    try {
      const JSZipModule = await import("jszip");
      // @ts-ignore
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();
      
      const formattedTitle = projectTitle ? projectTitle.trim().replace(/[\/\\:*?"<>|]/g, "_") : projectId;
      const folderName = `${formattedTitle}-storyboard`;
      const folder = zip.folder(folderName);

      const formatSecs = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
      };

      await Promise.all(
        scenes.map(async (scene, idx) => {
          if (!scene.imageUrl) return;
          try {
            const response = await fetch(scene.imageUrl);
            const blob = await response.blob();
            const timeStr = formatSecs(scene.startTime ?? 0);
            const filename = `${idx + 1}-[${timeStr}].png`;
            folder?.file(filename, blob);
          } catch (err) {
            console.error(`Failed to fetch image for scene ${idx + 1}:`, err);
          }
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(content);
      element.download = `${folderName}.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err: any) {
      console.error("Failed to generate ZIP file:", err);
      showToast(`Failed to export images zip: ${err.message || err}`, "error");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full">
      {/* Grid header and global controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Storyboard Assets</h3>
          <p className="text-xs text-gray-550 dark:text-gray-400 mt-0.5">Review generated frames, customize prompts, and trigger individual scene renders.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={isZipping || !scenes.some(s => s.imageUrl)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E00C1D] hover:bg-[#b0060f] disabled:bg-black/5 dark:disabled:bg-white/5 disabled:border-black/5 dark:disabled:border-white/5 disabled:text-gray-400 dark:disabled:text-gray-500 text-sm font-bold text-white transition-all shadow-md shadow-red-900/10 cursor-pointer disabled:cursor-not-allowed"
          >
            {isZipping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isZipping ? "Creating ZIP..." : "Download Scenes"}
          </button>
        </div>
      </div>

      {/* 4-Column Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {scenes.map((scene, index) => {
          const status = statuses[scene.id] || (scene.imageUrl ? "done" : "idle");
          const error = errors[scene.id];
          const isEditing = editingSceneId === scene.id;
          const isSaving = savingPromptId === scene.id;

          return (
            <div
              key={scene.id}
              className={`bg-white dark:bg-white/[0.02] border rounded-2xl overflow-hidden hover:bg-black/[0.01] dark:hover:bg-white/[0.03] transition-all flex flex-col relative ${status === "generating"
                ? "border-[#E00C1D]/40 bg-[#E00C1D]/5"
                : status === "queued"
                  ? "border-amber-500/25 bg-amber-500/2"
                  : status === "failed"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-black/10 dark:border-white/5 hover:border-black/20 dark:hover:border-white/15"
                }`}
            >
              {/* Image box container */}
              <div
                className="relative aspect-video w-full bg-black flex items-center justify-center border-b border-black/10 dark:border-white/5 group overflow-hidden cursor-zoom-in"
                onClick={() => {
                  setActiveImageIndex(index);
                }}
              >
                {scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={`Scene ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 select-none"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    {status === "generating" ? (
                      <>
                        <Loader2 className="w-8 h-8 text-[#E00C1D] animate-spin" />
                        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest animate-pulse">
                          Generating...
                        </span>
                      </>
                    ) : status === "queued" ? (
                      <>
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest">
                          Queued...
                        </span>
                      </>
                    ) : status === "failed" ? (
                      <>
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">
                          Render Failed
                        </span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 stroke-[1.5]" />
                        <span className="text-[10px] font-mono text-gray-500 font-bold uppercase tracking-widest">
                          Standby
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Badge Number */}
                <div className="absolute top-3 left-3 z-20">
                  <span className="text-xs font-bold text-gray-800 dark:text-white bg-white/90 dark:bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 shadow-md">
                    {index + 1}
                  </span>
                </div>

                {/* Status Icon Overlay (Done) */}
                {status === "done" && (
                  <div className="absolute top-3 right-3 z-20">
                    <CheckCircle className="w-4 h-4 text-green-400 fill-green-950/80" />
                  </div>
                )}

                {/* Regenerate Button Overlay at bottom right of image */}
                {onRegenerate && (
                  <div className="absolute bottom-3 right-3 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent opening zoom modal
                        onRegenerate(scene);
                      }}
                      disabled={status === "generating" || status === "queued"}
                      className={`p-2 rounded-lg backdrop-blur-md border shadow-lg transition-all cursor-pointer ${status === "generating" || status === "queued"
                        ? "bg-black/40 border-white/5 text-gray-500 cursor-not-allowed"
                        : "bg-white/80 dark:bg-black/60 hover:bg-[#E00C1D] hover:text-white border-black/10 dark:border-white/10 text-gray-900 dark:text-white"
                        }`}
                      title="Regenerate single frame"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${status === "generating" ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                )}

                {/* Overlay indicating generating status over existing image */}
                {(status === "generating" || status === "queued") && scene.imageUrl && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
                    <Loader2 className={`w-6 h-6 animate-spin ${status === "generating" ? "text-[#E00C1D]" : "text-amber-500"}`} />
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-gray-300">
                      {status === "generating" ? "Regenerating..." : "In Queue..."}
                    </span>
                  </div>
                )}
              </div>

              {/* Text metadata content box */}
              <div className="p-5 flex-1 flex flex-col gap-4">


                {/* 2. Visual Prompt Generation Prompt */}
                <div className="flex flex-col gap-2 min-h-[90px] justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Visual Scene Prompt</span>
                    {!isEditing && (
                      <button
                        onClick={() => startEditing(scene)}
                        className="text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors cursor-pointer"
                        title="Edit visual prompt"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2 w-full animate-fade-in">
                      <textarea
                        value={editPromptValue}
                        onChange={(e) => setEditPromptValue(e.target.value)}
                        className="w-full h-24 bg-black/[0.02] dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-lg p-2 text-[11px] text-gray-900 dark:text-white focus:outline-none focus:border-[#E00C1D]/50 transition-all font-mono resize-none overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/20 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                      />
                      <div className="flex items-center gap-2 self-end">
                        <button
                          onClick={cancelEditing}
                          className="px-2.5 py-1 text-[10px] font-semibold text-gray-550 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => savePrompt(scene.id)}
                          disabled={isSaving}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#E00C1D] text-white rounded transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 justify-between">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono leading-relaxed line-clamp-3 flex-1">
                        {scene.prompt}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Zoom Gallery Modal */}
      {activeImageIndex !== null && scenes[activeImageIndex] && (() => {
        const currentScene = scenes[activeImageIndex];

        return (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in select-none"
            onClick={() => setActiveImageIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Close button */}
            <button
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 border border-white/15 hover:bg-[#E00C1D] text-white hover:scale-105 hover:border-transparent transition-all cursor-pointer z-50 animate-fade-in"
              onClick={() => setActiveImageIndex(null)}
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Navigation buttons */}
            {scenes.length > 1 && (
              <>
                <button
                  className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/5 border border-white/10 hover:bg-[#E00C1D] hover:scale-105 hover:border-transparent text-white transition-all z-50 cursor-pointer animate-fade-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((activeImageIndex - 1 + scenes.length) % scenes.length);
                  }}
                  title="Previous image (← / Swipe Right)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/5 border border-white/10 hover:bg-[#E00C1D] hover:scale-105 hover:border-transparent text-white transition-all z-50 cursor-pointer animate-fade-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((activeImageIndex + 1) % scenes.length);
                  }}
                  title="Next image (→ / Swipe Left)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Top Frame Counter Info */}
            <div className="mb-4 bg-white/10 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-gray-250 z-10 animate-fade-in">
              Frame {activeImageIndex + 1} of {scenes.length}
            </div>

            {/* Content Container (Image or Standby Placeholder) */}
            <div
              className="max-w-[85vw] max-h-[65vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {currentScene.imageUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl flex items-center justify-center animate-fade-in max-h-[65vh]">
                  <img
                    src={currentScene.imageUrl}
                    alt={`Zoomed Storyboard Frame ${activeImageIndex + 1}`}
                    className="max-w-full max-h-[65vh] object-contain select-none transition-all duration-350"
                  />
                </div>
              ) : (
                <div className="w-[85vw] max-w-[640px] aspect-video rounded-2xl border border-white/15 bg-black/80 flex flex-col items-center justify-center gap-2.5 text-gray-500 shadow-2xl animate-fade-in p-6">
                  <ImagePlus className="w-12 h-12 stroke-[1.2] text-gray-400" />
                  <span className="text-xs font-mono text-gray-400 font-bold uppercase tracking-widest">
                    Standby (No Image)
                  </span>
                  <p className="text-[10px] text-gray-500 max-w-[280px] text-center mt-1">
                    This frame has no generated image yet. Use start generation or trigger this scene's render in the workspace.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Text/Narration Card */}
            {currentScene.text && (
              <div
                className="max-w-xl w-full text-center px-5 py-3.5 bg-black/65 border border-white/10 backdrop-blur-md rounded-xl mt-5 z-10 max-h-[12vh] overflow-y-auto cursor-default select-text shadow-lg animate-fade-in [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[9px] text-[#E00C1D] font-bold uppercase tracking-widest mb-1.5">Narration Script</p>
                <p className="text-xs font-medium text-gray-250 leading-relaxed dark:text-gray-250">{currentScene.text}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
