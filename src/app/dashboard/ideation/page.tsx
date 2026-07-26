"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ChevronDown, MonitorPlay, TrendingUp, Edit3, CheckCircle2, Smartphone, Monitor, FileText, Video, Eye, Award, Search, Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/utils/supabase/client";
import PipelineStepper from "@/components/pipeline/PipelineStepper";
import { useToast } from "@/context/ToastContext";

function IdeationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const projectIdParam = searchParams.get("id");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(!!projectIdParam);
  const [projectStatus, setProjectStatus] = useState<string>("IDEA");
  // Snapshot of last-saved state to detect unsaved changes
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"autopilot" | "topic" | "remix">("autopilot");
  const [youtubeConnected, setYoutubeConnected] = useState(false);

  // Project Title State
  const [projectName, setProjectName] = useState('New Video Project');

  // Settings State
  const [activeRatio, setActiveRatio] = useState('16:9');
  const [videoStyle, setVideoStyle] = useState('');
  const [niche, setNiche] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('stoic_explainer');

  // Multi-Mode Inputs State
  const [optionalContext, setOptionalContext] = useState('');
  const [topic, setTopic] = useState('');
  const [youtubeUrls, setYoutubeUrls] = useState('');

  // Remix Tab Specific States
  const [selectedVideos, setSelectedVideos] = useState<any[]>([]);
  const [pasteUrl, setPasteUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<any[]>([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [expandedVideoTranscriptId, setExpandedVideoTranscriptId] = useState<string | null>(null);
  const [tempTranscripts, setTempTranscripts] = useState<Record<string, string>>({});

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingBrief, setIsSavingBrief] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isOutlineGenerating, setIsOutlineGenerating] = useState(false);
  const [generationResults, setGenerationResults] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [outlineError, setOutlineError] = useState<string | null>(null);

  // Exclusive outer accordion state — only one section open at a time
  // Values: "summaries" | "titles" | "hooks" | "outline" | null
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  // Exclusive inner video accordion state inside summaries section (defaults to first video open)
  const [openVideoIndex, setOpenVideoIndex] = useState<number | null>(0);

  const toggleVideo = (idx: number) => setOpenVideoIndex(prev => prev === idx ? null : idx);

  // Local Outline Cache State (title candidates mapped to their hooks & outline timeline)
  const [outlineCache, setOutlineCache] = useState<Record<string, any>>({});

  // Resizable Column State (Percentage of Left Column width)
  const [leftWidth, setLeftWidth] = useState(50); // Default to 50/50 split
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auth & API State
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [channelData, setChannelData] = useState<{ title: string, avatar: string, customUrl: string } | null>(null);
  const [subCount, setSubCount] = useState<string>("--");
  const [viewCount, setViewCount] = useState<string>("--");
  const [watchHours, setWatchHours] = useState<string>("--");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // Helpers
  function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Autocomplete Suggestions Effect
  useEffect(() => {
    if (!youtubeSearchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/suggest?q=${encodeURIComponent(youtubeSearchQuery)}`, {
          cache: 'no-store'
        });
        const data = await res.json();
        setSuggestions(data);
      } catch (e) {
        console.error("Failed to fetch autocomplete suggestions", e);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [youtubeSearchQuery]);

  // Load existing project if id parameter is in URL
  useEffect(() => {
    if (!projectIdParam) return;

    setEditingProjectId(projectIdParam);
    setIsProjectLoading(true);

    const loadProject = async () => {
      try {
        const res = await fetch(`/api/projects?id=${projectIdParam}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.project) {
          const project = data.project;
          setProjectName(project.title);
          setProjectStatus(project.status);
          if (project.niche) setNiche(project.niche);

          if (project.brief) {
            try {
              const briefObj = JSON.parse(project.brief);
              setGenerationResults(briefObj);

              if (briefObj.framework) setSelectedFramework(briefObj.framework);
              if (briefObj.niche) setNiche(briefObj.niche);
              if (briefObj.coreThesis) setTopic(briefObj.coreThesis);
              if (briefObj.videoStyle) setVideoStyle(briefObj.videoStyle);

              // Load title-outline caches if available
              if (briefObj.titleCandidates) {
                const newCache: Record<string, any> = {};
                newCache[project.title] = {
                  hookCandidates: briefObj.hookCandidates || [],
                  outline: briefObj.outline || [],
                  ctaPlan: briefObj.ctaPlan || {}
                };
                setOutlineCache(newCache);
              }

              // Determine active tab and restore selected videos with thumbnails
              if (briefObj.sourceSummaries && briefObj.sourceSummaries.length > 0) {
                setActiveTab("remix");
                const mappedVideos = briefObj.sourceSummaries.map((s: any, idx: number) => ({
                  id: s.url ? extractVideoId(s.url) || `vid-${idx}` : `vid-${idx}`,
                  title: s.title || `Reference Video ${idx + 1}`,
                  url: s.url || "",
                  // Restore thumbnail: saved in sourceSummary or reconstruct from video id
                  thumbnail: s.thumbnail || (s.url ? `https://img.youtube.com/vi/${extractVideoId(s.url)}/mqdefault.jpg` : ""),
                  channelTitle: s.channel || "",
                  transcript: s.transcript || (s.summary ? `Summary: ${s.summary}` : "")
                }));
                setSelectedVideos(mappedVideos);
              } else if (briefObj.coreThesis) {
                setActiveTab("topic");
              } else {
                setActiveTab("autopilot");
              }

              // Snapshot the loaded state using same structure as save payload so comparison works correctly
              setSavedSnapshot(JSON.stringify({
                title: project.title,
                niche: project.niche || "",
                brief: JSON.stringify({
                  framework: briefObj.framework || "",
                  niche: briefObj.niche || "",
                  duration: briefObj.duration || "",
                  titleCandidates: briefObj.titleCandidates || [],
                  hookCandidates: briefObj.hookCandidates || [],
                  outline: briefObj.outline || [],
                  ctaPlan: briefObj.ctaPlan || {},
                  sourceSummaries: briefObj.sourceSummaries || []
                })
              }));
            } catch (err) {
              console.error("Failed to parse loaded project brief", err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load project details", err);
      } finally {
        setIsProjectLoading(false);
      }
    };

    loadProject();
  }, [projectIdParam]);

  // Auto-set project name from first AI title candidate when user hasn't customised it
  useEffect(() => {
    if (
      generationResults?.titleCandidates?.length > 0 &&
      (projectName === 'New Video Project' || projectName === '')
    ) {
      const firstTitle = generationResults.titleCandidates[0]?.title;
      if (firstTitle) setProjectName(firstTitle);
    }
  }, [generationResults]);

  // Persistence Load effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedResults = localStorage.getItem('eazi_generation_results');
      if (savedResults) {
        try {
          setGenerationResults(JSON.parse(savedResults));
        } catch (e) {
          console.error("Failed to parse saved generation results", e);
        }
      }

      const savedCache = localStorage.getItem('eazi_outline_cache');
      if (savedCache) {
        try {
          setOutlineCache(JSON.parse(savedCache));
        } catch (e) {
          console.error("Failed to parse saved outline cache", e);
        }
      }

      const savedSelectedVideos = localStorage.getItem('eazi_selected_videos');
      if (savedSelectedVideos) {
        try {
          setSelectedVideos(JSON.parse(savedSelectedVideos));
        } catch (e) {
          console.error("Failed to parse saved selected videos", e);
        }
      }

      const savedProjectName = localStorage.getItem('eazi_project_name');
      if (savedProjectName) setProjectName(savedProjectName);

      const savedRatio = localStorage.getItem('eazi_active_ratio');
      if (savedRatio) setActiveRatio(savedRatio);

      const savedStyle = localStorage.getItem('eazi_video_style');
      if (savedStyle) setVideoStyle(savedStyle);

      const savedNiche = localStorage.getItem('eazi_niche');
      if (savedNiche) setNiche(savedNiche);

      const savedDuration = localStorage.getItem('eazi_duration');
      if (savedDuration) setDuration(savedDuration);

      const savedFramework = localStorage.getItem('eazi_selected_framework');
      if (savedFramework) setSelectedFramework(savedFramework);

      const savedOptionalContext = localStorage.getItem('eazi_optional_context');
      if (savedOptionalContext) setOptionalContext(savedOptionalContext);

      const savedTopic = localStorage.getItem('eazi_topic');
      if (savedTopic) setTopic(savedTopic);
    }
  }, []);

  // Persistence Save effects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_project_name', projectName);
    }
  }, [projectName]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_active_ratio', activeRatio);
    }
  }, [activeRatio]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_video_style', videoStyle);
    }
  }, [videoStyle]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_niche', niche);
    }
  }, [niche]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_duration', duration);
    }
  }, [duration]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_selected_framework', selectedFramework);
    }
  }, [selectedFramework]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_optional_context', optionalContext);
    }
  }, [optionalContext]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eazi_topic', topic);
    }
  }, [topic]);

  // Auth stats loading
  useEffect(() => {
    const fetchUserAndStats = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUserMetadata(session.user.user_metadata);
        setYoutubeConnected(true);

        let providerToken = session.provider_token;

        if (typeof window !== 'undefined' && window.location.hash.includes('provider_token')) {
          const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
          const hashToken = hashParams.get('provider_token');
          if (hashToken) {
            providerToken = hashToken;
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }

        if (providerToken) {
          localStorage.setItem('youtube_provider_token', providerToken);
        } else {
          providerToken = localStorage.getItem('youtube_provider_token');
        }

        if (providerToken) {
          try {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`, {
              headers: { Authorization: `Bearer ${providerToken}` }
            });
            const data = await res.json();

            if (data.error) {
              setYoutubeError(data.error.message || "Unknown API Error");
              setSubCount("0");
              setViewCount("0");
            } else if (data.items && data.items.length > 0) {
              const channel = data.items[0];
              const stats = channel.statistics;
              const snippet = channel.snippet;

              setChannelData({
                title: snippet.title,
                avatar: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
                customUrl: snippet.customUrl
              });

              const formatNumber = (num: string) => {
                const n = parseInt(num);
                if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
                if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
                return num.toString();
              };

              setSubCount(formatNumber(stats.subscriberCount || "0"));
              setViewCount(formatNumber(stats.viewCount || "0"));
            }
          } catch (e) {
            console.error("Failed to fetch youtube stats", e);
          }
        }
      }
    };
    fetchUserAndStats();
  }, []);

  // Track mount state and detect desktop viewport
  useEffect(() => {
    setMounted(true);
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  // Resize Mouse Move Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercentage = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      if (newPercentage >= 25 && newPercentage <= 75) {
        setLeftWidth(newPercentage);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const videoStyles = [
    { id: "doodle", name: "Doodle / Whiteboard", icon: "🖍️" },
    { id: "2d-cartoon", name: "2D Cartoon", icon: "🎨" },
    { id: "2d-cinematic", name: "2D Cinematic (Anime/Ghibli)", icon: "🌸" },
    { id: "3d-pixar", name: "3D Stylized (Pixar)", icon: "🧸" },
    { id: "3d-realistic", name: "3D Realistic (Cinematic CGI)", icon: "🏙️" },
    { id: "live-action", name: "Live Action Realistic", icon: "📷" },
    { id: "historical", name: "Historical / Ancient", icon: "🕰️" },
    { id: "fantasy", name: "Fantasy / Sci-Fi Concept Art", icon: "🌌" },
    { id: "retro", name: "Retro / Pixel Art", icon: "👾" },
    { id: "abstract", name: "Abstract / Artistic", icon: "✨" },
  ];

  const frameworkOptions = [
    { id: "stoic_explainer", name: "Stoic / Educational Explainer", desc: "Best for philosophy, daily guides, self-improvement" },
    { id: "narrative_documentary", name: "Narrative Documentary", desc: "Best for historical deep dives, biography, events" },
    { id: "viral_listicle", name: "Viral Listicle / Compilation", desc: "Best for high-traffic list countdowns" },
    { id: "case_study_breakdown", name: "Case Study / Breakdown", desc: "Best for business, marketing, analytical breakdowns" },
    { id: "shortform_hook_loop", name: "Short-Form Hook Loop", desc: "Best for high-retention TikToks and Shorts under 60s" },
    { id: "first_person_narrative", name: "First-Person Narrative / Essay", desc: "Best for personal stories, confessionals, testimony" },
    { id: "mythology_fable", name: "Mythology / Fable Narrative", desc: "Best for folklore, moral tales, biblical retellings" },
    { id: "contrarian_debunking", name: "Contrarian Debunking", desc: "Best for myth-busting, schema-violating reframes" },
    { id: "interactive_quiz", name: "Interactive Quiz / Q&A", desc: "Best for trivia, self-assessment, high-engagement" },
    { id: "comparative_showdown", name: "Comparative Showdown (Versus)", desc: "Best for head-to-head concept or figure comparisons" },
  ];

  const isFormValid = () => {
    if (!projectName.trim()) return false;
    if (!niche || !duration || !videoStyle || !selectedFramework) return false;
    
    if (activeTab === 'topic' && !topic.trim()) return false;
    if (activeTab === 'remix' && selectedVideos.length === 0) return false;
    
    return true;
  };

  // Paste URL handler
  const handleAddPasteUrl = async () => {
    if (!pasteUrl.trim()) return;
    const videoId = extractVideoId(pasteUrl.trim());
    if (!videoId) {
      showToast("Invalid YouTube URL.", "error");
      return;
    }
    if (selectedVideos.some(v => v.id === videoId)) {
      showToast("Video already added to Remix queue.", "warning");
      return;
    }
    if (selectedVideos.length >= 5) {
      showToast("Maximum of 5 videos allowed.", "warning");
      return;
    }

    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(pasteUrl.trim())}&format=json`);
      if (!res.ok) {
        // Fallback details if public oembed returns error
        const fallbackVideo = {
          id: videoId,
          title: `YouTube Video (${videoId})`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          channelTitle: "YouTube Creator",
          url: pasteUrl.trim()
        };
        const updated = [...selectedVideos, fallbackVideo];
        setSelectedVideos(updated);
        localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
        setPasteUrl("");
        return;
      }
      const data = await res.json();
      const newVideo = {
        id: videoId,
        title: data.title,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: data.author_name,
        url: pasteUrl.trim()
      };
      const updated = [...selectedVideos, newVideo];
      setSelectedVideos(updated);
      localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
      setPasteUrl("");
    } catch (e) {
      console.warn("Failed to fetch YouTube oEmbed metadata, falling back to direct video details:", e);
      const fallbackVideo = {
        id: videoId,
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: "YouTube Creator",
        url: pasteUrl.trim()
      };
      const updated = [...selectedVideos, fallbackVideo];
      setSelectedVideos(updated);
      localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
      setPasteUrl("");
    }
  };

  // Search Results addition handler
  const handleAddSearchedVideo = (video: any) => {
    if (selectedVideos.length >= 5) {
      showToast("Maximum of 5 videos allowed.", "warning");
      return;
    }
    const videoId = video.id.videoId;
    if (selectedVideos.some(v => v.id === videoId)) return;

    const newVideo = {
      id: videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      channelTitle: video.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
    const updated = [...selectedVideos, newVideo];
    setSelectedVideos(updated);
    localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
  };

  // Remove video handler
  const handleRemoveVideo = (id: string) => {
    const updated = selectedVideos.filter(v => v.id !== id);
    setSelectedVideos(updated);
    localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
  };

  const executeSearchWithQuery = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) return;
    setIsSearchingYoutube(true);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(queryToSearch)}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.items) {
        setYoutubeSearchResults(data.items);
      }
    } catch (e) {
      console.error("YouTube search request failed", e);
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  // Search YouTube handler
  const handleSearchYoutube = async () => {
    await executeSearchWithQuery(youtubeSearchQuery);
  };

  const handleAction = async () => {
    if (!isFormValid()) return;
    setIsGenerating(true);
    setGenerationResults(null);
    setOpenSection(null);
    setProgress(5);
    setOutlineError(null);

    // Dynamic Progress speed simulation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        const remaining = 90 - prev;
        const step = Math.max(1, Math.floor(remaining * 0.15));
        return prev + step;
      });
    }, 450);

    try {
      let dataResult = null;
      if (activeTab === 'autopilot') {
        const topicString = optionalContext.trim() || `Generate an engaging concept based on the selected settings in ${niche}`;
        const res = await fetch('/api/ai/ideate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topicString, niche, duration, videoStyle, framework: selectedFramework }),
          cache: 'no-store'
        });
        const data = await res.json();
        dataResult = data.result;
      } else if (activeTab === 'topic') {
        const res = await fetch('/api/ai/ideate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, niche, duration, videoStyle, framework: selectedFramework }),
          cache: 'no-store'
        });
        const data = await res.json();
        dataResult = data.result;
      } else if (activeTab === 'remix') {
        // Only hit YouTube API for videos that don't have a manual or cached transcript already
        const videosToFetch = selectedVideos.filter(v => !v.manualTranscript && !v.transcript);
        let fetchResults: any[] = [];

        if (videosToFetch.length > 0) {
          const urls = videosToFetch.map(v => v.url);
          const res = await fetch('/api/youtube/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls }),
            cache: 'no-store'
          });
          const data = await res.json();
          fetchResults = data.results || [];

          // Save newly fetched transcripts into selectedVideos state & localStorage
          const updatedSelectedVideos = selectedVideos.map(v => {
            const match = fetchResults.find((item: any) => item.url === v.url);
            if (match && match.status === 'success' && match.text) {
              return { ...v, transcript: match.text, hasError: false, fetchError: null };
            }
            return v;
          });
          setSelectedVideos(updatedSelectedVideos);
          localStorage.setItem('eazi_selected_videos', JSON.stringify(updatedSelectedVideos));
        }

        const sources = selectedVideos.map(video => {
          const text = video.manualTranscript || video.transcript || "";
          const match = fetchResults.find((item: any) => item.url === video.url);
          return {
            title: video.title,
            url: video.url,
            transcript: text || (match?.status === 'success' ? match.text : "")
          };
        }).filter(item => !!item.transcript);

        const failedVideos = selectedVideos.filter(video => {
          if (video.manualTranscript || video.transcript) return false;
          const match = fetchResults.find((item: any) => item.url === video.url);
          return !match || match.status !== 'success';
        });

        if (failedVideos.length > 0) {
          const updatedVideos = selectedVideos.map(v => {
            if (v.manualTranscript || v.transcript) return v;
            const match = fetchResults.find((item: any) => item.url === v.url);
            if (!match || match.status !== 'success') {
              return { ...v, hasError: true, fetchError: match?.error || "YouTube transcription extraction was blocked by anti-bot checks." };
            }
            return v;
          });
          setSelectedVideos(updatedVideos);
          localStorage.setItem('eazi_selected_videos', JSON.stringify(updatedVideos));
          
          showToast(`YouTube blocked fetching transcripts for ${failedVideos.length} video(s). Please paste them manually in the red-bordered cards.`, "error");
          setIsGenerating(false);
          return;
        }

        if (sources.length > 0) {
          const remixRes = await fetch('/api/ai/remix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: projectName !== 'New Video Project' ? projectName : `Remix of: ${selectedVideos.map(v => v.title).join(", ")}`,
              niche,
              duration,
              videoStyle,
              framework: selectedFramework,
              sources
            }),
            cache: 'no-store'
          });
          const remixData = await remixRes.json();
          dataResult = remixData.result;
        }
      }

      if (dataResult) {
        setGenerationResults(dataResult);
        localStorage.setItem('eazi_generation_results', JSON.stringify(dataResult));

        // Populate outline cache with this default outline under the first title candidate
        const firstTitle = dataResult.titleCandidates?.[0]?.title || projectName;
        const initialCacheEntry = {
          hookCandidates: dataResult.hookCandidates,
          outline: dataResult.outline,
          ctaPlan: dataResult.ctaPlan
        };
        const newCache = { [firstTitle]: initialCacheEntry };
        setOutlineCache(newCache);
        localStorage.setItem('eazi_outline_cache', JSON.stringify(newCache));
      }
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsGenerating(false);
      }, 500);
    }
  };

  const handleSelectTitleCandidate = async (title: string) => {
    setProjectName(title);
    localStorage.setItem('eazi_project_name', title);
    if (!generationResults) return;

    // Check localStorage / React state cache first!
    if (outlineCache[title]) {
      setGenerationResults((prev: any) => ({
        ...prev,
        hookCandidates: outlineCache[title].hookCandidates,
        outline: outlineCache[title].outline,
        ctaPlan: outlineCache[title].ctaPlan
      }));
      setOutlineError(null);
      return;
    }

    // Cache miss: execute dynamic API fetch
    setIsOutlineGenerating(true);
    setOutlineError(null);
    setProgress(10);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        const remaining = 90 - prev;
        const step = Math.max(1, Math.floor(remaining * 0.15));
        return prev + step;
      });
    }, 400);

    try {
      const res = await fetch('/api/ai/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `Generate hooks and script outline structure specifically for the title: "${title}"`,
          niche,
          duration,
          videoStyle,
          framework: selectedFramework
        }),
        cache: 'no-store'
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("GitHub API rate limit reached. Retaining current outline brief structure.");
        } else {
          throw new Error("Failed to customize outline for this title candidate. Retaining current outline brief.");
        }
      }

      const data = await res.json();
      if (data.result) {
        const newEntry = {
          hookCandidates: data.result.hookCandidates,
          outline: data.result.outline,
          ctaPlan: data.result.ctaPlan
        };
        
        // Update Cache state and localStorage
        const updatedCache = { ...outlineCache, [title]: newEntry };
        setOutlineCache(updatedCache);
        localStorage.setItem('eazi_outline_cache', JSON.stringify(updatedCache));

        // Update UI Results
        setGenerationResults((prev: any) => ({
          ...prev,
          ...newEntry
        }));
      }
    } catch (e: any) {
      console.error("Failed to generate custom outline for title", e);
      setOutlineError(e.message || "Could not generate title-specific brief outline.");
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsOutlineGenerating(false);
      }, 500);
    }
  };

  const handleSelectTitleAndSave = async () => {
    if (!projectName.trim()) return;
    setIsSavingBrief(true);
    setProgress(10);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + 5;
      });
    }, 150);
    try {
      const bodyPayload: any = {
        title: projectName,
        niche,
        brief: {
          version: "1.0",
          framework: selectedFramework,
          niche,
          duration,
          videoStyle,
          targetAudience: "Retention-optimized video viewers",
          coreThesis: topic || optionalContext || projectName,
          angle: "AI outline brief",
          titleCandidates: generationResults?.titleCandidates || [{ title: projectName, score: 95 }],
          hookCandidates: generationResults?.hookCandidates || [],
          outline: generationResults?.outline || [],
          ctaPlan: generationResults?.ctaPlan || {},
          sourceSummaries: generationResults?.sourceSummaries || []
        }
      };

      if (editingProjectId) {
        bodyPayload.id = editingProjectId;
      }

      const res = await fetch('/api/projects', {
        method: editingProjectId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (data.success) {
        // Invalidate the dashboard project cache so it refetches on next visit
        localStorage.removeItem('eazi_projects_cache');
        // Clear workspace persistence cache
        localStorage.removeItem('eazi_generation_results');
        localStorage.removeItem('eazi_outline_cache');
        localStorage.removeItem('eazi_project_name');
        localStorage.removeItem('eazi_topic');
        localStorage.removeItem('eazi_optional_context');
        localStorage.removeItem('eazi_selected_videos');
        // Update editing ID if this was a fresh save
        if (!editingProjectId && data.project?.id) {
          setEditingProjectId(data.project.id);
          // Update URL without full navigation so the page stays
          window.history.replaceState({}, '', `/dashboard/ideation?id=${data.project.id}`);
        }
        if (data.project?.status) {
          setProjectStatus(data.project.status);
        }
        // Reset snapshot to current state so button disables until next change
        setSavedSnapshot(JSON.stringify({
          title: projectName,
          niche,
          brief: JSON.stringify({
            ...bodyPayload.brief,
            duration: duration || ""
          })
        }));
        // Show success via top-level toast notification
        showToast("Brief saved successfully! Continue editing or generate the full script whenever you're ready.", "success");
      }
    } catch (e) {
      console.error("Project save failed", e);
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsSavingBrief(false);
      }, 400);
    }
  };

  const handleGenerateFullScript = async () => {
    if (!projectName.trim()) return;
    setIsGeneratingScript(true);
    setProgress(5);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        const remaining = 90 - prev;
        const step = Math.max(1, Math.floor(remaining * 0.12));
        return prev + step;
      });
    }, 450);
    try {
      const bodyPayload: any = {
        title: projectName,
        niche,
        brief: {
          version: "1.0",
          framework: selectedFramework,
          niche,
          duration,
          videoStyle,
          targetAudience: "Retention-optimized video viewers",
          coreThesis: topic || optionalContext || projectName,
          angle: "AI outline brief",
          titleCandidates: generationResults?.titleCandidates || [{ title: projectName, score: 95 }],
          hookCandidates: generationResults?.hookCandidates || [],
          outline: generationResults?.outline || [],
          ctaPlan: generationResults?.ctaPlan || {},
          sourceSummaries: generationResults?.sourceSummaries || []
        }
      };

      if (editingProjectId) {
        bodyPayload.id = editingProjectId;
      }

      const projectRes = await fetch('/api/projects', {
        method: editingProjectId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const projectData = await projectRes.json();
      if (!projectData.success || !projectData.project?.id) return;

      const projectId = projectData.project.id;

      const scriptRes = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, regenerate: true })
      });
      const scriptData = await scriptRes.json();
      if (scriptData.success) {
        localStorage.removeItem('eazi_generation_results');
        localStorage.removeItem('eazi_outline_cache');
        localStorage.removeItem('eazi_project_name');
        localStorage.removeItem('eazi_topic');
        localStorage.removeItem('eazi_optional_context');
        localStorage.removeItem('eazi_selected_videos');
        router.push(`/dashboard/script/${projectId}`);
      } else {
        console.error("Script generation returned error:", scriptData.error);
      }
    } catch (e) {
      console.error("Script generation failed", e);
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsGeneratingScript(false);
      }, 500);
    }
  };

  return (
    <div className="w-full min-h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-white pb-20 px-4 md:px-0">
      
      {/* Top Nanobar Progress Loader */}
      {progress > 0 && (
        <div 
          className="fixed top-0 left-0 h-1 bg-[#E00C1D] z-50 transition-all duration-300 ease-out shadow-[0_1px_10px_#E00C1D]" 
          style={{ width: `${progress}%` }} 
        />
      )}

      {/* Workspace Stepper */}
      <PipelineStepper projectId={editingProjectId || undefined} projectStatus={projectStatus} />

      {/* Editable Project Title Header Row */}
      <div className="flex flex-col gap-2 mt-2 pb-4 border-b border-white/5">
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">PROJECT WORKSPACE</span>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={projectName} 
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Untitled Video Project..." 
            className="bg-transparent border-0 border-b border-dashed border-white/10 hover:border-white/30 focus:border-[#E00C1D] outline-none text-3xl font-bold tracking-tight text-white focus:ring-0 w-full pl-0 pb-1.5 transition-colors"
          />
        </div>
        <p className="text-xs text-gray-400">Edit the project title above, or click a scored title candidate on the right to apply it.</p>
      </div>

      {/* Main Resizable Split Workspace container */}
      <div 
        ref={containerRef}
        className="w-full flex flex-col md:flex-row gap-0 border border-white/5 rounded-3xl bg-white/[0.01] overflow-hidden select-none"
      >

        {/* LEFT COLUMN: Settings / Inputs */}
        <div
          style={{ width: mounted && isDesktop ? `${leftWidth}%` : undefined }}
          className="flex flex-col p-6 border-t md:border-t-0 md:border-l border-white/5 bg-black/10"
        >
          {/* Three Selection Tabs */}
          <div className="bg-white/[0.03] p-1.5 rounded-xl border border-white/5 flex gap-1 shadow-md mb-5">
            <button
              onClick={() => setActiveTab("autopilot")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'autopilot' ? 'bg-[#E00C1D] text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              AI Autopilot
            </button>
            <button
              onClick={() => setActiveTab("topic")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'topic' ? 'bg-[#E00C1D] text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Analyze My Topic
            </button>
            <button
              onClick={() => setActiveTab("remix")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'remix' ? 'bg-[#E00C1D] text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Remix YouTube
            </button>
          </div>

          {/* Settings Grid Panel */}
          <div className="bg-white/[0.03] p-5 rounded-xl border border-white/5 flex flex-col gap-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#E00C1D]/5 rounded-full blur-2xl pointer-events-none" />

            {/* Dynamic Inputs Based on Active Tab */}
            {activeTab === 'autopilot' && (
              <div className="flex flex-col gap-2 animate-fade-in">
                <label className="text-xs font-semibold text-gray-300 ml-0.5">Optional Steering Context</label>
                <textarea
                  className="w-full bg-black/40 border border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D]/10 rounded-lg p-3 min-h-[90px] text-xs text-white focus:outline-none resize-none transition-all placeholder:text-gray-655"
                  placeholder="Enter optional keywords, topics, or themes..."
                  value={optionalContext}
                  onChange={(e) => setOptionalContext(e.target.value)}
                />
              </div>
            )}

            {activeTab === 'topic' && (
              <div className="flex flex-col gap-2 animate-fade-in">
                <div className="flex justify-between items-center ml-0.5">
                  <label className="text-xs font-semibold text-gray-300">Describe Your Video Topic</label>
                  <span className="text-[9px] bg-red-500/10 text-[#E00C1D] border border-red-500/20 px-1.5 py-0.5 rounded font-mono font-bold">REQUIRED</span>
                </div>
                <textarea
                  className="w-full bg-black/40 border border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D]/10 rounded-lg p-3 min-h-[90px] text-xs text-white focus:outline-none resize-none transition-all placeholder:text-gray-655"
                  placeholder="What is this video about?..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            )}

            {activeTab === 'remix' && (
              <div className="flex flex-col gap-3.5 animate-fade-in">
                
                {/* Visual Cards Queue */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center ml-0.5">
                    <label className="text-xs font-semibold text-gray-300">Reference Videos Queue</label>
                    <span className="text-[9px] bg-red-500/10 text-[#E00C1D] border border-red-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {selectedVideos.length} / 5 SELECTED
                    </span>
                  </div>

                  {selectedVideos.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-0.5">
                      {selectedVideos.map((video) => {
                        const isExpanded = expandedVideoTranscriptId === video.id;
                        return (
                          <div 
                            key={video.id} 
                            className={`flex flex-col gap-2 bg-black/55 border rounded-xl p-2.5 transition-all ${
                              video.hasError 
                                ? 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)] bg-red-500/[0.02]' 
                                : video.manualTranscript 
                                  ? 'border-green-500/30' 
                                  : 'border-white/5 hover:border-[#E00C1D]/30'
                            }`}
                          >
                            <div className="flex gap-3 items-center justify-between group relative overflow-hidden">
                              <div className="flex items-center gap-3 min-w-0">
                                <img src={video.thumbnail} className="w-14 h-9 object-cover rounded bg-white/5 shrink-0 border border-white/5" alt="" />
                                <div className="min-w-0 font-sans">
                                  <h4 className="text-[11px] font-semibold text-gray-100 truncate pr-4" title={video.title}>{video.title}</h4>
                                  <p className="text-[9px] text-gray-400 truncate">{video.channelTitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setExpandedVideoTranscriptId(isExpanded ? null : video.id)}
                                  title="Add/Edit Transcript Manually"
                                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                    video.manualTranscript 
                                      ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20' 
                                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleRemoveVideo(video.id)}
                                  className="text-gray-500 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Fetch Error Flag */}
                            {video.hasError && (
                              <div className="text-[9px] text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-1.5 rounded-lg mt-0.5 leading-relaxed font-sans select-text">
                                ⚠️ Eazi Studio was blocked from downloading this transcript. Please click the page icon on the right to paste it manually.
                              </div>
                            )}

                            {/* Inline Manual Transcript Area */}
                            {isExpanded && (
                              <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-2 animate-fade-in">
                                <label className="text-[9px] font-semibold text-gray-400 font-sans">Manual Transcript Editor</label>
                                <textarea
                                  className="w-full bg-black/60 border border-white/10 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D]/10 rounded-lg p-2 min-h-[90px] text-[10px] text-white focus:outline-none resize-y placeholder:text-gray-655 font-mono leading-relaxed"
                                  placeholder="Paste the YouTube transcript text here..."
                                  value={tempTranscripts[video.id] ?? video.manualTranscript ?? ""}
                                  onChange={(e) => setTempTranscripts(prev => ({ ...prev, [video.id]: e.target.value }))}
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = tempTranscripts[video.id] || "";
                                      const updated = selectedVideos.map(v => {
                                        if (v.id === video.id) {
                                          return { ...v, manualTranscript: text.trim() || undefined, hasError: false, fetchError: undefined };
                                        }
                                        return v;
                                      });
                                      setSelectedVideos(updated);
                                      localStorage.setItem('eazi_selected_videos', JSON.stringify(updated));
                                      setExpandedVideoTranscriptId(null);
                                      showToast("Transcript saved!", "success", 1500);
                                    }}
                                    className="px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white font-bold rounded text-[10px] cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedVideoTranscriptId(null)}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-white/5 rounded-xl p-6 text-center text-xs text-gray-500 bg-black/20">
                      No reference videos selected yet. Paste reference links below to queue them.
                    </div>
                  )}
                </div>

                <div className="h-px w-full bg-white/5" />

                {/* Paste URL Input Section */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-gray-400 ml-0.5">Add Video via Paste Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 bg-black/40 border border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D]/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-gray-655"
                      placeholder="Paste YouTube Link (e.g. watch?v=...)"
                      value={pasteUrl}
                      onChange={(e) => setPasteUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPasteUrl()}
                    />
                    <button 
                      onClick={handleAddPasteUrl}
                      className="px-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Search YouTube Trigger Button commented out for now
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[11px] font-semibold text-gray-400 ml-0.5">Find Reference Videos</label>
                  <button
                    type="button"
                    onClick={() => {
                      setYoutubeSearchResults([]);
                      setYoutubeSearchQuery("");
                      setIsSearchModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white/5 hover:bg-white/10 hover:border-white/20 border border-white/5 text-white font-semibold rounded-lg transition-all text-xs cursor-pointer shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5 text-[#E00C1D]" />
                    <span>Search YouTube Reference Library</span>
                  </button>
                </div>
                */}
              </div>
            )}

            <div className="h-px w-full bg-white/5" />

            {/* Core Settings Grid - dynamic grid wraps cleanly */}
            <div className="grid grid-cols-1 gap-3.5">

              <Select
                label="Video Niche"
                value={niche}
                onChange={setNiche}
                placeholder="Select niche"
                options={[
                  { value: "Motivation & Mindset", label: "Motivation & Mindset" },
                  { value: "Business & Finance", label: "Business & Finance" },
                  { value: "History & Mythology", label: "History & Mythology" },
                  { value: "Faith & Spirituality", label: "Faith & Spirituality" },
                  { value: "Tech & AI", label: "Tech & AI" },
                  { value: "True Crime & Mysteries", label: "True Crime & Mysteries" },
                  { value: "Health & Fitness", label: "Health & Fitness" },
                  { value: "Gaming & Esports", label: "Gaming & Esports" },
                  { value: "Travel & Lifestyle", label: "Travel & Lifestyle" },
                  { value: "Other / General", label: "Other / General" },
                ]}
              />

              <Select
                label="Video Duration"
                value={duration}
                onChange={setDuration}
                placeholder="Select duration"
                options={[
                  { value: "Under 1 minute (Shorts)", label: "Under 1 min (Shorts)" },
                  { value: "3-5 minutes", label: "3-5 mins" },
                  { value: "8-10 minutes", label: "8-10 mins" },
                  { value: "10-20 minutes", label: "10-20 mins (Deep)" },
                  { value: "20+ minutes", label: "20+ mins" },
                ]}
              />

              <Select
                label="Video Style"
                value={videoStyle}
                onChange={setVideoStyle}
                placeholder="Select style"
                options={videoStyles.map((style) => ({
                  value: style.id,
                  label: `${style.icon} ${style.name}`,
                }))}
              />

              <Select
                label="Script Framework"
                value={selectedFramework}
                onChange={setSelectedFramework}
                options={frameworkOptions.map((f) => ({
                  value: f.id,
                  label: f.name,
                  description: f.desc,
                }))}
              />

              {/* Integrated Aspect Ratio Row */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 ml-0.5">Video Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveRatio("16:9")}
                    className={`flex-1 py-3 px-2 rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer text-xs ${activeRatio === '16:9' ? 'border-[#E00C1D] bg-[#E00C1D]/10 text-red-300 font-semibold shadow-inner' : 'border-white/5 bg-black/40 text-gray-400 hover:border-red-500/20'}`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Landscape (16:9)</span>
                  </button>
                  <button
                    onClick={() => setActiveRatio("9:16")}
                    className={`flex-1 py-3 px-2 rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer text-xs ${activeRatio === '9:16' ? 'border-[#E00C1D] bg-[#E00C1D]/10 text-red-300 font-semibold shadow-inner' : 'border-white/5 bg-black/40 text-gray-400 hover:border-red-500/20'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Vertical (9:16)</span>
                  </button>
                </div>
              </div>

            </div>

            <button
              onClick={handleAction}
              disabled={isGenerating || !isFormValid()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-semibold rounded-lg transition-all text-sm mt-1 shadow-md shadow-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden cursor-pointer"
            >
              {isGenerating && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Synthesizing Outline Brief...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Brainstorm outline brief</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* MIDDLE: DRAGGABLE RESIZER BAR (only visible on desktop) */}
        <div
          onMouseDown={handleMouseDown}
          className={`hidden md:block w-1.5 cursor-col-resize hover:bg-[#E00C1D]/50 active:bg-[#E00C1D] transition-colors self-stretch border-l border-r border-white/5 ${isDragging ? 'bg-[#E00C1D]' : 'bg-white/5'}`}
        />

        {/* RIGHT COLUMN: Results / Empty State Placeholder */}
        <div
          style={{ width: mounted && isDesktop ? `${100 - leftWidth}%` : undefined }}
          className="flex flex-col p-6 min-h-[550px] overflow-y-auto"
        >
          {isGenerating ? (
            // PREMIUM LOADING SKELETON / INTERACTIVE SPINNER
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-pulse">
              <div className="w-10 h-10 border-3 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-5" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Synthesizing Outline Brief...</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-6">
                Our AI is searching live YouTube data, analyzing transcripts, and formulating CTR-optimized hooks and outlines.
              </p>
              <div className="w-full flex flex-col gap-3 max-w-md mt-2">
                <div className="h-12 bg-black/5 dark:bg-white/5 rounded-xl w-full" />
                <div className="h-12 bg-black/5 dark:bg-white/5 rounded-xl w-11/12" />
                <div className="h-12 bg-black/5 dark:bg-white/5 rounded-xl w-4/5" />
              </div>
            </div>
          ) : isProjectLoading ? (
            // SMOOTH LOADING SKELETON while existing project data is being fetched
            <div className="flex-1 flex flex-col gap-4 animate-pulse pt-2">
              <div className="h-5 bg-black/5 dark:bg-white/5 rounded-lg w-1/3" />
              <div className="h-28 bg-black/5 dark:bg-white/5 rounded-2xl w-full" />
              <div className="h-5 bg-black/5 dark:bg-white/5 rounded-lg w-1/2" />
              <div className="h-16 bg-black/5 dark:bg-white/5 rounded-2xl w-full" />
              <div className="h-16 bg-black/5 dark:bg-white/5 rounded-2xl w-full" />
              <div className="h-16 bg-black/5 dark:bg-white/5 rounded-2xl w-4/5" />
              <div className="h-5 bg-black/5 dark:bg-white/5 rounded-lg w-1/3 mt-2" />
              <div className="h-20 bg-black/5 dark:bg-white/5 rounded-2xl w-full" />
            </div>
          ) : generationResults ? (
            <div className="flex-1 flex flex-col gap-6 animate-fade-in">
              <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />

              {/* Reference Videos Summary and Key Points section — top-level accordion */}
              {generationResults.sourceSummaries && generationResults.sourceSummaries.length > 0 && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleSection("summaries")}
                    className="w-full flex items-center justify-between p-3.5 bg-black/45 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <FileText className="w-4.5 h-4.5 text-[#E00C1D]" />
                      <span>Reference Video Summaries &amp; Key Teachings</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openSection === "summaries" ? "rotate-180" : ""}`} />
                  </button>

                  {openSection === "summaries" && (
                    <div className="flex flex-col gap-3 animate-fade-in pl-1">
                      {generationResults.sourceSummaries.map((source: any, idx: number) => {
                        const isExpanded = openVideoIndex === idx;
                        return (
                          <div key={idx} className="flex flex-col bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
                            {/* Video Accordion Toggle */}
                            <button
                              onClick={() => toggleVideo(idx)}
                              className="w-full flex justify-between items-center p-4 hover:bg-white/[0.01] transition-all text-left cursor-pointer"
                            >
                              <div className="flex flex-col min-w-0 pr-4">
                                <span className="text-[9px] text-[#E00C1D] font-mono font-bold uppercase tracking-wider mb-1">
                                  VIDEO {idx + 1}
                                </span>
                                <h4 className="text-xs font-bold text-white line-clamp-1">{source.title}</h4>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {/* Video Accordion Content */}
                            {isExpanded && (
                              <div className="flex flex-col gap-3.5 p-5 pt-0 border-t border-white/5 animate-fade-in">
                                {source.summary && (
                                  <div className="text-xs text-gray-300 italic leading-relaxed pl-2.5 border-l-2 border-[#E00C1D]/40 py-0.5 mt-4">
                                    "{source.summary}"
                                  </div>
                                )}
                                {source.keyTeachings && source.keyTeachings.length > 0 && (
                                  <div className="mt-2 flex flex-col gap-3.5">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono border-b border-dashed border-white/5 pb-1">
                                      {source.keyTeachingsTitle || "Key Teachings"}
                                    </span>
                                    <div className="flex flex-col gap-4">
                                      {source.keyTeachings.map((teaching: any, tIdx: number) => (
                                        <div key={tIdx} className="flex flex-col gap-1.5 pl-1.5">
                                          <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-[#E00C1D]/10 border border-[#E00C1D]/20 flex items-center justify-center text-[10px] font-bold font-mono text-[#E00C1D]">
                                              {tIdx + 1}
                                            </span>
                                            <span className="text-xs font-bold text-white tracking-wide">{teaching.topic}</span>
                                          </div>
                                          {teaching.description && (
                                            <p className="text-xs text-gray-400 leading-relaxed pl-7">{teaching.description}</p>
                                          )}
                                          {teaching.actionableAdvice && (
                                            <div className="ml-7 mt-1 p-3 rounded-xl bg-red-500/[0.02] border border-red-500/10 text-xs text-gray-300 leading-relaxed flex flex-col gap-1">
                                              <span className="text-[9px] font-bold text-[#E00C1D] font-mono uppercase tracking-wider">💡 Actionable Advice</span>
                                              <span className="text-gray-300">{teaching.actionableAdvice}</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {source.conclusion && (
                                  <div className="mt-2.5 p-3.5 bg-white/[0.01] border border-white/5 rounded-xl text-xs flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-gray-500 font-mono uppercase tracking-wider">Conclusion / Warning</span>
                                    <p className="text-gray-400 leading-relaxed italic">{source.conclusion}</p>
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

              {/* Titles section */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => toggleSection("titles")}
                  className="w-full flex items-center justify-between p-3.5 bg-black/45 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Award className="w-4.5 h-4.5 text-[#E00C1D]" />
                    <span>Scored Title Candidates</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openSection === 'titles' ? 'rotate-180' : ''}`} />
                </button>
                
                {openSection === 'titles' && (
                  <div className="flex flex-col gap-2.5 animate-fade-in">
                    {generationResults.titleCandidates?.map((item: any, i: number) => {
                      const isSelected = projectName === item.title;
                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            if (isOutlineGenerating || isGenerating) return;
                            handleSelectTitleCandidate(item.title);
                          }}
                          className={`p-3 border rounded-xl text-sm font-medium transition-all flex justify-between items-center group ${
                            isSelected 
                              ? 'border-[#E00C1D] bg-[#E00C1D]/5 shadow-[0_0_12px_rgba(224,12,29,0.1)] text-white' 
                              : isOutlineGenerating || isGenerating 
                                ? 'border-white/5 bg-black/40 opacity-50 cursor-not-allowed' 
                                : 'border-white/5 bg-black/40 hover:border-[#E00C1D]/50 hover:bg-white/[0.01] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`text-[10px] px-2 py-0.5 border rounded-md font-mono font-bold ${
                              isSelected 
                                ? 'bg-[#E00C1D] text-white border-[#E00C1D]' 
                                : 'bg-[#E00C1D]/15 text-[#E00C1D] border-[#E00C1D]/30'
                            }`}>
                              {item.score}% CTR
                            </span>
                            <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-200'}`}>{item.title}</span>
                          </div>
                          {!isSelected && (
                            <button 
                              disabled={isOutlineGenerating || isGenerating}
                              className="text-xs px-2.5 py-1 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:opacity-40"
                            >
                              Apply Title
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {outlineError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2.5 animate-fade-in">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>{outlineError}</span>
                </div>
              )}

              {isOutlineGenerating ? (
                // SKELETON LOADER FOR DYNAMIC OUTLINE CUSTOMIZATION
                <div className="p-6 bg-black/25 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center py-12 animate-pulse mt-4">
                  <div className="w-8 h-8 border-2 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-4" />
                  <h4 className="text-sm font-bold text-white mb-1">Tailoring Outlines & Hooks...</h4>
                  <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                    Customizing the script timeline and retention hooks to match your chosen title angle.
                  </p>
                </div>
              ) : (
                <>
                  {/* Hooks section */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => toggleSection("hooks")}
                      className="w-full flex items-center justify-between p-3.5 bg-black/45 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Eye className="w-4.5 h-4.5 text-[#E00C1D]" />
                        <span>Hook Scenarios</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openSection === 'hooks' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {openSection === 'hooks' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fade-in">
                        {generationResults.hookCandidates?.map((hook: any, i: number) => (
                          <div key={i} className="p-3.5 bg-black/40 border border-white/5 rounded-xl text-sm text-gray-300 leading-relaxed flex flex-col justify-between h-full">
                            <div>
                              <span className="font-bold text-[#E00C1D] block mb-1.5 uppercase text-[10px] tracking-wider font-mono">
                                {hook.type?.replace(/_/g, ' ')}
                              </span>
                              <p className="italic font-medium text-white text-sm">"{hook.text}"</p>
                            </div>
                            {hook.onScreenText && (
                              <div className="mt-3 pt-2 border-t border-white/5 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-mono">Caption Visual</span>
                                <span className="text-xs text-red-300 font-mono italic">"{hook.onScreenText}"</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Script Outline Accordion */}
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => toggleSection("outline")}
                      className="w-full flex items-center justify-between p-3.5 bg-black/45 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.01] transition-all text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <FileText className="w-4.5 h-4.5 text-[#E00C1D]" />
                        <span>Script Outline Details (Timeline)</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openSection === 'outline' ? 'rotate-180' : ''}`} />
                    </button>

                    {openSection === 'outline' && (
                      <div className="flex flex-col gap-5 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-white/5 ml-1.5 mt-2 animate-fade-in">
                        {generationResults.outline?.map((section: any, i: number) => (
                          <div key={i} className="relative pl-7">
                            <div className="absolute left-[10px] top-1.5 w-2 h-2 rounded-full bg-[#E00C1D] border-2 border-[#121214] ring-2 ring-red-500/10" />
                            
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-md font-mono uppercase tracking-wider">
                                {section.section} {section.beatType ? `| ${section.beatType}` : ''}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                ~{section.estimatedSeconds}s
                              </span>
                            </div>

                            <h4 className="font-bold text-white text-base mb-1">{section.title}</h4>
                            <p className="text-sm text-gray-300 leading-relaxed mb-2">{section.summary}</p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              {section.keyAnalogy && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 font-mono">
                                  💡 Metaphor: {section.keyAnalogy}
                                </span>
                              )}
                              
                              {section.visualCue && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-red-300 bg-[#E00C1D]/5 px-2 py-1 rounded border border-[#E00C1D]/10 font-mono">
                                  🎨 Scene Direction: {section.visualCue}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="h-px w-full bg-white/5" />

                  {/* CTA plan section */}
                  {generationResults.ctaPlan && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-mono">Spoken CTA Line</span>
                      <p className="text-sm text-gray-300 italic p-3 bg-black/40 border border-white/5 rounded-xl">
                        "{generationResults.ctaPlan.scriptLine}"
                      </p>
                    </div>
                  )}

                  {/* Final creation triggers */}
                  {(() => {
                    const currentSnapshot = JSON.stringify({
                      title: projectName,
                      niche,
                      brief: JSON.stringify({
                        framework: selectedFramework,
                        niche,
                        titleCandidates: generationResults?.titleCandidates || [],
                        hookCandidates: generationResults?.hookCandidates || [],
                        outline: generationResults?.outline || [],
                        ctaPlan: generationResults?.ctaPlan || {},
                        sourceSummaries: generationResults?.sourceSummaries || []
                      })
                    });
                    const hasUnsavedChanges = !editingProjectId || savedSnapshot === null || currentSnapshot !== savedSnapshot;
                    return (
                      <>
                        <div className="flex flex-col sm:flex-row gap-3.5 mt-1">
                          {/* Save Brief — stays visually static; only the top loader moves */}
                          <button
                            onClick={handleSelectTitleAndSave}
                            disabled={isGenerating || isSavingBrief || isGeneratingScript || !hasUnsavedChanges}
                            title={!hasUnsavedChanges ? "No changes to save" : "Save this brief to your project"}
                            className={`flex-1 py-3.5 font-bold rounded-xl border transition-all flex items-center justify-center gap-2 text-sm ${
                              hasUnsavedChanges && !isGenerating && !isSavingBrief && !isGeneratingScript
                                ? "bg-white/5 hover:bg-white/10 text-white border-white/10 cursor-pointer"
                                : "bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed opacity-50"
                            }`}
                          >
                            <CheckCircle2 className={`w-4 h-4 ${hasUnsavedChanges ? "text-green-500" : "text-gray-600"}`} />
                            <span>Select &amp; Save Brief</span>
                          </button>

                          {/* Generate full script */}
                          <button
                            onClick={handleGenerateFullScript}
                            disabled={isGenerating || isSavingBrief || isGeneratingScript}
                            className="flex-1 py-3.5 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-sm disabled:opacity-40"
                          >
                            <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            <span>Generate full script</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          ) : (
            // EMPTY STATE PLACEHOLDER
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
              <div className="w-16 h-16 bg-red-500/10 border border-[#E00C1D]/20 rounded-2xl flex items-center justify-center mb-6 text-[#E00C1D]">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No ideation brief generated yet</h3>
              <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-6">
                Choose your brainstorming options in the settings panel on the left, then hit the red button to generate titles, hooks, and timelines.
              </p>
              <div className="flex flex-col gap-2.5 max-w-xs w-full text-left">
                <div className="flex items-start gap-2.5 text-xs text-gray-500">
                  <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0 font-mono text-gray-300">1</span>
                  <span>Select **AI Autopilot**, **Analyze My Topic**, or **Remix YouTube**</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-gray-500">
                  <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0 font-mono text-gray-300">2</span>
                  <span>Fill in Niche, Video Style, and Scripting Framework</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-gray-500">
                  <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0 font-mono text-gray-300">3</span>
                  <span>Click **Brainstorm outline brief** to fetch results here</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* YouTube Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop Click Close */}
          <div className="absolute inset-0" onClick={() => setIsSearchModalOpen(false)} />
          
          <div className="relative bg-[#121214] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col gap-4 animate-scale-up">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#E00C1D]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-center pb-3 border-b border-white/5 z-10">
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#E00C1D]" /> Search YouTube References
                </h3>
                <span className="text-[10px] text-gray-500 mt-0.5">Select up to 5 reference videos ({selectedVideos.length} selected)</span>
              </div>
              <button 
                onClick={() => setIsSearchModalOpen(false)}
                className="text-gray-400 hover:text-white text-sm font-semibold p-1 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative flex gap-2 z-20">
              <div className="relative flex-1">
                <input 
                  type="text"
                  autoFocus
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Small timeout to allow click actions on suggestions list to fire first
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="w-full bg-black/40 border border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D]/10 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none placeholder:text-gray-655"
                  placeholder="Enter keywords, niches, topic..."
                  value={youtubeSearchQuery}
                  onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchYoutube()}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                {/* Autocomplete suggestions dropdown list */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1e] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden max-h-[180px] overflow-y-auto">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setYoutubeSearchQuery(s);
                          setShowSuggestions(false);
                          executeSearchWithQuery(s);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#E00C1D]/10 hover:text-white text-gray-300 font-medium transition-colors border-b border-white/[0.02]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button 
                disabled={isSearchingYoutube}
                onClick={handleSearchYoutube}
                className="px-4 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                {isSearchingYoutube ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results Window */}
            <div className="flex-1 min-h-[250px] max-h-[350px] overflow-y-auto pr-1 z-10">
              {isSearchingYoutube ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-7 h-7 border-2 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-xs text-gray-400">Searching YouTube API...</span>
                </div>
              ) : youtubeSearchResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {youtubeSearchResults.map((video) => {
                    const isAdded = selectedVideos.some(v => v.id === video.id.videoId);
                    const cleanViews = video.statistics?.viewCount 
                      ? parseInt(video.statistics.viewCount) >= 1000000 
                        ? (parseInt(video.statistics.viewCount) / 1000000).toFixed(1) + 'M'
                        : parseInt(video.statistics.viewCount) >= 1000
                          ? (parseInt(video.statistics.viewCount) / 1000).toFixed(0) + 'K'
                          : video.statistics.viewCount
                      : "0";
                    const thumbnailSrc = video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || `https://img.youtube.com/vi/${video.id.videoId}/mqdefault.jpg`;
                    return (
                      <div key={video.id.videoId} className="flex gap-3 items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={thumbnailSrc} className="w-14 h-9 object-cover rounded bg-white/5 shrink-0 border border-white/5" alt="" />
                          <div className="min-w-0">
                            <h5 className="text-xs font-semibold text-gray-200 truncate pr-2" title={video.snippet?.title}>{video.snippet?.title}</h5>
                            <p className="text-[10px] text-gray-400 truncate">{video.snippet?.channelTitle} • {cleanViews} views</p>
                          </div>
                        </div>
                        <button 
                          disabled={isAdded || selectedVideos.length >= 5}
                          onClick={() => handleAddSearchedVideo(video)}
                          className={`text-xs font-bold px-3 py-1 rounded transition-all cursor-pointer ${
                            isAdded 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-[#E00C1D] hover:bg-[#b0060f] text-white'
                          }`}
                        >
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-500 text-xs">
                  {youtubeSearchQuery ? "No videos found for this query." : "Type keywords above and click search to find references."}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/5 flex justify-between items-center z-10">
              <span className="text-[11px] text-gray-400 font-medium">
                {selectedVideos.length} of 5 selected
              </span>
              <button 
                onClick={() => setIsSearchModalOpen(false)}
                className="px-4 py-2 bg-[#E00C1D] hover:bg-[#b0060f] text-white font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-sm"
              >
                Close & Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function IdeationPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#E00C1D]"></div>
      </div>
    }>
      <IdeationPageContent />
    </Suspense>
  );
}

