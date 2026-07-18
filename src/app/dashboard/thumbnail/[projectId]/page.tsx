"use client";

import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles, Cpu,
  RefreshCw, Trash2, Copy, Check, Tv, Play, Download,
  Volume2, Maximize, Settings, RotateCcw, AlertCircle,
  GalleryThumbnails, Eye, Edit3, Save, Layers, Compass,
  Type, Image as ImageIcon, CheckCircle, HelpCircle,
  ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useEffect, use } from "react";
import PipelineStepper from "@/components/pipeline/PipelineStepper";
import { useToast } from "@/context/ToastContext";

interface ThumbnailConceptOption {
  id: string;
  angle: string;
  stylePresetId: string;
  textOverlay: {
    subText: string;
    mainText: string;
    stylePreset: string;
    position: string;
  };
  visuals: {
    subject: string;
    background: string;
    accent: string;
  };
  compiledPrompt: string;
  imageUrl?: string | null;
}

interface ThumbnailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ThumbnailPage({ params }: ThumbnailPageProps) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const { showToast } = useToast();

  const [projectTitle, setProjectTitle] = useState<string>("");
  const [projectStatus, setProjectStatus] = useState<string>("PROMPTS");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<string | null>(null);

  // Extension connection state
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [lastPongTime, setLastPongTime] = useState<number>(0);

  // Data fields
  const [thumbnailConcepts, setThumbnailConcepts] = useState<ThumbnailConceptOption[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [videoStyle, setVideoStyle] = useState<string>("doodle");
  const [nicheName, setNicheName] = useState<string>("General");

  // Edit overlay/concept prompt state
  const [activeTab, setActiveTab] = useState<"player" | "feed">("player");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [promptEditValue, setPromptEditValue] = useState<string>("");

  // Overlay text fields
  const [subTextVal, setSubTextVal] = useState<string>("");
  const [mainTextVal, setMainTextVal] = useState<string>("");
  const [bgStyleVal, setBgStyleVal] = useState<string>("");
  const [subjectVal, setSubjectVal] = useState<string>("");
  const [isSavingText, setIsSavingText] = useState<boolean>(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(false);

  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>("");

  // Track concepts queued in the extension background service worker
  const [queuedConceptIds, setQueuedConceptIds] = useState<string[]>([]);

  const activeConcept = thumbnailConcepts.find(c => c.id === selectedConceptId) || null;

  // 1. Fetch project details and metadata on mount
  const loadProjectData = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setProjectTitle(data.project.title);
          setProjectStatus(data.project.status);
          setNicheName(data.project.niche || "General");

          let briefObj: any = {};
          if (data.project.brief) {
            try {
              briefObj = JSON.parse(data.project.brief);
              setVideoStyle(briefObj.videoStyle || "doodle");

              if (briefObj.thumbnailConcepts && briefObj.thumbnailConcepts.length > 0) {
                setThumbnailConcepts(briefObj.thumbnailConcepts);
                const activeId = briefObj.selectedConceptId || briefObj.thumbnailConcepts[0].id;
                setSelectedConceptId(activeId);

                const activeC = briefObj.thumbnailConcepts.find((c: any) => c.id === activeId);
                if (activeC) {
                  setPromptEditValue(activeC.compiledPrompt || "");
                  setSubTextVal(activeC.textOverlay?.subText || "");
                  setMainTextVal(activeC.textOverlay?.mainText || "");
                  setBgStyleVal(activeC.visuals?.background || "");
                  setSubjectVal(activeC.visuals?.subject || "");
                }
              }
            } catch (e) { }
          }

          if (data.project.metadata) {
            setVideoTitle(data.project.metadata.title);
          } else {
            setVideoTitle(data.project.title);
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
    loadProjectData();
    setUserAvatar("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80");
  }, [projectId]);

  // 2. Watchdog: Ping extension every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      window.postMessage({ type: "EAZI_TRANSCPING_PING" }, "*"); // generic ping
      window.postMessage({ type: "EAZI_TRANSCRIBE_PING" }, "*");
    }, 2000);

    const checkTimeout = setInterval(() => {
      if (Date.now() - lastPongTime > 4500) {
        setIsExtensionConnected(false);
      }
    }, 2500);

    return () => {
      clearInterval(interval);
      clearInterval(checkTimeout);
    };
  }, [lastPongTime]);

  // 3. Listener for extension messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { type, id, requestId, image, error } = event.data;

      if (type === "EAZI_TRANSCRIBE_PONG") {
        setIsExtensionConnected(true);
        setLastPongTime(Date.now());
      }

      // Handle queued results from background loop
      if (type === "EAZI_TRANSCRIBE_GENERATION_RESULT") {
        const conceptId = id || requestId;
        if (!conceptId) return;

        setQueuedConceptIds(prev => prev.filter(cId => cId !== conceptId));

        if (conceptId === selectedConceptId) {
          setIsRendering(false);
          if (error) {
            console.error("Extension queued generation error:", error);
            setErrorMsg(error);
          } else if (image) {
            setErrorMsg(null);
            await handleUploadResult(image);
          }
        } else {
          // Upload background finished item even if not active concept
          if (image && !error) {
            await handleUploadResultForId(conceptId, image);
          }
        }
      }

      // Legacy direct response handler
      if (type === "EAZI_TRANSCRIBE_RESPONSE" && (id === selectedConceptId || requestId === selectedConceptId || id === "thumbnail" || requestId === "thumbnail")) {
        const conceptId = id || requestId;
        setIsRendering(false);
        setQueuedConceptIds(prev => prev.filter(cId => cId !== conceptId));
        if (error) {
          console.error("Extension thumbnail generation error:", error);
          setErrorMsg(error);
        } else if (image) {
          setErrorMsg(null);
          await handleUploadResult(image);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedConceptId, thumbnailConcepts]);

  // Upload background render result for a specific concept
  const handleUploadResultForId = async (conceptId: string, base64Image: string) => {
    try {
      const res = await fetch("/api/projects/thumbnail/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          base64Image,
          conceptId
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const enrichedConcepts = (data.thumbnailConcepts || []).map((c: any) => {
          if (c.imageUrl && c.id === conceptId) {
            return { ...c, imageUrl: `${c.imageUrl}?t=${Date.now()}` };
          }
          return c;
        });
        setThumbnailConcepts(enrichedConcepts);
      }
    } catch (e) {
      console.error("Failed to upload background render:", e);
    }
  };

  // Upload generated thumbnail base64
  const handleUploadResult = async (base64Image: string) => {
    try {
      const res = await fetch("/api/projects/thumbnail/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          base64Image,
          conceptId: selectedConceptId
        }),
      });
      if (res.ok) {
        const data = await res.json();

        // Map unique timestamp to urls to bust cache
        const enrichedConcepts = (data.thumbnailConcepts || []).map((c: any) => {
          if (c.imageUrl && c.id === selectedConceptId) {
            return { ...c, imageUrl: `${c.imageUrl}?t=${Date.now()}` };
          }
          return c;
        });

        setThumbnailConcepts(enrichedConcepts);
        setProjectStatus("THUMBNAIL");
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to upload image");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to upload generated thumbnail");
    }
  };

  // Swap active concept tab
  const handleSelectConcept = async (conceptId: string) => {
    setIsSelecting(conceptId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/projects/thumbnail/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, conceptId }),
      });
      if (res.ok) {
        setSelectedConceptId(conceptId);
        const targetC = thumbnailConcepts.find(c => c.id === conceptId);
        if (targetC) {
          setPromptEditValue(targetC.compiledPrompt || "");
          setSubTextVal(targetC.textOverlay?.subText || "");
          setMainTextVal(targetC.textOverlay?.mainText || "");
          setBgStyleVal(targetC.visuals?.background || "");
          setSubjectVal(targetC.visuals?.subject || "");
          setIsEditingPrompt(false);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to swap concepts");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to select active concept");
    } finally {
      setIsSelecting(null);
    }
  };

  // Generate Thumbnail Prompt Options using AI
  const handleGenerateConcepts = async () => {
    setIsGeneratingPrompt(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/projects/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, regenerate: true }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.metadata?.thumbnailConcepts) {
          setThumbnailConcepts(data.metadata.thumbnailConcepts);
          const activeId = data.metadata.selectedConceptId || data.metadata.thumbnailConcepts[0].id;
          setSelectedConceptId(activeId);

          const activeC = data.metadata.thumbnailConcepts.find((c: any) => c.id === activeId);
          if (activeC) {
            setPromptEditValue(activeC.compiledPrompt || "");
            setSubTextVal(activeC.textOverlay?.subText || "");
            setMainTextVal(activeC.textOverlay?.mainText || "");
            setBgStyleVal(activeC.visuals?.background || "");
            setSubjectVal(activeC.visuals?.subject || "");
          }
          setVideoTitle(data.metadata.title);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to generate prompt options");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate concepts");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Helper to re-compile the visual prompt dynamically
  const getCompiledPromptText = (
    concept: ThumbnailConceptOption,
    style: string,
    sub: string,
    main: string,
    bg: string,
    subject: string
  ) => {
    const stylePrefix = style ? `${style} style video frame, ` : "";
    const subjectText = subject || "highly detailed scene";
    const backgroundText = bg 
      ? `, set against a background of ${bg}` 
      : concept.visuals?.background 
      ? `, set against a background of ${concept.visuals.background}` 
      : "";
      
    let textText = "";
    if (sub || main) {
      const combinedText = [sub, main].filter(Boolean).join(" ");
      const positionText = concept.textOverlay?.position === "right_side"
        ? "on the right side"
        : concept.textOverlay?.position === "top_center"
        ? "at the top center"
        : "on the left side";
        
      const highlightDesc = concept.textOverlay?.stylePreset === "RED_BACKGROUND_BOX"
        ? "heavy impact font with a bold red box background"
        : concept.textOverlay?.stylePreset === "YELLOW_TEXT"
        ? "heavy yellow impact font"
        : concept.textOverlay?.stylePreset === "OUTLINE_SLANTED"
        ? "slanted bold white font with thick black outline"
        : "bold white impact font";
        
      textText = `, featuring a large bold ALL-CAPS text overlay ${positionText} that reads "${combinedText.toUpperCase()}" in ${highlightDesc}`;
    }
    
    const accentText = concept.visuals?.accent && concept.visuals.accent !== "NONE"
      ? `, with a prominent ${concept.visuals.accent.replace(/_/g, " ").toLowerCase()}`
      : "";
      
    return `${stylePrefix}${subjectText}${backgroundText}${textText}${accentText}, cinematic lighting, 8k resolution, photorealistic, highly detailed.`;
  };

  const handleSubTextChange = (val: string) => {
    setSubTextVal(val);
    if (activeConcept) {
      const compiled = getCompiledPromptText(activeConcept, videoStyle, val, mainTextVal, bgStyleVal, subjectVal);
      setPromptEditValue(compiled);
    }
  };

  const handleMainTextChange = (val: string) => {
    setMainTextVal(val);
    if (activeConcept) {
      const compiled = getCompiledPromptText(activeConcept, videoStyle, subTextVal, val, bgStyleVal, subjectVal);
      setPromptEditValue(compiled);
    }
  };

  const handleBgStyleChange = (val: string) => {
    setBgStyleVal(val);
    if (activeConcept) {
      const compiled = getCompiledPromptText(activeConcept, videoStyle, subTextVal, mainTextVal, val, subjectVal);
      setPromptEditValue(compiled);
    }
  };

  const handleSubjectChange = (val: string) => {
    setSubjectVal(val);
    if (activeConcept) {
      const compiled = getCompiledPromptText(activeConcept, videoStyle, subTextVal, mainTextVal, bgStyleVal, val);
      setPromptEditValue(compiled);
    }
  };

  // Save manual text and prompt updates
  const handleSaveConceptEdits = async () => {
    if (!selectedConceptId || !activeConcept) return;
    setIsSavingText(true);
    try {
      // 1. Build updated concept objects array
      const updatedConcepts = thumbnailConcepts.map((c) => {
        if (c.id === selectedConceptId) {
          return {
            ...c,
            compiledPrompt: promptEditValue.trim(),
            textOverlay: {
              ...c.textOverlay,
              subText: subTextVal.trim(),
              mainText: mainTextVal.trim(),
            },
            visuals: {
              ...c.visuals,
              background: bgStyleVal.trim(),
              subject: subjectVal.trim()
            }
          };
        }
        return c;
      });

      // 2. Push update to database
      const res = await fetch("/api/projects/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: videoTitle,
          thumbnailPrompt: promptEditValue.trim(),
          thumbnailConcepts: updatedConcepts,
          selectedConceptId
        })
      });

      if (res.ok) {
        setThumbnailConcepts(updatedConcepts);
        setIsEditingPrompt(false);
      }
    } catch (e) {
      console.error("Failed to save edits", e);
    } finally {
      setIsSavingText(false);
    }
  };

  // Add concept prompt to Chrome Extension Queue
  const handleQueueThumbnail = () => {
    if (!selectedConceptId || !activeConcept || !promptEditValue.trim()) return;
    setErrorMsg(null);

    // Add to local queued state
    if (!queuedConceptIds.includes(selectedConceptId)) {
      setQueuedConceptIds(prev => [...prev, selectedConceptId]);
    }

    // Send add-prompt request to the Chrome Extension Queue
    window.postMessage({
      type: "EAZI_TRANSCRIBE_ADD_PROMPT",
      prompt: {
        id: selectedConceptId,
        prompt: promptEditValue.trim()
      }
    }, "*");
  };

  // Reset all candidates
  const handleResetThumbnail = async () => {
    setIsResetting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/projects/thumbnail/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Clear locally
        const cleared = (thumbnailConcepts || []).map(c => ({ ...c, imageUrl: null }));
        setThumbnailConcepts(cleared);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  // Copy prompt text helper
  const handleCopyText = async () => {
    if (!activeConcept) return;
    await navigator.clipboard.writeText(activeConcept.compiledPrompt);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Download thumbnail helper
  const handleDownloadThumbnail = async () => {
    if (!activeConcept || !activeConcept.imageUrl) return;
    try {
      const response = await fetch(activeConcept.imageUrl);
      const blob = await response.blob();
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      const cleanTitle = projectTitle ? projectTitle.trim().replace(/[\/\\:*?"<>|]/g, "_") : projectId;
      element.download = `${cleanTitle}-thumbnail.png`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error("Failed to download thumbnail image:", err);
      showToast("Failed to download image. Please try again.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E00C1D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-36 px-4 md:px-0">

      {/* Pipeline stepper tracker */}
      <PipelineStepper projectId={projectId} projectStatus={projectStatus} />

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#E00C1D]/15 text-[#E00C1D] text-[9px] font-mono font-bold tracking-widest uppercase border border-[#E00C1D]/25">
              Workspace Phase 5
            </span>
            <span className="text-[10px] text-gray-500 font-mono">/ Project: {projectTitle}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
            Thumbnail Creator
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            Design high-retention, viral thumbnail variations containing bold text overlays and custom niche preset illustrations.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/storyboard-images/${projectId}`}
            className="px-4 py-2.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer shadow-inner"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Storyboard
          </Link>

          <Link
            href={`/dashboard/publish/${projectId}`}
            className="px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-[#E00C1D] via-[#f02030] to-[#b0060f] hover:brightness-110 text-white rounded-xl transition-all shadow-lg shadow-red-950/45 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            Next: Publish <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Connection Indicator Bar */}
      <div className={`p-4 rounded-2xl border transition-all duration-500 shadow-lg ${isExtensionConnected
        ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-950/5"
        : "bg-amber-500/5 border-amber-500/20 shadow-amber-950/5"
        }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border shrink-0 transition-colors ${isExtensionConnected
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/25 text-amber-500"
              }`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs">EaziStudio Extension Bridge</h3>
                <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${isExtensionConnected
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 animate-pulse"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isExtensionConnected ? "bg-emerald-400" : "bg-emerald-400"}`} />
                  {isExtensionConnected ? "CONNECTED" : "STANDBY"}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 max-w-2xl leading-relaxed">
                {isExtensionConnected
                  ? "Connected! EaziStudio extension is listening. Select a concept option and click 'Queue Concept' below to render."
                  : "Chrome Extension not detected. Make sure the EaziStudio Automator extension is installed in developer mode and active."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error alert banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error: {errorMsg}</span>
        </div>
      )}

      {/* EMPTY STATE: Generate Concepts */}
      {thumbnailConcepts.length === 0 && !isGeneratingPrompt ? (
        <div className="w-full py-20 bg-white/[0.01] border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6">
          <div className="p-5 rounded-2xl bg-[#E00C1D]/10 border border-[#E00C1D]/20 text-[#E00C1D] mb-4">
            <Sparkles className="w-10 h-10 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Thumbnail Concept Generator</h2>
          <p className="text-xs text-gray-400 max-w-md leading-relaxed mb-6">
            Eazi Studio will analyze your script context to design 3 highly structured visual layout concepts featuring bold, click-worthy hook word overlays and style guidelines.
          </p>
          <button
            onClick={handleGenerateConcepts}
            className="px-6 py-3 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-950/20 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Generate Concept Options
          </button>
        </div>
      ) : isGeneratingPrompt && thumbnailConcepts.length === 0 ? (
        <div className="w-full py-24 bg-[#121218]/40 border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="w-10 h-10 text-[#E00C1D] animate-spin mb-4" />
          <h2 className="text-sm font-bold text-white mb-1">Structuring Visual Layouts...</h2>
          <p className="text-[11px] text-gray-500 animate-pulse">Running semantic layout planning based on Niche Preset guidelines</p>
        </div>
      ) : (
        <>
          {/* CORE WORKSPACE EDIT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Concept Deck & Form Controls */}
            <div className="lg:col-span-5 flex flex-col gap-6 mb-25">

              {/* Concept Options Selector Deck */}
              <div className="glass-card bg-[#121218]/70 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent pointer-events-none rounded-bl-3xl" />

                {/* Option Tabs Header */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Concept Variations</span>
                  <div className="grid grid-cols-3 bg-black/40 border border-white/10 p-1 rounded-xl">
                    {thumbnailConcepts.map((concept, index) => {
                      const isActive = selectedConceptId === concept.id;
                      const selecting = isSelecting === concept.id;

                      return (
                        <button
                          key={concept.id}
                          onClick={() => !isActive && !selecting && handleSelectConcept(concept.id)}
                          disabled={selecting}
                          className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${isActive
                            ? "bg-[#E00C1D] text-white shadow shadow-red-950/40"
                            : "text-gray-400 hover:text-white"
                            }`}
                        >
                          {selecting && <Loader2 className="w-3 h-3 animate-spin" />}
                          Option {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Option Specifications Form */}
                {activeConcept && (
                  <div className="flex flex-col gap-5 pt-1">

                    {/* Angle & Strategy Header */}
                    <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
                      <span className="text-[9px] text-[#E00C1D] font-mono font-bold uppercase tracking-widest">
                        Psychological Hook Angle
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {activeConcept.angle}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        Layout: {activeConcept.stylePresetId.replace(/_/g, " ").toUpperCase()}
                      </p>
                    </div>

                    {/* 1. TEXT OVERLAY INPUTS */}
                    <div className="flex flex-col gap-3.5 bg-black/30 border border-white/5 rounded-2xl p-4">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-blue-400" />
                        Text Overlay Config
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500">Subtitle Phrase</label>
                          <input
                            type="text"
                            value={subTextVal}
                            onChange={(e) => handleSubTextChange(e.target.value)}
                            className="w-full bg-black/45 border border-white/10 focus:border-[#E00C1D]/50 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none"
                            placeholder="e.g. THIS IS"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500">Main Hook Word</label>
                          <input
                            type="text"
                            value={mainTextVal}
                            onChange={(e) => handleMainTextChange(e.target.value)}
                            className="w-full bg-black/45 border border-white/10 focus:border-[#E00C1D]/50 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none font-bold"
                            placeholder="e.g. A LIE"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9.5px] text-gray-500 mt-1 pt-2.5 border-t border-white/5">
                        <span>Position: {activeConcept.textOverlay.position.replace(/_/g, " ")}</span>
                        <span>Highlight: {activeConcept.textOverlay.stylePreset.replace(/_/g, " ")}</span>
                      </div>
                    </div>

                    {/* 2. CHARACTER EXPRESSION CONFIG */}
                    <div className="flex flex-col gap-3.5 bg-black/30 border border-white/5 rounded-2xl p-4">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-purple-400" />
                        Character Expression Config
                      </span>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500">Character Description & Emotion</label>
                        <input
                          type="text"
                          value={subjectVal}
                          onChange={(e) => handleSubjectChange(e.target.value)}
                          className="w-full bg-black/45 border border-white/10 focus:border-[#E00C1D]/50 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none"
                          placeholder="e.g. A man looking shocked, eyes wide, mouth open"
                        />
                      </div>
                    </div>

                    {/* 3. BACKGROUND STYLE CONFIG */}
                    <div className="flex flex-col gap-3.5 bg-black/30 border border-white/5 rounded-2xl p-4">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        Background Style Config
                      </span>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500">Background Scene Description</label>
                        <input
                          type="text"
                          value={bgStyleVal}
                          onChange={(e) => handleBgStyleChange(e.target.value)}
                          className="w-full bg-black/45 border border-white/10 focus:border-[#E00C1D]/50 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none"
                          placeholder="e.g. Dark high-tech gaming room, neon red led lights"
                        />
                      </div>
                    </div>

                    {/* 3. VISUAL PROMPT DESCRIPTIONS */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                          AI Generation Prompt
                        </span>
                        <button
                          onClick={handleCopyText}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy prompt text"
                        >
                          {copySuccess ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      <textarea
                        value={promptEditValue}
                        onChange={(e) => setPromptEditValue(e.target.value)}
                        className="w-full h-28 bg-black/40 border border-white/10 focus:border-[#E00C1D]/50 focus:ring-1 focus:ring-[#E00C1D]/30 rounded-2xl p-3 text-[11px] leading-relaxed text-gray-300 focus:outline-none transition-all font-mono resize-none overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                        placeholder="Enter visual rendering instructions..."
                      />
                    </div>



                  </div>
                )}

              </div>

            </div>

            {/* Right Column: Simulated Preview & Gallery Candidates */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* Preview Selector Headers */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Simulated Previews</span>
                </div>
                <div className="bg-[#121218]/80 border border-white/10 p-1 rounded-xl flex items-center gap-1 shadow-inner">
                  <button
                    onClick={() => setActiveTab("player")}
                    className={`px-4 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTab === "player"
                      ? "bg-[#E00C1D] text-white shadow shadow-red-950/40"
                      : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Video Player
                  </button>
                  <button
                    onClick={() => setActiveTab("feed")}
                    className={`px-4 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTab === "feed"
                      ? "bg-[#E00C1D] text-white shadow shadow-red-950/40"
                      : "text-gray-400 hover:text-white"
                      }`}
                  >
                    YouTube Search Feed
                  </button>
                </div>
              </div>

              {/* TAB 1: Youtube Widescreen Player Mockup (21:9) */}
              {activeTab === "player" && activeConcept && (
                <div className="bg-[#0b0b0f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 group">

                  {/* 21:9 aspect ratios */}
                  <div className="relative aspect-[21/9] w-full bg-black flex items-center justify-center overflow-hidden">
                    {activeConcept.imageUrl ? (
                      <div className="relative w-full h-full">
                        {/* Base Image */}
                        <img
                          src={activeConcept.imageUrl || undefined}
                          alt="YouTube Video Player Preview"
                          className="w-full h-full object-cover select-none animate-fade-in"
                        />
                        
                        {/* Hover Download Overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadThumbnail();
                          }}
                          className="absolute top-4 right-4 z-30 p-2.5 bg-black/60 hover:bg-[#E00C1D] border border-white/15 hover:border-transparent rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg cursor-pointer flex items-center justify-center"
                          title="Download thumbnail image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-500 p-6 text-center select-none">
                        {isRendering ? (
                          <>
                            <Loader2 className="w-12 h-12 text-[#E00C1D] animate-spin" />
                            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest animate-pulse mt-2">
                              Rendering Artwork...
                            </span>
                          </>
                        ) : (
                          <>
                            <Tv className="w-12 h-12 stroke-[1.2] mb-1 text-gray-600" />
                            <span className="text-xs font-bold text-gray-400">Concept #[Option Index] Poster</span>
                            <p className="text-[10px] text-gray-500 max-w-xs leading-relaxed mt-0.5">
                              This concept has not been rendered yet. Click <strong>Queue Concept</strong> below to generate the artwork.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Overlaid Play Button Indicator */}
                    {activeConcept.imageUrl && !isRendering && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/35 transition-all duration-300 cursor-pointer">
                        <div className="w-16 h-16 rounded-full bg-[#E00C1D]/90 backdrop-blur-sm shadow-xl flex items-center justify-center text-white transform transition-transform group-hover:scale-110 active:scale-95 duration-300">
                          <Play className="w-6 h-6 fill-current translate-x-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Youtube controls */}
                    {activeConcept.imageUrl && (
                      <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-black/90 to-transparent p-3.5 flex flex-col justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden relative cursor-pointer group/seek">
                          <div className="h-full w-1/4 bg-[#E00C1D] rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-white/90 text-xs">
                          <div className="flex items-center gap-3">
                            <Play className="w-4 h-4 fill-current cursor-pointer hover:text-white text-gray-300 transition-colors" />
                            <RotateCcw className="w-4 h-4 cursor-pointer hover:text-white text-gray-300 transition-colors" />
                            <Volume2 className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white transition-colors" />
                            <span className="text-[10px] font-mono text-gray-300 select-none">0:00 / 7:15</span>
                          </div>
                          <div className="flex items-center gap-3.5">
                            <span className="text-[8px] font-mono font-bold px-1 rounded border border-white/40 text-gray-300">HD</span>
                            <Settings className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white" />
                            <Maximize className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info titles */}
                  <div className="p-6 bg-[#0f0f14]/50 border-t border-white/5">
                    <h2 className="text-sm font-semibold leading-snug line-clamp-2 text-white select-none">
                      {projectTitle}
                    </h2>
                  </div>
                </div>
              )}

              {/* TAB 2: YouTube Search/Home Feed Card Mockup */}
              {activeTab === "feed" && activeConcept && (
                <div className="w-full max-w-[400px] mx-auto bg-[#0b0b0f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col group hover:bg-[#121218]/40">

                  {/* 16:9 Image Frame */}
                  <div className="relative aspect-video w-full bg-[#121214] flex items-center justify-center border-b border-white/5">
                    {activeConcept.imageUrl ? (
                      <div className="relative w-full h-full">
                        <img
                          src={activeConcept.imageUrl || undefined}
                          alt="YouTube Feed Preview"
                          className="w-full h-full object-cover select-none animate-fade-in"
                        />
                        
                        {/* Hover Download Overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadThumbnail();
                          }}
                          className="absolute top-3 right-3 z-30 p-2.5 bg-black/60 hover:bg-[#E00C1D] border border-white/15 hover:border-transparent rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg cursor-pointer flex items-center justify-center"
                          title="Download thumbnail image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600 p-4 text-center select-none">
                        <Loader2 className="w-8 h-8 text-[#E00C1D] animate-spin" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider animate-pulse">Loading Feed Preview...</span>
                      </div>
                    )}

                    {activeConcept.imageUrl && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/85 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded font-mono border border-white/5 shadow">
                        7:15
                      </div>
                    )}
                  </div>

                  {/* Card Meta details */}
                  <div className="p-5">
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 select-none group-hover:text-[#ff4e5e] transition-colors">
                      {projectTitle}
                    </h3>
                  </div>
                </div>
              )}

              {/* CONCEPT VARIATIONS GALLERY FILMSTRIP */}
              {thumbnailConcepts.length > 0 && (
                <div className="glass-card bg-[#121218]/70 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <GalleryThumbnails className="w-4 h-4 text-[#E00C1D]" />
                      Option Deck Gallery ({thumbnailConcepts.length})
                    </h3>
                    <span className="text-[9px] text-gray-400 italic">Select tab to view overlay details</span>
                  </div>

                  {/* Horizontal list */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {thumbnailConcepts.map((concept, idx) => {
                      const isActive = selectedConceptId === concept.id;
                      const selecting = isSelecting === concept.id;
                      const hasImage = !!concept.imageUrl;

                      return (
                        <div
                          key={concept.id}
                          onClick={() => !isActive && !selecting && handleSelectConcept(concept.id)}
                          className={`relative aspect-video rounded-xl overflow-hidden border cursor-pointer group/card flex items-center justify-center bg-black/60 transition-all duration-300 ${isActive
                            ? "border-[#E00C1D] ring-2 ring-[#E00C1D]/30 scale-95 shadow-md shadow-red-950/20"
                            : "border-white/10 hover:border-white/20 hover:scale-105"
                            }`}
                        >
                          {hasImage ? (
                            <img
                              src={concept.imageUrl || undefined}
                              alt={`Option ${idx + 1}`}
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-gray-600 text-center p-2">
                              <Tv className="w-5 h-5 text-gray-700 group-hover/card:text-gray-500 transition-colors" />
                              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                                Not Rendered
                              </span>
                            </div>
                          )}

                          {/* Active Selection highlights */}
                          {isActive && (
                            <div className="absolute inset-0 bg-[#E00C1D]/10 flex items-center justify-center">
                              <span className="p-1 rounded-full bg-[#E00C1D] text-white shadow shadow-red-900 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 font-bold" />
                              </span>
                            </div>
                          )}

                          {/* Loading spinner */}
                          {selecting && (
                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-[#E00C1D] animate-spin" />
                            </div>
                          )}

                          {/* Badge category tag overlay */}
                          <div className="absolute top-1.5 left-1.5 bg-black/85 text-[8.5px] font-bold text-white px-2 py-0.5 rounded border border-white/5 shadow font-mono">
                            Option {idx + 1}
                          </div>

                          {/* Title text overlay preview on card bottom */}
                          {concept.textOverlay.mainText && (
                            <div className="absolute bottom-1 px-1.5 py-0.5 bg-black/80 rounded border border-white/5 text-[8px] font-bold font-mono tracking-tight max-w-[90%] truncate select-none text-gray-300">
                              {concept.textOverlay.subText} {concept.textOverlay.mainText}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* FLOATING ACTION DOCK - Simple Advanced Centered UI */}
          {isControlsCollapsed ? (
            <button
              onClick={() => setIsControlsCollapsed(false)}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f0f15]/95 backdrop-blur-xl border border-white/10 hover:border-[#E00C1D]/50 px-5 py-3 rounded-full flex items-center gap-2 text-xs font-bold text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-fade-in"
            >
              <ChevronUp className="w-4 h-4 text-[#E00C1D] animate-bounce" />
              Show Workstation Controls
            </button>
          ) : (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f0f15]/95 backdrop-blur-2xl border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-4 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.9)] w-[calc(100%-2rem)] md:w-max max-w-4xl flex-wrap md:flex-nowrap justify-center animate-fade-in">

              {/* Save Prompt */}
              <button
                onClick={handleSaveConceptEdits}
                disabled={!(
                  subTextVal !== (activeConcept?.textOverlay?.subText || "") ||
                  mainTextVal !== (activeConcept?.textOverlay?.mainText || "") ||
                  bgStyleVal !== (activeConcept?.visuals?.background || "") ||
                  subjectVal !== (activeConcept?.visuals?.subject || "") ||
                  promptEditValue.trim() !== activeConcept?.compiledPrompt
                ) || isSavingText}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${(
                  subTextVal !== (activeConcept?.textOverlay?.subText || "") ||
                  mainTextVal !== (activeConcept?.textOverlay?.mainText || "") ||
                  bgStyleVal !== (activeConcept?.visuals?.background || "") ||
                  subjectVal !== (activeConcept?.visuals?.subject || "") ||
                  promptEditValue.trim() !== activeConcept?.compiledPrompt
                )
                  ? "bg-[#E00C1D]/15 hover:bg-[#E00C1D]/25 border-[#E00C1D]/40 text-[#ff4e5e] shadow-lg shadow-red-950/20 active:scale-95"
                  : "bg-white/5 border-white/5 text-gray-500 cursor-not-allowed shadow-none"
                  }`}
              >
                {isSavingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Parameters
              </button>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-white/10 hidden md:block" />

              {/* Trigger Flow Render (Queue Concept) */}
              <button
                onClick={handleQueueThumbnail}
                disabled={!isExtensionConnected || queuedConceptIds.includes(selectedConceptId || "") || isRendering}
                className={`py-2.5 px-6 text-xs font-extrabold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer ${!isExtensionConnected
                  ? "bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed shadow-none"
                  : queuedConceptIds.includes(selectedConceptId || "")
                    ? "bg-blue-600/25 border border-blue-500/35 text-blue-400 cursor-not-allowed shadow-none"
                    : isRendering
                      ? "bg-amber-600/25 border border-amber-500/35 text-amber-400 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-[#E00C1D] via-[#f02030] to-[#b0060f] hover:brightness-110 text-white shadow-red-950/40 transform active:scale-98"
                  }`}
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : queuedConceptIds.includes(selectedConceptId || "") ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    Queued
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Queue Concept
                  </>
                )}
              </button>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-white/10 hidden md:block" />

              {/* Regenerate AI Package */}
              <button
                onClick={handleGenerateConcepts}
                disabled={isGeneratingPrompt}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isGeneratingPrompt ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                )}
                Regenerate
              </button>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-white/10 hidden md:block" />

              {/* Reset Images */}
              <button
                onClick={handleResetThumbnail}
                disabled={isResetting || !thumbnailConcepts.some(c => c.imageUrl)}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${thumbnailConcepts.some(c => c.imageUrl)
                  ? "bg-red-500/10 hover:bg-red-500/25 border-red-500/20 text-red-400 hover:text-red-300 active:scale-95"
                  : "bg-white/5 border-white/5 text-gray-500 cursor-not-allowed shadow-none"
                  }`}
                title="Reset all generated images"
              >
                {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-white/10 hidden md:block" />

              {/* Download Thumbnail */}
              <button
                onClick={handleDownloadThumbnail}
                disabled={!activeConcept || !activeConcept.imageUrl}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${activeConcept && activeConcept.imageUrl
                  ? "bg-green-500/10 hover:bg-green-500/25 border-green-500/20 text-green-400 hover:text-green-300 active:scale-95 shadow-md shadow-green-950/10"
                  : "bg-white/5 border-white/5 text-gray-500 cursor-not-allowed shadow-none"
                  }`}
                title="Download thumbnail image"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-white/10 hidden md:block" />

              {/* Collapse Controls button */}
              <button
                onClick={() => setIsControlsCollapsed(true)}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Collapse Controls"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

            </div>
          )}
        </>
      )}
    </div>
  );
}
