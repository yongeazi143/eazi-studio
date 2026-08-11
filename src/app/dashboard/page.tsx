"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FolderGit2, Plus, Clock, CheckCircle2, Trash2, 
  Play, TrendingUp, Search, Film
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Empty } from "@/components/ui/Empty";

interface Project {
  id: string;
  title: string;
  status: string;
  niche: string | null;
  brief: string | null;
  updatedAt: string;
}

const PIPELINE_STEPS: Record<string, { label: string; percent: number; route: string }> = {
  IDEA: { label: "Ideation", percent: 8, route: "/dashboard/ideation" },
  TITLE: { label: "Title Choice", percent: 16, route: "/dashboard/ideation" },
  SCRIPT: { label: "Scripting", percent: 25, route: "/dashboard/script" },
  AUDIO: { label: "Voiceover", percent: 33, route: "/dashboard/audio-transcript" },
  TRANSCRIPT: { label: "Transcribing", percent: 41, route: "/dashboard/audio-transcript" },
  PROMPTS: { label: "Visual Prompts", percent: 50, route: "/dashboard/storyboard-images" },
  FLOW_PENDING: { label: "Flow Rendering", percent: 58, route: "/dashboard/storyboard-images" },
  FLOW_COMPLETE: { label: "Review Scenes", percent: 66, route: "/dashboard/storyboard-images" },
  ASSETS_READY: { label: "Assets Ready", percent: 75, route: "/dashboard/storyboard-images" },
  EDITING: { label: "Video Editing", percent: 83, route: "/dashboard/publish" },
  METADATA: { label: "Metadata Gen", percent: 91, route: "/dashboard/publish" },
  THUMBNAIL: { label: "Thumbnail Creator", percent: 96, route: "/dashboard/thumbnail" },
  DONE: { label: "Completed", percent: 100, route: "/dashboard/publish" }
};

export default function DashboardProjectList() {
  const router = useRouter();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch active projects — always fetch fresh from the DB
  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const projectList = data.projects || [];
        setProjects(projectList);
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Delete project handler
  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${deleteTarget}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget));
        showToast("Project deleted successfully.", "success");
      } else {
        showToast("Failed to delete project. Please try again.", "error");
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Redirect to current step page
  const handleResumeProject = (project: Project) => {
    const stepConfig = PIPELINE_STEPS[project.status] || PIPELINE_STEPS.IDEA;
    if (project.status === "IDEA" || project.status === "TITLE") {
      router.push(`${stepConfig.route}?id=${project.id}`);
    } else {
      router.push(`${stepConfig.route}/${project.id}`);
    }
  };

  // Filter projects by search query
  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.niche && project.niche.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Suggestions: only shown when query is non-empty
  const suggestions = searchQuery.trim().length > 0 ? filteredProjects : [];

  // Navigate to a project from the search
  const navigateToProject = useCallback((project: Project) => {
    setSearchQuery("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    handleResumeProject(project);
  }, []);

  // Keyboard nav for autocomplete
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = highlightedIndex >= 0 ? suggestions[highlightedIndex] : suggestions[0];
      if (target) navigateToProject(target);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Statistics summaries
  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === "DONE").length;
  const inProgressProjects = totalProjects - completedProjects;
  const completionRate = totalProjects > 0
    ? Math.round((completedProjects / totalProjects) * 100)
    : 0;

  return (
    <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-foreground pb-20 px-4 md:px-0">
      
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-2 border-b border-black/5 dark:border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400 bg-clip-text text-transparent">
            Creator Studio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and automate your YouTube video generation pipeline</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Top Search Bar — Autocomplete */}
          <div ref={searchRef} className="relative w-full md:w-64">
            <div className={`flex items-center gap-2.5 bg-black/5 dark:bg-white/5 rounded-xl border transition-colors px-3.5 py-2 ${
              showSuggestions && suggestions.length > 0
                ? "border-red-500/50 rounded-b-none"
                : "border-black/5 dark:border-white/5 focus-within:border-red-500/50"
            }`}>
              <Search className="w-4 h-4 text-gray-400 dark:text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => { if (searchQuery.trim()) setShowSuggestions(true); }}
                onKeyDown={handleSearchKeyDown}
                className="bg-transparent border-0 outline-none text-xs w-full text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-50 bg-white dark:bg-[#121214] border border-t-0 border-red-500/50 rounded-b-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((proj, i) => {
                  const stepConfig = PIPELINE_STEPS[proj.status] || PIPELINE_STEPS.IDEA;
                  const isCompleted = proj.status === "DONE";
                  const isHovered = i === highlightedIndex;
                  return (
                    <button
                      key={proj.id}
                      onMouseDown={(e) => { e.preventDefault(); navigateToProject(proj); }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                        isHovered
                          ? "bg-[#E00C1D]/8 dark:bg-[#E00C1D]/10"
                          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 shrink-0">
                        <Film className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{proj.title}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {proj.niche || "General"} · {isCompleted ? "Completed" : stepConfig.label}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-[#E00C1D]/10 text-[#E00C1D]"
                      }`}>
                        {isCompleted ? "Done" : `${stepConfig.percent}%`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results notice */}
            {showSuggestions && searchQuery.trim().length > 0 && suggestions.length === 0 && (
              <div className="absolute left-0 right-0 z-50 bg-white dark:bg-[#121214] border border-t-0 border-red-500/50 rounded-b-xl shadow-xl px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">No projects match &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>

          <Link href="/dashboard/ideation" className="bg-[#E00C1D] hover:bg-[#b0060f] text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-red-900/20 active:scale-98 flex items-center gap-2 cursor-pointer text-sm shrink-0">
            <Plus className="w-4 h-4 stroke-[2.5]" /> New Video
          </Link>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
        <div className="glass-card bg-white dark:bg-[#121214]/80 p-5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Projects</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalProjects}</p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card bg-white dark:bg-[#121214]/80 p-5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">In Progress</p>
            <p className="text-2xl font-bold text-foreground mt-1">{inProgressProjects}</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card bg-white dark:bg-[#121214]/80 p-5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Videos Completed</p>
            <p className="text-2xl font-bold text-foreground mt-1">{completedProjects}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card bg-white dark:bg-[#121214]/80 p-5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Completion Rate</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {totalProjects === 0 ? "—" : `${completionRate}%`}
            </p>
          </div>
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[#E00C1D]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" label="Loading your video pipeline..." />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="glass-card bg-white dark:bg-[#121214]/50 border border-black/5 dark:border-white/5 rounded-3xl mt-4">
          <Empty
            icon={<Film className="w-7 h-7" />}
            title={searchQuery ? "No projects found" : "No projects yet"}
            description={searchQuery
              ? "No matches found for your filter query. Try searching for another keyword."
              : "You haven't generated any videos yet. Kick off your automation pipeline by brainstorming video ideas."
            }
            action={!searchQuery ? (
              <Link href="/dashboard/ideation" className="btn-primary inline-flex items-center gap-2 cursor-pointer shadow-lg">
                <Plus className="w-4 h-4" /> Start First Video
              </Link>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {filteredProjects.map((proj) => {
            const stepConfig = PIPELINE_STEPS[proj.status] || PIPELINE_STEPS.IDEA;
            const isCompleted = proj.status === "DONE";

            return (
              <div 
                key={proj.id} 
                onClick={() => handleResumeProject(proj)}
                className="group glass-card bg-white dark:bg-white/[0.03] p-6 pb-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-xl hover:border-[#E00C1D]/50 hover:bg-black/[0.01] dark:hover:bg-white/[0.05] transition-all cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors pointer-events-none" />

                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="default">{proj.niche || "General"}</Badge>
                    {isCompleted ? (
                      <Badge variant="green" icon={<CheckCircle2 className="w-3 h-3" />}>Completed</Badge>
                    ) : (
                      <Badge variant="red" icon={<Clock className="w-3 h-3" />}>{stepConfig.label}</Badge>
                    )}
                  </div>

                  {/* Card Title */}
                  <h3 className="text-base font-bold text-foreground mb-2 leading-snug line-clamp-2 group-hover:text-[#E00C1D] transition-colors">
                    {proj.title}
                  </h3>
                </div>

                {/* Stepper Progress Bar */}
                <div className="mt-4 w-full">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-semibold">
                    <span>Pipeline Progress</span>
                    <span>{stepConfig.percent}%</span>
                  </div>
                  <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-linear-to-r from-[#E00C1D] to-[#ff6a3d]'}`}
                      style={{ width: `${stepConfig.percent}%` }}
                    />
                  </div>
                </div>

                {/* Hover Action Panel */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3 mt-4">
                  <span className="text-[10px] text-gray-500 font-medium">
                    Updated {new Date(proj.updatedAt).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      title="Delete video project"
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <button 
                      title="Resume video creation"
                      className="p-2 text-[#E00C1D] bg-[#E00C1D]/10 group-hover:bg-[#E00C1D] group-hover:text-white rounded-lg transition-all shrink-0 cursor-pointer flex items-center justify-center"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete this project?"
        description="This action is permanent and cannot be undone. All scripts, audio, scenes, and metadata will be removed."
        confirmLabel="Delete Project"
        cancelLabel="Keep It"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
