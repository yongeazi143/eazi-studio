"use client";

import Link from "next/link";
import { 
  Download, Sparkles, Copy, Check, Save, FileText, 
  ArrowLeft, ArrowRight, Loader2, Tag, Image, Compass,
  ChevronDown, Music, Archive, CheckCircle, X
} from "lucide-react";
import { useState, useEffect, use, useRef } from "react";
import PipelineStepper from "@/components/pipeline/PipelineStepper";
import { useToast } from "@/context/ToastContext";

interface PublishPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function PublishPage({ params }: PublishPageProps) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const { showToast } = useToast();

  const [projectTitle, setProjectTitle] = useState<string>("");
  const [projectStatus, setProjectStatus] = useState<string>("METADATA");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  
  // Metadata fields
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState<string>("");
  const [hasMetadata, setHasMetadata] = useState<boolean>(false);
  
  // UI states
  const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Fetch project details and metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/projects/metadata?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.metadata) {
            setTitle(data.metadata.title);
            setDescription(data.metadata.description);
            setTagsText(data.metadata.tags?.join(", ") || "");
            setThumbnailPrompt(data.metadata.thumbnailPrompt || "");
            setHasMetadata(true);
          }
        }
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    };

    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects?id=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            setProjectTitle(data.project.title);

            // Default title to project title if metadata not loaded yet
            if (!title) {
              setTitle(data.project.title);
            }

            const currentStatus = data.project.status;
            // metadata is included in the GET response (metadata: true in Prisma query)
            const metaExists = !!(
              data.project.metadata?.title &&
              data.project.metadata?.description
            );

            // ── Auto-upgrade to DONE ────────────────────────────────────────
            // If metadata is already saved and project isn't marked DONE yet,
            // promote it immediately (both local state + DB in background).
            if (metaExists && currentStatus !== "DONE") {
              setProjectStatus("DONE");
              // Fire-and-forget: update DB status without blocking the UI
              fetch("/api/projects/metadata", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId,
                  title: data.project.metadata.title,
                  description: data.project.metadata.description,
                  tags: data.project.metadata.tags || [],
                }),
              }).catch((e) => console.error("Auto DONE status update failed:", e));
            } else {
              setProjectStatus(currentStatus);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load project details", err);
      } finally {
        setIsLoading(false);
      }
    };

    const loadAll = async () => {
      await fetchMetadata();
      await fetchProject();
    };

    loadAll();
  }, [projectId]);

  // Trigger AI generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/projects/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, regenerate: true }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.metadata) {
          setTitle(data.metadata.title);
          setDescription(data.metadata.description);
          setTagsText(data.metadata.tags?.join(", ") || "");
          setThumbnailPrompt(data.metadata.thumbnailPrompt || "");
          setHasMetadata(true);
          setProjectStatus("METADATA");
        }
      }
    } catch (err) {
      console.error("Failed to generate metadata", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save edits to database
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const parsedTags = tagsText
        .split(",")
        .map(t => t.trim())
        .filter(t => !!t);

      const res = await fetch("/api/projects/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          description,
          tags: parsedTags,
          thumbnailPrompt
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setHasMetadata(true);
        setProjectStatus("DONE");
        setShowCelebration(true);
        showToast("Metadata saved successfully!", "success");
        setTimeout(() => setSaveSuccess(false), 3000);
        setTimeout(() => setShowCelebration(false), 6000);
      }
    } catch (err) {
      console.error("Failed to save metadata updates", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle zipping/downloading full package (.txt)
  // Download SEO & Description Helper
  const handleDownloadSEO = () => {
    const text = `================================================================================
EAZI STUDIO — VIDEO SEO METADATA
================================================================================
Project Title: ${projectTitle}
Generated At:  ${new Date().toLocaleString()}

[Title]
${title}

[Description]
${description}

[Tags / Keywords]
${tagsText}
`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(blob);
    element.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-seo-metadata.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Download Voiceover Script Helper (Raw Creative Script)
  const handleDownloadScript = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      const scriptContent = data.project?.script?.content || "";
      if (!scriptContent) {
        showToast("No script content found.", "error");
        return;
      }
      const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-script.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Script download failed", e);
    }
  };

  // Download Voiceover Transcript Helper (Timestamped Audio Transcript)
  const handleDownloadTranscript = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      const project = data.project;
      const transcriptLines = project?.audio?.transcript || [];
      if (!Array.isArray(transcriptLines) || transcriptLines.length === 0) {
        showToast("No audio transcript found. Please upload and transcribe audio first.", "warning");
        return;
      }

      const formatSecs = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
      };

      let transcriptText = "";
      transcriptLines.forEach((line: any) => {
        const start = formatSecs(line.startTime ?? 0);
        transcriptText += `[${start}]: ${line.text}\n`;
      });

      const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-transcript.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Transcript download failed", e);
    }
  };

  // Download Voiceover Audio Helper
  const handleDownloadVoiceover = async () => {
    try {
      const { getAudioFile } = await import("@/utils/audioDb");
      const audioBlob = await getAudioFile(projectId);
      if (!audioBlob) {
        showToast("No uploaded voiceover audio file found.", "warning");
        return;
      }
      const element = document.createElement("a");
      element.href = URL.createObjectURL(audioBlob);
      const ext = audioBlob.type.includes("wav") ? "wav" : "mp3";
      element.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-voiceover.${ext}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Voiceover audio download failed", e);
      showToast("Failed to download voiceover audio.", "error");
    }
  };

  // Download Storyboard Images Helper
  const handleDownloadStoryboardZip = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      const allScenes = data.project?.scenes || [];

      // Sort by startTime so files are in chronological order
      const scenes = [...allScenes].sort(
        (a: any, b: any) => (a.startTime ?? 0) - (b.startTime ?? 0)
      );
      const generatedScenes = scenes.filter((s: any) => s.imageUrl);
      if (generatedScenes.length === 0) {
        showToast("No generated storyboard images to download yet.", "warning");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const formattedTitle = projectTitle ? projectTitle.trim().replace(/[\/\\:*?"<>|]/g, "_") : projectId;
      const folderName = `${formattedTitle}-storyboard`;
      const folder = zip.folder(folderName);

      // Format seconds as M-SS (colon replaced by dash — Windows-safe)
      const formatSecs = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}-${String(s).padStart(2, "0")}`;
      };

      await Promise.all(
        generatedScenes.map(async (scene: any, idx: number) => {
          try {
            const imgRes = await fetch(scene.imageUrl);
            const blob = await imgRes.blob();
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
    } catch (e) {
      console.error("Storyboard zip download failed", e);
      showToast("Failed to download storyboard zip.", "error");
    }
  };

  // Download Thumbnail Helper
  const handleDownloadThumbnail = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      const project = data.project;

      let thumbnailUrl = project?.metadata?.thumbnailUrl;
      if (!thumbnailUrl && project?.brief) {
        try {
          const briefObj = JSON.parse(project.brief);
          const concepts = briefObj.thumbnailConcepts || [];
          const activeId = briefObj.selectedConceptId || (concepts[0]?.id);
          const activeConcept = concepts.find((c: any) => c.id === activeId);
          thumbnailUrl = activeConcept?.imageUrl;
        } catch (e) {}
      }

      if (!thumbnailUrl) {
        showToast("No thumbnail artwork rendered yet.", "warning");
        return;
      }

      const imgRes = await fetch(thumbnailUrl);
      const blob = await imgRes.blob();
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      const cleanTitle = projectTitle ? projectTitle.trim().replace(/[\/\\:*?"<>|]/g, "_") : projectId;
      element.download = `${cleanTitle}-thumbnail.png`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Thumbnail download failed", e);
      showToast("Failed to download thumbnail.", "error");
    }
  };

  // Download Complete Package Helper
  const handleDownloadCompletePackage = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (!res.ok) {
        setIsSaving(false);
        return;
      }
      const data = await res.json();
      const project = data.project;
      if (!project) {
        setIsSaving(false);
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const cleanTitle = projectTitle ? projectTitle.trim().replace(/[\/\\:*?"<>|]/g, "_") : projectId;
      const rootFolder = zip.folder(`${cleanTitle}-export-package`);

      // 1. SEO Metadata
      const seoText = `================================================================================
EAZI STUDIO — VIDEO SEO METADATA
================================================================================
Project Title: ${projectTitle}
Generated At:  ${new Date().toLocaleString()}

[Title]
${title}

[Description]
${description}

[Tags / Keywords]
${tagsText}
`;
      rootFolder?.file("seo-metadata.txt", seoText);

      // 2. Voiceover Script (Raw Text)
      const scriptContent = project.script?.content || "";
      if (scriptContent) {
        rootFolder?.file("script.txt", scriptContent);
      }

      // 3. Voiceover Transcript (Timestamped)
      const transcriptLines = project.audio?.transcript || [];
      if (Array.isArray(transcriptLines) && transcriptLines.length > 0) {
        const formatSecs = (secs: number) => {
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          return `${m}:${String(s).padStart(2, "0")}`;
        };
        let transcriptText = "";
        transcriptLines.forEach((line: any) => {
          const start = formatSecs(line.startTime ?? 0);
          transcriptText += `[${start}]: ${line.text}\n`;
        });
        rootFolder?.file("transcript.txt", transcriptText);
      }

      // 4. Voiceover Audio
      try {
        const { getAudioFile } = await import("@/utils/audioDb");
        const audioBlob = await getAudioFile(projectId);
        if (audioBlob) {
          const ext = audioBlob.type.includes("wav") ? "wav" : "mp3";
          rootFolder?.file(`voiceover.${ext}`, audioBlob);
        }
      } catch (dbErr) {
        console.warn("No audio in DB for complete zip package:", dbErr);
      }

      // 5. Thumbnail Image
      try {
        let thumbnailUrl = project.metadata?.thumbnailUrl;
        if (!thumbnailUrl && project.brief) {
          try {
            const briefObj = JSON.parse(project.brief);
            const concepts = briefObj.thumbnailConcepts || [];
            const activeId = briefObj.selectedConceptId || (concepts[0]?.id);
            const activeConcept = concepts.find((c: any) => c.id === activeId);
            thumbnailUrl = activeConcept?.imageUrl;
          } catch (e) {}
        }
        if (thumbnailUrl) {
          const imgRes = await fetch(thumbnailUrl);
          const blob = await imgRes.blob();
          rootFolder?.file("thumbnail.png", blob);
        }
      } catch (thumbErr) {
        console.warn("No thumbnail for complete zip package:", thumbErr);
      }

      // 6. Storyboard Images Folder
      // Sort all scenes by startTime, then only download the ones with images
      const allScenes = project.scenes || [];
      const sortedScenes = [...allScenes].sort(
        (a: any, b: any) => (a.startTime ?? 0) - (b.startTime ?? 0)
      );
      const generatedScenes = sortedScenes.filter((s: any) => s.imageUrl);

      if (generatedScenes.length > 0) {
        const storyboardFolder = rootFolder?.folder("storyboard-images");
        // Format seconds as M-SS (dash instead of colon — Windows-safe)
        const formatSecs = (secs: number) => {
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          return `${m}-${String(s).padStart(2, "0")}`;
        };

        await Promise.all(
          generatedScenes.map(async (scene: any, idx: number) => {
            try {
              const imgRes = await fetch(scene.imageUrl);
              const blob = await imgRes.blob();
              const timeStr = formatSecs(scene.startTime ?? 0);
              const filename = `${idx + 1}-[${timeStr}].png`;
              storyboardFolder?.file(filename, blob);
            } catch (err) {
              console.error(`Failed to fetch image for scene ${idx + 1}:`, err);
            }
          })
        );
      }

      const content = await zip.generateAsync({ type: "blob" });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(content);
      element.download = `${cleanTitle}-export-package.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Complete package zip export failed", e);
      showToast("Failed to export complete package.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper copy text to clipboard
  const handleCopyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopySuccess(prev => ({ ...prev, [key]: true }));
    showToast("Copied to clipboard!", "success", 2000);
    setTimeout(() => {
      setCopySuccess(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E00C1D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-24 px-4 md:px-0">
      {/* Stepper progress track */}
      <PipelineStepper projectId={projectId} projectStatus={projectStatus} />

      {/* Celebration Canvas */}
      <CelebrationCanvas active={showCelebration} />

      {/* Completion Banner */}
      {projectStatus === "DONE" && !isBannerDismissed && (
        <div className="relative bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_8px_32px_rgba(16,185,129,0.05)] animate-fade-in">
          {/* Dismiss button */}
          <button
            onClick={() => setIsBannerDismissed(true)}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 dark:hover:bg-white/10 transition-all cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
            <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 animate-bounce text-green-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Project Completed! 🎉 (100%)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                Congratulations! All pipeline stages are complete. Your script, voiceover, storyboard images, and optimized thumbnail are generated and ready for publishing.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowCelebration(true);
              setTimeout(() => setShowCelebration(false), 6000);
            }}
            className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-green-950/20 active:scale-95 shrink-0 mr-6"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" /> Celebrate!
          </button>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Workspace / Final Phase</span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Publish & SEO Metadata</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/storyboard-images/${projectId}`}
            className="px-4 py-2.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Storyboard
          </Link>

          {hasMetadata && (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-5 py-2.5 text-xs font-bold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-lg shadow-red-950/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export Assets <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-[#0f0f15]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-fade-in origin-top-right">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadSEO();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-purple-400" />
                      Video SEO & Description (.TXT)
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadScript();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-purple-400" />
                      Voiceover Script (.TXT)
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadTranscript();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      Voiceover Transcript (.TXT)
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadVoiceover();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <Music className="w-4 h-4 text-green-400" />
                      Voiceover Audio File (.MP3)
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadStoryboardZip();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <Image className="w-4 h-4 text-red-400" />
                      Storyboard Images (.ZIP)
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadThumbnail();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <Image className="w-4 h-4 text-amber-400" />
                      Thumbnail Image (.PNG)
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleDownloadCompletePackage();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white hover:bg-[#E00C1D]/10 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <Archive className="w-4 h-4 text-[#E00C1D]" />
                      Complete Package (.ZIP)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EMPTY STATE: Generate button */}
      {!hasMetadata && !isGenerating ? (
        <div className="w-full py-20 bg-white dark:bg-white/[0.01] border border-black/10 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6">
          <div className="p-5 rounded-2xl bg-[#E00C1D]/10 border border-[#E00C1D]/20 text-[#E00C1D] mb-4">
            <Sparkles className="w-10 h-10 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Video SEO Package Generator</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md leading-relaxed mb-6">
            Eazi Studio will analyze your voiceover script and scene structures to generate viral YouTube Title suggestions, full description with timestamps, search keywords, and thumbnail image prompts.
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-950/20 flex items-center gap-2 cursor-pointer scale-100 active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Generate Metadata Package
          </button>
        </div>
      ) : isGenerating ? (
        <div className="w-full py-24 bg-white dark:bg-white/[0.01] border border-black/10 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6">
          <Loader2 className="w-10 h-10 text-[#E00C1D] animate-spin mb-4" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Optimizing SEO Parameters...</h2>
          <p className="text-[11px] text-gray-500 animate-pulse">Running GPT analysis on full script content & storyboard cues</p>
        </div>
      ) : (
        /* CORE WORKSPACE EDIT GRID */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
          
          {/* Left Columns: Text Fields Editor */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Title Section */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-[#0d0d10] dark:to-[#111116] border border-black/10 dark:border-white/5 rounded-2xl p-6 flex flex-col gap-3 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-black/8 dark:border-white/5 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-500" />
                  Video SEO Title
                </h3>
                <button
                  onClick={() => handleCopyText(title, "title")}
                  className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all cursor-pointer"
                  title="Copy Title"
                >
                  {copySuccess.title ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#E00C1D]/50 transition-all font-semibold"
                placeholder="Enter YouTube title..."
              />
            </div>

            {/* Description Section */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-[#0d0d10] dark:to-[#111116] border border-black/10 dark:border-white/5 rounded-2xl p-6 flex flex-col gap-3 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-black/8 dark:border-white/5 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Video Description (with timestamp cues)
                </h3>
                <button
                  onClick={() => handleCopyText(description, "desc")}
                  className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all cursor-pointer"
                  title="Copy Description"
                >
                  {copySuccess.desc ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-80 bg-gray-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed text-gray-800 dark:text-gray-300 focus:outline-none focus:border-[#E00C1D]/50 transition-all font-sans resize-y"
                placeholder="YouTube description text..."
              />
            </div>

            {/* Tags / Keywords Section */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-[#0d0d10] dark:to-[#111116] border border-black/10 dark:border-white/5 rounded-2xl p-6 flex flex-col gap-3 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-black/8 dark:border-white/5 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-500" />
                  SEO Tags / Keywords
                </h3>
                <button
                  onClick={() => handleCopyText(tagsText, "tags")}
                  className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all cursor-pointer"
                  title="Copy Tags"
                >
                  {copySuccess.tags ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#E00C1D]/50 transition-all font-semibold"
                placeholder="tag1, tag2, tag3..."
              />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Separate keywords using commas.</span>
            </div>

          </div>

          {/* Right Column: Actions */}
          <div className="flex flex-col gap-6 sticky top-6">
            
            {/* Actions Panel */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-[#0d0d10] dark:to-[#111116] border border-black/10 dark:border-white/5 rounded-2xl p-6 flex flex-col gap-4 shadow-sm dark:shadow-xl">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Package Controls</h3>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-[#E00C1D] hover:bg-[#b0060f] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-950/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-4 h-4 text-green-300" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? "Saving changes..." : saveSuccess ? "Metadata Saved!" : "Save Changes"}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 border border-black/10 dark:border-white/10 text-gray-700 dark:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-400" />
                )}
                Regenerate AI SEO Package
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

// ─── Celebration Fireworks Canvas Component ─────────────────────────────────
interface CelebrationCanvasProps {
  active: boolean;
}

function CelebrationCanvas({ active }: CelebrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clear the canvas whenever the animation stops
  useEffect(() => {
    if (!active && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle class representing explosion pieces
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      radius: number;
      alpha: number;
      decay: number;
      gravity: number;

      constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 1.5; // slight upward drift
        this.color = color;
        this.radius = Math.random() * 2.5 + 1.5;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.012;
        this.gravity = 0.06;
      }

      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = this.alpha;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.restore();
      }
    }

    // Firework class representing rockets
    class Firework {
      x: number;
      y: number;
      targetY: number;
      vy: number;
      color: string;
      exploded: boolean;
      particles: Particle[];

      constructor() {
        this.x = Math.random() * (width * 0.8) + (width * 0.1);
        this.y = height;
        this.targetY = Math.random() * (height * 0.45) + (height * 0.1);
        this.vy = -Math.random() * 4 - 7;
        const colors = [
          "#E00C1D", // Eazi Studio Red
          "#FFD700", // Gold
          "#10B981", // Emerald Green
          "#3B82F6", // Blue
          "#EC4899", // Pink
          "#F59E0B", // Amber
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.exploded = false;
        this.particles = [];
      }

      update() {
        if (!this.exploded) {
          this.y += this.vy;
          if (this.vy >= 0 || this.y <= this.targetY) {
            this.exploded = true;
            this.explode();
          }
        } else {
          this.particles.forEach(p => p.update());
          this.particles = this.particles.filter(p => p.alpha > 0);
        }
      }

      explode() {
        const count = 35 + Math.floor(Math.random() * 20);
        for (let i = 0; i < count; i++) {
          this.particles.push(new Particle(this.x, this.y, this.color));
        }
      }

      draw(c: CanvasRenderingContext2D) {
        if (!this.exploded) {
          c.beginPath();
          c.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
          c.fillStyle = this.color;
          c.fill();
        } else {
          this.particles.forEach(p => p.draw(c));
        }
      }
    }

    let fireworks: Firework[] = [];

    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      // Randomly spawn fireworks
      if (Math.random() < 0.06 && fireworks.length < 10) {
        fireworks.push(new Firework());
      }

      fireworks.forEach(fw => {
        fw.update();
        fw.draw(ctx);
      });

      // Filter out empty fireworks
      fireworks = fireworks.filter(fw => !fw.exploded || fw.particles.length > 0);

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}
