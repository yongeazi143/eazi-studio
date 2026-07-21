"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic2, FileAudio, Trash2, Play, CheckCircle, ChevronRight,
  Volume2, AlertTriangle, Copy, Check, ExternalLink,
  Wand2, Settings2, Info, Headphones, X, FileText, Sparkles
} from "lucide-react";
import { Select } from "@/components/ui/Select";

import PipelineStepper from "@/components/pipeline/PipelineStepper";
import DropZone from "@/components/pipeline/DropZone";
import { decodeAudioFile } from "@/utils/audioUtils";
import { processChunks, formatTimestamp } from "@/utils/segmentUtils";
import { saveAudioFile, getAudioFile, deleteAudioFile } from "@/utils/audioDb";

interface AudioTranscriptPageProps {
  params: Promise<{ projectId: string }>;
}

// Voice persona presets for Gemini TTS
const VOICE_PERSONAS = [
  {
    id: "deep_narrator",
    label: "Deep Narrator",
    voice: "Charon",
    icon: "🎙",
    description: "Authoritative, cinematic, commanding presence",
    systemPrompt: "Speak in a deep, authoritative American male narrator voice. Deliver with conviction, gravitas, and emotional weight. Pause naturally at commas and periods. Emphasize key words with subtle vocal stress. Channel the tone of a high-budget documentary narrator."
  },
  {
    id: "conversational",
    label: "Conversational Guide",
    voice: "Kore",
    icon: "💬",
    description: "Warm, relatable, like a trusted friend",
    systemPrompt: "Speak in a warm, conversational tone — like a trusted friend sharing something important. Sound genuine and relatable, never robotic. Use natural cadence with gentle emphasis on emotional beats. Pace yourself slightly slower on revelations."
  },
  {
    id: "energetic",
    label: "Energetic Presenter",
    voice: "Puck",
    icon: "⚡",
    description: "Fast-paced, motivational, high energy",
    systemPrompt: "Speak with high energy and enthusiasm — like a motivational speaker on stage. Maintain urgency and forward momentum. Punch key phrases with emphatic stress. Keep the pace brisk but articulate every word clearly."
  },
  {
    id: "storyteller",
    label: "Dramatic Storyteller",
    voice: "Aoede",
    icon: "📖",
    description: "Emotive, dramatic, carries emotional arcs",
    systemPrompt: "Speak like a master storyteller — emotive, dramatic, drawing the listener in emotionally. Let tension build slowly in warning sections. Soften your tone for introspective moments. Pause meaningfully before key revelations for maximum impact."
  },
];


// Format script for TTS (strip markdown, clean headers to stage directions)
function formatScriptForTTS(rawScript: any): string {
  if (!rawScript || typeof rawScript !== "string") return "";
  return rawScript
    .replace(/^#{1,6}\s+/gm, "") // strip markdown headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // strip bold
    .replace(/\*(.*?)\*/g, "$1") // strip italic
    .replace(/\[HOOK\]/g, "\n[HOOK — speak with immediate urgency]\n")
    .replace(/\[BRIDGE\]/g, "\n[BRIDGE — ease into storytelling tone]\n")
    .replace(/\[BODY\]/g, "\n[BODY — maintain consistent narrator voice]\n")
    .replace(/\[MILESTONE \d+\]/g, (m) => `\n${m}\n`)
    .replace(/\[CTA\]/g, "\n[CTA — warm, direct, conversational close]\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function AudioTranscriptPage({ params }: AudioTranscriptPageProps) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [projectStatus, setProjectStatus] = useState<string>("SCRIPT");
  const [audioFile, setAudioFile] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioFileName, setAudioFileName] = useState<string>("");
  const [audioFileSize, setAudioFileSize] = useState<number>(0);
  const [transcriptLines, setTranscriptLines] = useState<any[]>([]);
  const [generatedScenes, setGeneratedScenes] = useState<any[]>([]);
  const [selectedPersona, setSelectedPersona] = useState(VOICE_PERSONAS[0]);
  
  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [promptsReady, setPromptsReady] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [status, setStatus] = useState<
    "idle" | "decoding" | "loading_model" | "transcribing" | "saving_transcript" | "generating_scenes" | "done" | "error"
  >("idle");
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [chunkProgress, setChunkProgress] = useState<{ percent: number; processed: number; total: number } | null>(null);
  const [audioDurationSecs, setAudioDurationSecs] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const workerRef = useRef<Worker | null>(null);



  // Load project on mount
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects?id=${projectId}`);
        if (!res.ok) { router.push("/dashboard"); return; }
        const data = await res.json();
        if (data.project) {
          setProject(data.project);
          setProjectStatus(data.project.status);
          if (data.project.nichePresetId) setSelectedPresetId(data.project.nichePresetId);
          if (data.project.status === "SCRIPT") {
            await fetch("/api/projects", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: projectId, status: "AUDIO" }),
            });
            setProjectStatus("AUDIO");
            localStorage.removeItem("eazi_projects_cache");
          }
          if (data.project.audio?.transcript?.length > 0) {
            setTranscriptLines(data.project.audio.transcript);
            setStatus("done");
          }
          const savedBlob = await getAudioFile(projectId);
          if (savedBlob) {
            setAudioFile(savedBlob);
            setAudioUrl(URL.createObjectURL(savedBlob));
            setAudioFileName(`${data.project.title.replace(/\s+/g, "_")}_voiceover.mp3`);
            setAudioFileSize(savedBlob.size);
          }
        }
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    };
    fetchProject();

    // Fetch user's niche presets
    fetch("/api/niche-presets")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => {});
  }, [projectId, router]);

  // Worker
  useEffect(() => {
    workerRef.current = new Worker("/transcriber.worker.js", { type: "module" });
    workerRef.current.addEventListener("message", async (e) => {
      const { type, payload } = e.data;
      if (type === "status") {
        if (payload === "loading_model") setStatus("loading_model");
        if (payload === "transcribing") { setStatus("transcribing"); setChunkProgress(null); }
      } else if (type === "model_progress") {
        if (payload.status === "progress" && payload.total) {
          setTranscribeProgress((payload.loaded / payload.total) * 100);
        }
      } else if (type === "transcribe_progress") {
        setChunkProgress({ percent: payload.percent, processed: payload.processedChunks, total: payload.totalChunks });
      } else if (type === "cancelled") {
        setStatus("idle");
        setChunkProgress(null);
      } else if (type === "result") {
        setChunkProgress(null);
        const chunks = payload.chunks ?? [];
        const processedLines = processChunks(chunks);
        if (processedLines.length === 0) {
          setErrorMsg("No speech detected in this audio file. Please try a different track.");
          setStatus("error");
          return;
        }
        
        setStatus("saving_transcript");
        try {
          const totalDuration = processedLines[processedLines.length - 1].endTime;
          const apiRes = await fetch("/api/audio-transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, durationSecs: totalDuration, transcript: processedLines }),
          });
          
          if (apiRes.ok) {
            setTranscriptLines(processedLines);
            setProjectStatus("TRANSCRIPT");
            setStatus("done");
          } else {
            let errData;
            try {
              errData = await apiRes.json();
            } catch (jsonErr) {
              errData = { error: `Server returned an invalid response (${apiRes.status})` };
            }
            setErrorMsg(errData.error || "Failed to save transcript.");
            setStatus("error");
          }
        } catch (err: any) {
          setErrorMsg(err.message || "Failed to sync transcription.");
          setStatus("error");
        }
      } else if (type === "error") {
        setErrorMsg(payload || "Transcription worker failed.");
        setStatus("error");
      }
    });
    return () => workerRef.current?.terminate();
  }, [projectId]);

  const handleCancel = () => {
    workerRef.current?.postMessage({ type: "cancel" });
    setChunkProgress(null);
    setStatus("idle");
  };

  const handleFileDrop = async (file: File) => {
    setErrorMsg("");
    setTranscribeProgress(0);
    setAudioFileName(file.name);
    setAudioFileSize(file.size);
    try {
      setStatus("decoding");
      await saveAudioFile(projectId, file);
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      const audioData = await decodeAudioFile(file);
      workerRef.current?.postMessage({ type: "transcribe", payload: { audioData } }, [audioData.buffer]);
    } catch (err: any) {
      setErrorMsg(`Audio processing failed: ${err.message || "Unknown error"}`);
      setStatus("error");
    }
  };

  const handleRemoveAudio = async () => {
    if (!confirm("Remove this audio file? This will also reset the transcript and scenes.")) return;
    try {
      await deleteAudioFile(projectId);
      setAudioFile(null);
      setAudioUrl("");
      setAudioFileName("");
      setAudioFileSize(0);
      setTranscriptLines([]);
      setStatus("idle");
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, status: "SCRIPT" }),
      });
      setProjectStatus("SCRIPT");
    } catch (err) {
      console.error("Failed to remove audio:", err);
    }
  };

  const handleGenerateStoryboard = async () => {
    setStatus("generating_scenes");
    setErrorMsg("");
    setPromptsReady(false);
    try {
      const apiRes = await fetch("/api/image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, customInstructions, nichePresetId: selectedPresetId || null }),
      });
      if (apiRes.ok) {
        // Fetch the generated scenes to show for review before navigating
        const refreshRes = await fetch(`/api/projects?id=${projectId}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const scenes = refreshData.project?.scenes ?? [];
          setGeneratedScenes([...scenes].sort((a: any, b: any) => a.index - b.index));
        }
        setPromptsReady(true);
        setStatus("done");
      } else {
        const errData = await apiRes.json();
        setErrorMsg(errData.error || "Failed to generate storyboard scenes.");
        setStatus("error");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate storyboard scenes.");
      setStatus("error");
    }
  };

  const formattedScript = formatScriptForTTS(project?.script?.content || "");
  const systemPrompt = selectedPersona.systemPrompt;
  const modelSettingsText = `Model: gemini-2.5-pro-preview-tts\nVoice: ${selectedPersona.voice}\nTemperature: 1\nOutput: Audio (WAV or MP3)`;

  let briefData: any = {};
  if (project?.brief) {
    try {
      briefData = JSON.parse(project.brief);
    } catch (e) {}
  }
  const videoStyle = briefData.videoStyle || "doodle";

  return (
    <div className="w-full min-h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-24 px-4 md:px-0">
      {/* Top Pipeline Stepper */}
      <PipelineStepper projectId={projectId} projectStatus={projectStatus} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Workspace / Voiceover & Audio</span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">{project?.title || "Audio Workspace"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(status === "idle" || status === "done") && project?.script?.content && (
            <button
              onClick={() => setIsTTSModalOpen(true)}
              className="px-4 py-2.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 flex items-center gap-1.5"
            >
              <Wand2 className="w-4 h-4 text-blue-400" /> Generate Voiceover with Gemini TTS
            </button>
          )}
          {promptsReady && (
            <Link
              href={`/dashboard/storyboard-images/${projectId}`}
              className="px-5 py-2.5 text-xs font-bold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-lg shadow-red-950/20 flex items-center gap-1.5"
            >
              Next: Storyboard Images <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          UPLOAD ZONE  (idle state)
      ═══════════════════════════════════════════════ */}
      {status === "idle" && (
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/4 rounded-full blur-[100px] pointer-events-none" />
          <div className="w-16 h-16 mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(224,12,29,0.1)]">
            <Headphones className="w-8 h-8 text-[#E00C1D]" />
          </div>
          <h2 className="text-lg font-bold mb-2">Upload Voiceover Audio</h2>
          <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            After generating your voiceover in Google AI Studio (or any platform), upload the audio file below to transcribe it and prepare for storyboarding.
          </p>
          <div className="w-full max-w-lg">
            <DropZone onFileDrop={handleFileDrop} />
          </div>
          <p className="text-xs text-gray-600 mt-5">Accepts MP3, WAV, M4A, OGG — up to 200MB</p>
        </div>
      )}

      {/* Processing / Loading */}
      {["decoding", "loading_model", "transcribing", "saving_transcript", "generating_scenes"].includes(status) && (
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[320px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#E00C1D]/15 blur-md animate-ping" />
              <div className="w-12 h-12 rounded-full border-3 border-white/5 border-t-[#E00C1D] animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-bold mb-1">
            {status === "decoding" && "Decoding Audio Track..."}
            {status === "loading_model" && "Loading Speech Recognition Model..."}
            {status === "transcribing" && "Transcribing Speech to Text..."}
            {status === "saving_transcript" && "Saving Transcript..."}
            {status === "generating_scenes" && "Generating Storyboard Prompts..."}
          </h3>
          <p className="text-xs text-gray-400 max-w-md mb-6">
            {status === "decoding" && `Extracting raw audio from "${audioFileName}"`}
            {status === "loading_model" && "Downloading Whisper Tiny model (~75MB). This is cached after the first download."}
            {status === "transcribing" && !chunkProgress && "Speech recognition is starting — this runs locally on your device. Long audio files can take several minutes."}
            {status === "transcribing" && chunkProgress && `Processing audio segment ${chunkProgress.processed} of ${chunkProgress.total} — please keep this tab open.`}
            {status === "saving_transcript" && "Finalizing and saving your transcript to the database..."}
            {status === "generating_scenes" && "Analyzing transcript and sending to AI to build your storyboard scenes. This may take up to a minute..."}
          </p>

          {/* Model Download Progress */}
          {status === "loading_model" && (
            <div className="w-full max-w-xs space-y-2 mb-6">
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-[#E00C1D] transition-all duration-300" style={{ width: `${transcribeProgress}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 font-mono font-bold">{Math.round(transcribeProgress)}% downloaded</span>
            </div>
          )}

          {/* Real-time Chunk Progress */}
          {status === "transcribing" && chunkProgress && (
            <div className="w-full max-w-sm space-y-3 mb-6">
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E00C1D] to-orange-400 transition-all duration-500"
                  style={{ width: `${chunkProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>Segment {chunkProgress.processed}/{chunkProgress.total}</span>
                <span>{chunkProgress.percent}% complete</span>
              </div>
            </div>
          )}

          {/* No progress yet for transcribing — show indeterminate pulse */}
          {status === "transcribing" && !chunkProgress && (
            <div className="w-full max-w-sm mb-6">
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-[#E00C1D]/60 rounded-full animate-pulse" style={{ width: "30%" }} />
              </div>
            </div>
          )}

          {/* Cancel button */}
          {(status === "transcribing" || status === "decoding") && (
             <button
              onClick={handleCancel}
              className="text-xs font-semibold text-gray-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 bg-white/[0.02] hover:bg-red-500/5 px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Cancel Transcription
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="bg-white/[0.01] border border-red-500/10 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-red-400 mb-2">Transcription Failed</h3>
          <p className="text-sm text-gray-400 max-w-md mb-8">{errorMsg || "An unexpected error occurred."}</p>
          <button
            onClick={() => setStatus("idle")}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-semibold transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Done State */}
      {status === "done" && (
        <div className="flex flex-col gap-6">
          {/* Audio File Summary */}
          <div className="bg-black/[0.02] dark:bg-white/[0.01] border border-green-500/20 dark:border-green-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 shrink-0">
                <FileAudio className="w-6 h-6 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">{audioFileName || "Voiceover Track"}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{(audioFileSize / 1024 / 1024).toFixed(2)} MB</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-green-650 dark:text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" /> Transcription complete
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRemoveAudio}
              className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-black/10 dark:border-white/5 hover:border-red-500/20 dark:hover:border-red-500/20 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-red-500/5 dark:hover:bg-red-500/5 px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
            >
              <Trash2 className="w-4 h-4" /> Remove Audio
            </button>
          </div>

          {/* After generation: show image prompts for review */}
          {promptsReady && generatedScenes.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generated Image Prompts ({generatedScenes.length} scenes)</span>
                </h3>
                <button
                  onClick={() => setPromptsReady(false)}
                  className="text-[11px] font-semibold text-gray-500 hover:text-white border border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.05] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                >
                  ↩ Tweak & Regenerate
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {generatedScenes.map((scene, idx) => (
                  <div
                    key={scene.id}
                    className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col gap-3 hover:border-white/10 hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Scene {idx + 1}
                      </span>
                      <span className="text-[11px] font-mono text-gray-500">
                        [{formatTimestamp(scene.startTime)} → {formatTimestamp(scene.endTime)}]
                      </span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed italic">&ldquo;{scene.narration}&rdquo;</p>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1.5">
                      <span className="text-[9px] text-gray-500 font-mono font-bold uppercase tracking-wider">Image Prompt</span>
                      <p className="text-xs text-gray-400 leading-relaxed">{scene.imagePrompt}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Link
                  href={`/dashboard/storyboard-images/${projectId}`}
                  className="px-6 py-3 text-sm font-bold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-[0_0_20px_rgba(224,12,29,0.3)] flex items-center gap-2"
                >
                  Proceed to Storyboard Images <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left: Transcript View */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 px-1">
                  <FileText className="w-4 h-4 text-[#E00C1D]" />
                  <span>Audio Transcript ({transcriptLines.length} segments)</span>
                </h3>
                
                <div className="bg-black/40 border border-white/5 rounded-2xl max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-5 flex flex-col gap-4">
                  {transcriptLines.map((line, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="text-[10px] font-mono text-gray-500 pt-0.5 shrink-0 w-12 text-right group-hover:text-[#E00C1D] transition-colors">
                        {formatTimestamp(line.startTime)}
                      </div>
                      <div className="text-sm text-gray-300 leading-relaxed group-hover:text-white transition-colors">
                        {line.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Generate Storyboard Configuration */}
              <div className="flex flex-col gap-4 sticky top-6">
                <div className="glass-card bg-white dark:bg-gradient-to-br dark:from-[#0d0d10] dark:to-[#111116] border border-black/10 dark:border-white/5 p-6 rounded-2xl shadow-xl dark:shadow-black/40 flex flex-col gap-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Generate Storyboard</h3>
                    </div>
                    <p className="text-xs text-gray-550 dark:text-gray-500 leading-relaxed">
                      We&apos;ll analyze the transcript and build detailed visual prompts based on your global settings.
                    </p>
                  </div>

                  <div className="bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Base Style</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{videoStyle.replace("-", " ")}</span>
                  </div>

                  {/* Niche Preset Selector */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Niche Preset</label>
                      <Link href="/dashboard/presets" className="text-[10px] text-[#E00C1D] hover:text-red-500 transition-colors">
                        {presets.length === 0 ? "+ Create preset" : "Manage presets"}
                      </Link>
                    </div>
                    <Select
                      value={selectedPresetId}
                      onChange={setSelectedPresetId}
                      placeholder="— None (generic) —"
                      options={[
                        { value: "", label: "— None (generic) —" },
                        ...presets.map((p: any) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                    {selectedPresetId && presets.find((x: any) => x.id === selectedPresetId) && (
                      <div className="text-[10px] text-gray-505 bg-black/[0.01] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                        <span className="text-gray-700 dark:text-gray-400 font-semibold">
                          {presets.find((x: any) => x.id === selectedPresetId)?.name}
                        </span>
                        <span>
                          {presets.find((x: any) => x.id === selectedPresetId)?.textOverlayEnabled
                            ? "✓ Text overlay on"
                            : "Text overlay off"}{" "}
                          · {presets.find((x: any) => x.id === selectedPresetId)?.videoStyle}
                        </span>
                      </div>
                    )}
                  </div>


                  <button
                    onClick={handleGenerateStoryboard}
                    className="w-full py-3.5 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(224,12,29,0.3)] mt-2"
                  >
                    Generate Image Prompts
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TTS Modal */}
      {isTTSModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111116] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#111116]/90 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Wand2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Generate Voiceover with Gemini TTS</h2>
                  <p className="text-[11px] text-gray-500">Use Google AI Studio to generate your voiceover, then upload it on the main page.</p>
                </div>
              </div>
              <button
                onClick={() => setIsTTSModalOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-6">
              {/* Step indicator row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {["Select Voice Style", "Copy Script", "Copy System Prompt", "Open AI Studio", "Upload Audio"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5">
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 w-4.5 h-4.5 rounded-full flex items-center justify-center">{i + 1}</span>
                      <span className="text-xs text-gray-300 font-medium whitespace-nowrap">{s}</span>
                    </div>
                    {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                  </div>
                ))}
              </div>

              {/* ── STEP 1: Voice Persona Picker ── */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="text-blue-500 font-black">01</span> Choose Voice Style
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {VOICE_PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersona(p)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                        selectedPersona.id === p.id
                          ? "bg-blue-500/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{p.icon}</span>
                      <p className={`text-xs font-bold mb-1 ${selectedPersona.id === p.id ? "text-white" : "text-gray-200"}`}>{p.label}</p>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{p.description}</p>
                      <div className="mt-2 text-[10px] font-mono text-gray-600">
                        Voice: <span className={selectedPersona.id === p.id ? "text-blue-400" : "text-gray-400"}>{p.voice}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── STEP 2 + 3: Script + System Prompt ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Formatted Script */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-blue-500 font-black">02</span> TTS-Formatted Script
                    </label>
                    <CopyButton text={formattedScript} label="Copy Script" />
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                    <pre className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">{formattedScript || "Script not found — generate a script first in the Script workspace."}</pre>
                  </div>
                </div>

                {/* System Prompt + Settings */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-blue-500 font-black">03</span> System Prompt (Paste in AI Studio)
                      </label>
                      <CopyButton text={systemPrompt} label="Copy Prompt" />
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 h-28 overflow-y-auto">
                      <p className="text-xs text-blue-200/80 font-sans leading-relaxed italic">{systemPrompt}</p>
                    </div>
                  </div>

                  {/* Model Settings */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Settings2 className="w-3.5 h-3.5 text-gray-500" /> Model Settings
                      </label>
                      <CopyButton text={modelSettingsText} label="Copy" />
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 grid grid-cols-2 gap-3">
                      {[
                        { key: "Model", val: "gemini-2.5-pro-preview-tts" },
                        { key: "Voice", val: selectedPersona.voice },
                        { key: "Temperature", val: "1.0" },
                        { key: "Output", val: "Audio (MP3/WAV)" },
                      ].map(({ key, val }) => (
                        <div key={key} className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{key}</span>
                          <span className="text-xs font-mono text-gray-200">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── STEP 4: Open AI Studio CTA ── */}
              <a
                href="https://aistudio.google.com/generate-speech"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between w-full p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 hover:from-blue-600/15 hover:to-blue-500/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400">
                    <ExternalLink className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-300">Open Google AI Studio → Speech Generation</p>
                    <p className="text-xs text-blue-400/60 mt-0.5">Paste the script + system prompt, select the voice, download your MP3</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
              </a>
              
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
