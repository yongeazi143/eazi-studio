"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FileAudio, Play, Clock, ChevronRight, Mic2, Music, 
  CheckCircle, PlusCircle, Search, AlertCircle 
} from "lucide-react";

interface Project {
  id: string;
  title: string;
  status: string;
  niche: string | null;
  audio?: {
    id: string;
    durationSecs: number;
    createdAt: string;
  } | null;
  updatedAt: string;
}

export default function AudioHistoryDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          // Filter to show only projects that have reached the SCRIPT, AUDIO, or later stages
          const filtered = (data.projects || []).filter((p: any) => 
            p.status !== "IDEA" && p.status !== "TITLE"
          );
          setProjects(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch projects for audio dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.niche && p.niche.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const transcribedProjects = filteredProjects.filter((p) => p.audio);
  const pendingProjects = filteredProjects.filter((p) => !p.audio);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="w-full min-h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-20 px-4 md:px-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-2 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Voiceover & Audio Hub
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage transcripts, upload voiceovers, and configure scene synchronization</p>
        </div>

        <div className="flex items-center gap-2.5 bg-white/5 rounded-xl border border-white/5 px-3.5 py-2 w-full md:w-60 focus-within:border-red-500/50 transition-colors">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input 
            type="text" 
            placeholder="Search voiceovers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-0 outline-none text-xs w-full text-white placeholder:text-gray-500 focus:ring-0 focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-3 border-[#E00C1D] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading audio records...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card bg-[#121214]/50 border border-white/5 p-12 text-center rounded-3xl mt-4">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#E00C1D]">
            <Mic2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No projects ready for voiceover</h3>
          <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
            You need to complete the script editor phase for a project before you can upload its voiceover track.
          </p>
          <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-[#E00C1D] hover:bg-[#b0060f] text-white font-semibold text-sm transition-all shadow-md shadow-red-950/10">
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
          
          {/* LEFT: Transcribed/Active Voiceovers (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2 px-1">
              <CheckCircle className="w-4.5 h-4.5 text-green-400" />
              <span>Transcribed Voiceovers ({transcribedProjects.length})</span>
            </h2>

            {transcribedProjects.length === 0 ? (
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-8 text-center italic text-sm text-gray-500">
                No active transcriptions found. Upload a voiceover on one of your pending projects on the right to start.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {transcribedProjects.map((proj) => (
                  <div 
                    key={proj.id}
                    onClick={() => router.push(`/dashboard/audio-transcript/${proj.id}`)}
                    className="group bg-white/[0.01] border border-white/5 hover:border-[#E00C1D]/50 hover:bg-white/[0.03] p-5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#E00C1D] shrink-0 group-hover:scale-105 transition-transform">
                        <FileAudio className="w-5.5 h-5.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-100 group-hover:text-[#E00C1D] transition-colors truncate">{proj.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                          <span className="font-mono text-green-400 bg-green-500/10 border border-green-500/10 px-2 py-0.5 rounded text-[10px]">
                            {proj.audio ? formatDuration(proj.audio.durationSecs) : "0:00"}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{proj.niche || "General"}</span>
                          <span>•</span>
                          <span>Transcribed {proj.audio ? new Date(proj.audio.createdAt).toLocaleDateString() : ""}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Pending Uploads (1/3 width) */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2 px-1">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
              <span>Pending Voiceover ({pendingProjects.length})</span>
            </h2>

            {pendingProjects.length === 0 ? (
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-8 text-center italic text-sm text-gray-500">
                All scripts have voiceovers!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingProjects.map((proj) => (
                  <div 
                    key={proj.id}
                    onClick={() => router.push(`/dashboard/audio-transcript/${proj.id}`)}
                    className="group bg-black/30 border border-white/5 hover:border-[#E00C1D]/50 hover:bg-white/[0.01] p-4 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-gray-200 truncate group-hover:text-[#E00C1D] transition-colors">{proj.title}</h3>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase font-mono tracking-wider">{proj.niche || "General"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-[#E00C1D] group-hover:border-[#E00C1D] text-gray-400 group-hover:text-white transition-all shrink-0">
                      <PlusCircle className="w-4.5 h-4.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
