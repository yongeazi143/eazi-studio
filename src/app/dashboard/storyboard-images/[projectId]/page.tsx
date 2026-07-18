"use client";

import StoryboardGrid from "@/components/pipeline/StoryboardGrid";
import Link from "next/link";
import { useState, useEffect, use } from "react";
import PipelineStepper from "@/components/pipeline/PipelineStepper";
import { 
  Play, Pause, Trash2, ArrowRight, RefreshCw, 
  ExternalLink, Cpu, Sparkles, CheckCircle2, AlertCircle 
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { AlertDialog } from "@/components/ui/AlertDialog";

interface StoryboardGridPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

interface Scene {
  id: string;
  text: string;
  prompt: string;
  imageUrl?: string | null;
}

export default function StoryboardGridPage({ params }: StoryboardGridPageProps) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const { showToast } = useToast();
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [projectStatus, setProjectStatus] = useState<string>("PROMPTS");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Extension Integration States
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "paused">("idle");
  const [sceneStatuses, setSceneStatuses] = useState<Record<string, "idle" | "queued" | "generating" | "done" | "failed">>({});
  const [sceneErrors, setSceneErrors] = useState<Record<string, string>>({});
  const [lastPongTime, setLastPongTime] = useState<number>(0);

  // Modal Confirm states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. Fetch project details on mount
  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setProjectTitle(data.project.title);
          setProjectStatus(data.project.status);
          if (data.project.scenes && data.project.scenes.length > 0) {
            const sorted = [...data.project.scenes].sort((a: any, b: any) => a.index - b.index);
            setScenes(sorted.map((s: any) => ({
              id: s.id,
              text: s.narration,
              prompt: s.imagePrompt,
              imageUrl: s.imageUrl,
              startTime: s.startTime,
              endTime: s.endTime
            })));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load project details", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // 2. Extension Connection Ping-Pong Loop
  useEffect(() => {
    const interval = setInterval(() => {
      window.postMessage({ type: "EAZI_TRANSCRIBE_PING" }, "*");
    }, 2000);

    // Watchdog to disconnect if we don't receive pongs
    const watchdog = setInterval(() => {
      if (Date.now() - lastPongTime > 4000) {
        setIsExtensionConnected(false);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(watchdog);
    };
  }, [lastPongTime]);

  // Helper function to handle saving generated image to Next.js local storage assets
  const handleUploadResult = async (id: string, base64Image: string, isBatchMode = false) => {
    try {
      const uploadRes = await fetch("/api/scenes/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: id, base64Image }),
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        
        // Update local scenes array with new imageUrl and append a cache-busting timestamp
        const cacheBustedUrl = `${uploadData.imageUrl}?t=${Date.now()}`;
        setScenes(prev => prev.map(s => s.id === id ? { ...s, imageUrl: cacheBustedUrl } : s));
        setSceneStatuses(prev => ({ ...prev, [id]: "done" }));
        
        // Clear error if any
        setSceneErrors(prev => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });

        if (isBatchMode) {
          // Check if there is another queued scene in the batch list and transition it to generating
          setSceneStatuses(prevStatuses => {
            const nextQueuedScene = scenes.find(s => s.id !== id && !s.imageUrl && prevStatuses[s.id] === "queued");
            if (nextQueuedScene) {
              return { ...prevStatuses, [nextQueuedScene.id]: "generating" };
            }
            return prevStatuses;
          });
        }

        // Check if project status changed to FLOW_COMPLETE
        if (uploadData.completedCount === uploadData.totalCount) {
          setProjectStatus("FLOW_COMPLETE");
          setGenerationStatus("idle");
        }
      } else {
        const errText = await uploadRes.text();
        throw new Error(errText || "Failed to save generated image to local studio assets.");
      }
    } catch (uploadErr: any) {
      console.error("Local save error:", uploadErr);
      setSceneStatuses(prev => ({ ...prev, [id]: "failed" }));
      setSceneErrors(prev => ({ ...prev, [id]: uploadErr.message || "Failed to save image." }));
      if (isBatchMode) {
        setGenerationStatus("paused");
      }
    }
  };

  // 3. Listener for Extension Messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Secure check for Eazi Transcribe extension message types
      if (!event.data || typeof event.data !== "object") return;

      const { type, id, requestId, image, error } = event.data;

      if (type === "EAZI_TRANSCRIBE_PONG") {
        setIsExtensionConnected(true);
        setLastPongTime(Date.now());
      }

      // Handle batch queue generation result
      if (type === "EAZI_TRANSCRIBE_GENERATION_RESULT") {
        if (error) {
          console.error(`[Extension Bridge] Batch generation failed for scene ${id}:`, error);
          setSceneStatuses(prev => ({ ...prev, [id]: "failed" }));
          setSceneErrors(prev => ({ ...prev, [id]: error }));
          setGenerationStatus("paused");
        } else if (image) {
          console.log(`[Extension Bridge] Received generated base64 frame for scene ${id}`);
          setSceneStatuses(prev => ({ ...prev, [id]: "generating" })); // uploading status
          await handleUploadResult(id, image, true);
        }
      }

      // Handle single-request generation response
      if (type === "EAZI_TRANSCRIBE_RESPONSE") {
        const targetId = requestId || id;
        if (!targetId) return;

        if (error) {
          console.error(`[Extension Bridge] Single generation failed for scene ${targetId}:`, error);
          setSceneStatuses(prev => ({ ...prev, [targetId]: "failed" }));
          setSceneErrors(prev => ({ ...prev, [targetId]: error }));
        } else if (image) {
          console.log(`[Extension Bridge] Received single generated base64 frame for scene ${targetId}`);
          setSceneStatuses(prev => ({ ...prev, [targetId]: "generating" })); // uploading status
          await handleUploadResult(targetId, image, false);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [scenes, sceneStatuses]);

  // 4. Controls Actions
  const startGeneration = () => {
    if (!isExtensionConnected) return;

    const pendingScenes = scenes.filter(s => !s.imageUrl);
    if (pendingScenes.length === 0) {
      showToast("All storyboard frames have already been generated!", "info");
      return;
    }

    // Set statuses: first pending scene gets 'generating', others get 'queued'
    const newStatuses = { ...sceneStatuses };
    pendingScenes.forEach((s, index) => {
      newStatuses[s.id] = index === 0 ? "generating" : "queued";
    });
    setSceneStatuses(newStatuses);
    setGenerationStatus("generating");

    // Sync prompts list to extension background script
    window.postMessage({
      type: "EAZI_TRANSCRIBE_SYNC_PROMPTS",
      prompts: pendingScenes.map(s => ({ id: s.id, prompt: s.prompt }))
    }, "*");

    // Start background queue automation
    window.postMessage({ type: "EAZI_TRANSCRIBE_START_QUEUE" }, "*");
  };

  const pauseGeneration = () => {
    window.postMessage({ type: "EAZI_TRANSCRIBE_PAUSE_QUEUE" }, "*");
    setGenerationStatus("paused");

    // Revert active generating / queued scenes to idle in UI
    setSceneStatuses(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(id => {
        if (copy[id] === "generating" || copy[id] === "queued") {
          copy[id] = "idle";
        }
      });
      return copy;
    });
  };

  const clearQueue = () => {
    if (!confirm("Are you sure you want to stop generation and empty the pending extension queue?")) return;
    
    window.postMessage({ type: "EAZI_TRANSCRIBE_CLEAR_QUEUE" }, "*");
    setGenerationStatus("idle");

    // Reset statuses in UI
    setSceneStatuses(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(id => {
        if (copy[id] === "generating" || copy[id] === "queued") {
          copy[id] = "idle";
        }
      });
      return copy;
    });
  };

  const resetAllImages = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/scenes/reset-images?projectId=${projectId}`, { method: "POST" });
      if (res.ok) {
        setScenes(prev => prev.map(s => ({ ...s, imageUrl: null })));
        setSceneStatuses({});
        setSceneErrors({});
        setProjectStatus("PROMPTS");
        setGenerationStatus("idle");
        showToast("All storyboard images have been reset.", "success");
        setShowResetConfirm(false);
      } else {
        showToast("Failed to reset storyboard scenes. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error resetting storyboard scenes.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // 5. Individual Scene Callbacks
  const handleRegenerateScene = (scene: any) => {
    if (!isExtensionConnected) {
      showToast("Extension is disconnected. Please check your EaziStudio Automator connection.", "warning");
      return;
    }

    // Set UI state to queued
    setSceneStatuses(prev => ({ ...prev, [scene.id]: "queued" }));
    setSceneErrors(prev => {
      const copy = { ...prev };
      delete copy[scene.id];
      return copy;
    });

    // Add to Chrome Extension Queue
    window.postMessage({
      type: "EAZI_TRANSCRIBE_ADD_PROMPT",
      prompt: {
        id: scene.id,
        prompt: scene.prompt
      }
    }, "*");
  };

  const handleUpdateScenePrompt = async (sceneId: string, newPrompt: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/scenes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sceneId, imagePrompt: newPrompt }),
      });

      if (res.ok) {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, prompt: newPrompt } : s));
        showToast("Prompt updated successfully.", "success");
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update prompt.", "error");
        return false;
      }
    } catch (err) {
      console.error("Failed to update prompt:", err);
      showToast("Network error updating prompt.", "error");
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[600px] flex flex-col items-center justify-center text-center p-8 animate-pulse text-white">
        <div className="w-10 h-10 border-3 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-base font-bold">Loading project storyboard...</h3>
      </div>
    );
  }

  const generatedCount = scenes.filter(s => s.imageUrl).length;
  const isFinished = generatedCount === scenes.length;

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in text-foreground pb-20 px-4 md:px-0">
      {/* Top Stepper */}
      <PipelineStepper projectId={projectId} projectStatus={projectStatus} />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-black/10 dark:border-white/5 pb-4">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Workspace / Image Generation</span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-0.5">{projectTitle || "Storyboard Images"}</h1>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isFinished && (
            <Link 
              href={`/dashboard/thumbnail/${projectId}`} 
              className="px-5 py-2.5 text-xs font-bold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-md shadow-red-900/25 flex items-center gap-1.5"
            >
              Next: Thumbnail Creator <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Extension Bridge Connectivity Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isExtensionConnected 
          ? "bg-green-500/5 border-green-500/20" 
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border shrink-0 ${
            isExtensionConnected 
              ? "bg-green-500/10 border-green-500/20 text-green-400" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-500"
          }`}>
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">EaziStudio Extension Bridge</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isExtensionConnected 
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" 
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              }`}>
                {isExtensionConnected ? "CONNECTED" : "STANDBY"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {isExtensionConnected 
                ? "EaziStudio extension detected! Ready to automate storyboard image rendering."
                : "Chrome Extension not detected. Make sure the EaziStudio Automator extension is installed in developer mode and active."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 justify-end">

          {isExtensionConnected && (
            <>
              {generationStatus === "generating" ? (
                <button
                  onClick={pauseGeneration}
                  className="px-4 py-2.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause Queue
                </button>
              ) : (
                <button
                  onClick={startGeneration}
                  disabled={isFinished}
                  className="px-5 py-2.5 text-xs font-bold bg-green-500 hover:bg-green-650 disabled:bg-black/5 dark:disabled:bg-white/5 disabled:border-black/5 dark:disabled:border-white/5 disabled:text-gray-400 dark:disabled:text-gray-500 text-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> {generationStatus === "paused" ? "Resume Queue" : "Start Generation"}
                </button>
              )}

              {scenes.some(s => s.imageUrl) && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer animate-fade-in"
                  title="Reset all generated images"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="w-full mt-4">
        {scenes.length > 0 ? (
          <StoryboardGrid 
            scenes={scenes} 
            projectId={projectId}
            projectTitle={projectTitle || ""}
            statuses={sceneStatuses} 
            errors={sceneErrors}
            onRegenerate={handleRegenerateScene}
            onUpdatePrompt={handleUpdateScenePrompt}
          />
        ) : (
          <div className="text-center py-16 bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-3xl">
            <p className="text-gray-500 dark:text-gray-400 italic text-sm">No scenes generated yet. Please upload and transcribe your voiceover audio first.</p>
            <Link 
              href={`/dashboard/audio-transcript/${projectId}`} 
              className="mt-5 inline-flex px-5 py-2.5 text-xs font-semibold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-md shadow-red-900/10"
            >
              Go to Audio Workspace
            </Link>
          </div>
        )}
      </div>

      {/* Reset confirmation modal */}
      <AlertDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={resetAllImages}
        title="Reset All Generated Images?"
        description="Are you sure you want to delete ALL generated images and reset your storyboard frames? This action is permanent and cannot be undone."
        confirmLabel="Yes, Reset All"
        cancelLabel="Keep Images"
        variant="danger"
        isLoading={isResetting}
      />
    </div>
  );
}
