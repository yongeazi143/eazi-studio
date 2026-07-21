"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, FileText, Save, Eye, ChevronDown, ListCollapse, Info, Copy, Download
} from "lucide-react";
import PipelineStepper from "@/components/pipeline/PipelineStepper";

interface ScriptPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ScriptPage({ params }: ScriptPageProps) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [scriptText, setScriptText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showBrief, setShowBrief] = useState(true);
  const [copied, setCopied] = useState(false);

  // Accordion state inside the Brief panel
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openVideoIndex, setOpenVideoIndex] = useState<number | null>(0);

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);
  const toggleVideo = (idx: number) => setOpenVideoIndex(prev => prev === idx ? null : idx);

  // Auto-save timer reference
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch project details on mount
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects?id=${projectId}`);
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        if (data.project) {
          setProject(data.project);
          if (data.project.script) {
            setScriptText(data.project.script.content);
          }
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, router]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy script:", err);
    });
  };

  const handleDownloadScript = () => {
    const blob = new Blob([scriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.title || "project"}_script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle manual saving
  const handleSaveScript = async (textToSave = scriptText) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/script", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          content: textToSave,
        }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Failed to save script:", err);
      setSaveStatus("error");
    }
  };

  // Auto-save logic on keystroke delay
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setScriptText(nextVal);
    setSaveStatus("saving");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveScript(nextVal);
    }, 1500);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full min-h-[600px] flex flex-col items-center justify-center text-center p-8 animate-pulse text-white">
        <div className="w-10 h-10 border-3 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-base font-bold">Loading script workspace...</h3>
      </div>
    );
  }

  const brief = project?.brief ? JSON.parse(project.brief) : null;
  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(wordCount * 0.4); // approx. 150 words per minute -> 2.5 words per sec

  return (
    <div className="w-full min-h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-20 px-4 md:px-0">

      {/* Top Stepper */}
      <PipelineStepper projectId={projectId} projectStatus={project?.status} />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">WORKSPACE / SCRIPT EDITOR</span>
          <h1 className="text-base font-bold tracking-tight mt-0.5">{project?.title || "Untitled Project"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Brief Panel */}
          <button
            onClick={() => setShowBrief(!showBrief)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${showBrief
              ? "bg-white/5 border-white/10 text-white hover:bg-white/10"
              : "bg-black/40 border-white/5 text-gray-400 hover:border-white/10 hover:text-white"
              }`}
          >
            <Info className="w-4 h-4 text-[#E00C1D]" />
            <span>{showBrief ? "Hide Brief" : "Show Brief"}</span>
          </button>

          {/* Copy Script */}
          <button
            onClick={handleCopyScript}
            className="px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Copy className="w-4 h-4 text-[#E00C1D]" />
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          {/* Download Script */}
          <button
            onClick={handleDownloadScript}
            className="px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#E00C1D]" />
            <span>Download .txt</span>
          </button>

          <button
            onClick={() => handleSaveScript()}
            disabled={saveStatus === "saving"}
            className="px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>

          <Link
            href={`/dashboard/audio-transcript/${projectId}`}
            className="px-4 py-2 text-xs font-semibold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-lg transition-all shadow-md shadow-red-950/20 flex items-center gap-1.5"
          >
            <span>Next: Voiceover</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Editor & Sidebar split panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">

        {/* LEFT COLUMN: Editor area */}
        <div className={`flex-1 flex flex-col gap-3 min-w-0 transition-all duration-300`}>
          <div className="flex justify-between items-center px-1 text-[11px] text-gray-400 font-mono">
            <div className="flex items-center gap-3">
              <span>{wordCount} Words</span>
              <span>•</span>
              <span>Est. ~{Math.floor(estSeconds / 60)}m {estSeconds % 60}s</span>
            </div>
            <div>
              {saveStatus === "saving" && <span className="text-[#E00C1D] animate-pulse">Saving draft...</span>}
              {saveStatus === "saved" && <span className="text-green-400">✓ Saved to project</span>}
              {saveStatus === "error" && <span className="text-red-400">⚠️ Error auto-saving</span>}
              {saveStatus === "idle" && <span className="text-gray-600">Draft saved</span>}
            </div>
          </div>

          <div className="relative flex-1 flex flex-col bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden focus-within:border-[#E00C1D]/30 transition-all min-h-[350px] lg:min-h-[calc(100vh-240px)]">
            <textarea
              value={scriptText}
              onChange={handleTextChange}
              placeholder="Paste or write your full retention-optimized video script here... Separate your sections using headers like [HOOK], [BRIDGE], [BODY], or [CTA] to organize narration."
              className="w-full flex-1 min-h-full p-6 bg-transparent border-0 outline-none text-sm text-gray-200 leading-relaxed font-sans placeholder-gray-600 resize-none focus:ring-0"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Collapsible Sidebar Panel (Brief) */}
        {showBrief && (
          <div className="w-full lg:w-96 shrink-0 bg-white/[0.01] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 animate-fade-in relative" style={{ minHeight: 'calc(100vh - 240px)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[60px] pointer-events-none" />

            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#E00C1D]" />
                <span>Video Brief Summary</span>
              </span>
              <button
                onClick={() => setShowBrief(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </h3>

            {brief ? (
              <div className="flex flex-col gap-4 overflow-y-auto pr-1.5 flex-1" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
                {/* Brief Settings Summary */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Framework:</span>
                    <span className="font-semibold text-gray-300 capitalize">{brief.framework?.replace(/_/g, ' ') || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Niche:</span>
                    <span className="font-semibold text-gray-300">{brief.niche || "N/A"}</span>
                  </div>
                </div>

                {/* Hooks Dropdown */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleSection("hooks")}
                    className="w-full flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#E00C1D]" />
                      <span>Hook Scenarios</span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${openSection === 'hooks' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'hooks' && (
                    <div className="flex flex-col gap-2 animate-fade-in pl-1">
                      {brief.hookCandidates?.map((hook: any, i: number) => (
                        <div key={i} className="p-2.5 bg-black/50 border border-white/5 rounded-lg text-xs leading-relaxed">
                          <span className="font-bold text-[#E00C1D] block mb-1 uppercase text-[9px] font-mono tracking-wider">
                            {hook.type?.replace(/_/g, ' ')}
                          </span>
                          <p className="italic text-gray-200">"{hook.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outline Timeline Dropdown */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleSection("outline")}
                    className="w-full flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#E00C1D]" />
                      <span>Timeline Outline</span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${openSection === 'outline' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'outline' && (
                    <div className="flex flex-col gap-3 relative before:absolute before:left-2.5 before:inset-y-0 before:w-px before:bg-white/5 pl-1.5 ml-1 mt-1 animate-fade-in">
                      {brief.outline?.map((section: any, i: number) => (
                        <div key={i} className="relative pl-5">
                          <div className="absolute left-[7px] top-1.5 w-1.5 h-1.5 rounded-full bg-[#E00C1D] border border-[#121214]" />
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[9px] text-gray-500 font-mono font-bold uppercase">{section.section}</span>
                            <span className="text-[9px] text-gray-600 font-mono">~{section.estimatedSeconds}s</span>
                          </div>
                          <h5 className="text-[11px] font-bold text-gray-200 leading-tight">{section.title}</h5>
                          <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{section.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reference Video Summaries Accordion */}
                {brief.sourceSummaries && brief.sourceSummaries.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleSection("summaries")}
                      className="w-full flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ListCollapse className="w-4 h-4 text-[#E00C1D]" />
                        <span>Source References</span>
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${openSection === 'summaries' ? 'rotate-180' : ''}`} />
                    </button>

                    {openSection === 'summaries' && (
                      <div className="flex flex-col gap-2 animate-fade-in pl-1">
                        {brief.sourceSummaries.map((source: any, idx: number) => {
                          const isExpanded = openVideoIndex === idx;
                          return (
                            <div key={idx} className="flex flex-col bg-black/50 border border-white/5 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleVideo(idx)}
                                className="w-full flex justify-between items-center p-2.5 hover:bg-white/[0.01] transition-all text-left cursor-pointer"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-[8px] text-[#E00C1D] font-mono font-bold uppercase">VIDEO {idx + 1}</span>
                                  <h6 className="text-[10px] font-bold text-gray-200 truncate mt-0.5" title={source.title}>{source.title}</h6>
                                </div>
                                <ChevronDown className={`w-3 h-3 text-gray-500 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                              </button>

                              {isExpanded && (
                                <div className="p-2.5 pt-0 border-t border-white/5 text-[10px] text-gray-400 leading-relaxed flex flex-col gap-2">
                                  {source.summary && <p className="italic text-gray-300">"{source.summary}"</p>}
                                  {source.keyTeachings && source.keyTeachings.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-1.5">
                                      <span className="font-bold text-gray-500 font-mono text-[8px] uppercase">Key Lessons</span>
                                      {source.keyTeachings.map((t: any, tIdx: number) => (
                                        <div key={tIdx} className="flex flex-col">
                                          <span className="font-semibold text-gray-200">{t.topic}</span>
                                          <p className="text-gray-400 font-normal leading-normal">{t.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic text-center py-6">No brief found.</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
