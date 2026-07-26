"use client";

import { useState, useEffect } from "react";
import { Sparkles, Save, User, Check, RefreshCw, Layers, Target, Mic } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/context/ToastContext";

function YoutubeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Hinglish", label: "Hinglish" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
];

export default function ChannelProfilePage() {
  const { showToast } = useToast();

  const [handle, setHandle] = useState("");
  const [channelTitle, setChannelTitle] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelAvatar, setChannelAvatar] = useState("");
  const [niche, setNiche] = useState("");
  const [audienceAvatar, setAudienceAvatar] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [language, setLanguage] = useState("English");

  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  const sanitizeHandle = (val: string) => {
    if (!val.trim()) return "";
    let clean = val.trim().replace(/^https?:\/\/(www\.)?youtube\.com\/(c\/|user\/|channel\/|@)?/i, '').replace(/\/.*$/, '').trim();
    if (!clean) return "";
    return clean.startsWith('@') ? clean : `@${clean}`;
  };

  // Derive active avatar image URL from stored avatar or handle fallback
  const activeHandle = sanitizeHandle(handle);
  const displayAvatarUrl = channelAvatar || (activeHandle ? `https://unavatar.io/youtube/${activeHandle}` : "");

  // Fetch current channel profile on load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/channel-profile");
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            if (data.profile.youtubeHandle) setHandle(data.profile.youtubeHandle);
            if (data.profile.channelTitle) setChannelTitle(data.profile.channelTitle);
            if (data.profile.channelDescription) setChannelDescription(data.profile.channelDescription);
            if (data.profile.channelAvatar) setChannelAvatar(data.profile.channelAvatar);
            if (data.profile.niche) setNiche(data.profile.niche);
            if (data.profile.audienceAvatar) setAudienceAvatar(data.profile.audienceAvatar);
            if (data.profile.toneOfVoice) setToneOfVoice(data.profile.toneOfVoice);
            if (Array.isArray(data.profile.topCompetitorChannels)) {
              setCompetitors(data.profile.topCompetitorChannels.join(", "));
            }
            if (data.profile.contentLanguage) setLanguage(data.profile.contentLanguage);
          }
        }
      } catch (err) {
        console.error("Failed to load channel profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleAutoDetect = async () => {
    const paddedHandle = sanitizeHandle(handle);
    if (!paddedHandle && !channelDescription.trim()) {
      const msg = "Please enter a YouTube handle (e.g. @channel or channel name) or paste your channel bio first.";
      setErrorMsg(msg);
      showToast(msg, "warning");
      return;
    }

    if (paddedHandle) setHandle(paddedHandle);
    setIsDetecting(true);
    setErrorMsg("");
    setImgLoadFailed(false);
    showToast("Analyzing channel metadata with AI...", "info");

    try {
      const res = await fetch("/api/user/channel-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoDetect: true,
          youtubeHandle: paddedHandle || handle,
          channelTitle,
          channelDescription,
          channelAvatar,
          niche,
          audienceAvatar,
          toneOfVoice,
          topCompetitorChannels: competitors ? competitors.split(",").map(s => s.trim()) : [],
          contentLanguage: language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          if (data.profile.channelTitle) setChannelTitle(data.profile.channelTitle);
          if (data.profile.channelDescription) setChannelDescription(data.profile.channelDescription);
          if (data.profile.channelAvatar) setChannelAvatar(data.profile.channelAvatar);
          if (data.profile.youtubeHandle) setHandle(data.profile.youtubeHandle);
          if (data.profile.niche) setNiche(data.profile.niche);
          if (data.profile.audienceAvatar) setAudienceAvatar(data.profile.audienceAvatar);
          if (data.profile.toneOfVoice) setToneOfVoice(data.profile.toneOfVoice);
          if (Array.isArray(data.profile.topCompetitorChannels)) {
            setCompetitors(data.profile.topCompetitorChannels.join(", "));
          }
        }
        showToast("Channel profile auto-detected successfully!", "success");
      } else {
        const errData = await res.json();
        const msg = errData.error || "Auto-detection failed.";
        setErrorMsg(msg);
        showToast(msg, "error");
      }
    } catch (err: any) {
      console.error("Auto detect error:", err);
      const msg = err.message || "Failed to auto-detect channel profile.";
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSaveProfile = async () => {
    const paddedHandle = sanitizeHandle(handle);
    if (paddedHandle) setHandle(paddedHandle);

    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMsg("");
    showToast("Saving creator profile settings...", "info");

    try {
      const res = await fetch("/api/user/channel-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoDetect: false,
          youtubeHandle: paddedHandle || handle,
          channelTitle,
          channelDescription,
          channelAvatar: channelAvatar || (paddedHandle ? `https://unavatar.io/youtube/${paddedHandle}` : ""),
          niche,
          audienceAvatar,
          toneOfVoice,
          topCompetitorChannels: competitors.split(",").map(s => s.trim()).filter(Boolean),
          contentLanguage: language,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        showToast("Channel & persona profile saved successfully!", "success");
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errData = await res.json();
        const msg = errData.error || "Failed to save profile.";
        setErrorMsg(msg);
        showToast(msg, "error");
      }
    } catch (err: any) {
      console.error("Save profile error:", err);
      const msg = err.message || "Failed to save profile.";
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 animate-pulse text-gray-900 dark:text-white">
        <div className="w-10 h-10 border-3 border-[#E00C1D] border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-sm font-bold">Loading Creator Profile...</h3>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in text-gray-900 dark:text-white pb-20 px-4 md:px-0 relative">
      {/* Top Animated Progress Bar */}
      {(isSaving || isDetecting) && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#E00C1D] via-red-400 to-[#E00C1D] animate-pulse w-full transition-all duration-300" />
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/5">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">CREATOR SETTINGS / CHANNEL PROFILE</span>
          <h1 className="text-xl font-bold tracking-tight mt-0.5 flex items-center gap-2 text-gray-900 dark:text-white">
            <YoutubeIcon className="w-6 h-6 text-[#E00C1D]" />
            <span>Channel & Persona Profile</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Configure your channel's persona, target viewer avatar, and niche settings to automatically customize every generated script.
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving || isDetecting}
          className="px-5 py-2.5 text-xs font-semibold bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl transition-all shadow-md shadow-red-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 text-white animate-spin" />
              <span>Saving Profile...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-green-300" />
              <span>Saved Profile!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 dark:text-red-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Channel Header Avatar Card */}
      {(channelTitle || handle || displayAvatarUrl) && (
        <div className="bg-gradient-to-r from-[#E00C1D]/10 via-black/5 dark:via-black/40 to-transparent border border-black/10 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4 animate-fade-in shadow-xs">
          {displayAvatarUrl && !imgLoadFailed ? (
            <img
              src={displayAvatarUrl}
              referrerPolicy="no-referrer"
              alt={channelTitle || "Channel Avatar"}
              onError={() => setImgLoadFailed(true)}
              className="w-14 h-14 rounded-full border-2 border-[#E00C1D]/40 object-cover shrink-0 shadow-lg bg-black"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#E00C1D]/20 border border-[#E00C1D]/40 flex items-center justify-center text-[#E00C1D] shrink-0 font-bold text-lg">
              {(channelTitle || handle || "C").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{channelTitle || "Connected Channel"}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{handle || "No handle provided"}</p>
            {niche && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#E00C1D] uppercase tracking-wider font-mono">
                ● {niche}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: YouTube Import & Channel Bio */}
        <div className="lg:col-span-1 flex flex-col gap-5 bg-white dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-2xl p-5 relative overflow-hidden shadow-xs dark:shadow-none">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-[40px] pointer-events-none" />

          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-mono">
            <YoutubeIcon className="w-4 h-4 text-[#E00C1D]" />
            <span>YouTube Import</span>
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">YouTube Channel Handle or Name</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onBlur={() => {
                const padded = sanitizeHandle(handle);
                if (padded) setHandle(padded);
              }}
              placeholder="e.g. techunlocked or @techunlocked"
              className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 focus:ring-1 focus:ring-[#E00C1D]/30 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          <button
            onClick={handleAutoDetect}
            disabled={isDetecting || isSaving}
            className="w-full py-2.5 px-4 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-900 dark:text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="w-4 h-4 text-[#E00C1D] animate-spin" />
                <span>AI Analyzing Channel...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#E00C1D]" />
                <span>Auto-Detect Profile via AI</span>
              </>
            )}
          </button>

          <div className="border-t border-black/5 dark:border-white/5 pt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Channel Title</label>
              <input
                type="text"
                value={channelTitle}
                onChange={(e) => setChannelTitle(e.target.value)}
                placeholder="My Tech Studio"
                className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Channel Bio / Description</label>
              <textarea
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="Paste your YouTube channel description here..."
                rows={4}
                className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 resize-none overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/10 dark:[&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E00C1D]/50 dark:[&::-webkit-scrollbar-thumb]:bg-[#E00C1D]/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#E00C1D]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Persona, Avatar, Tone Settings */}
        <div className="lg:col-span-2 flex flex-col gap-5 bg-white dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-2xl p-5 shadow-xs dark:shadow-none">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-mono">
            <User className="w-4 h-4 text-[#E00C1D]" />
            <span>Niche & Persona Configuration</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#E00C1D]" />
                <span>Primary Channel Niche</span>
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Tech & AI Explainers, Stoic Self-Improvement"
                className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#E00C1D]" />
                <span>Content Language</span>
              </label>
              <Select
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
                placeholder="Select Language"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#E00C1D]" />
              <span>Target Viewer Avatar</span>
            </label>
            <input
              type="text"
              value={audienceAvatar}
              onChange={(e) => setAudienceAvatar(e.target.value)}
              placeholder="e.g. Beginner YouTubers under 1k subs looking to write better scripts"
              className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
            <span className="text-[10px] text-gray-500">
              Describe who watches your channel so the AI can calibrate script complexity.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E00C1D]" />
              <span>Tone & Voice Register</span>
            </label>
            <input
              type="text"
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              placeholder="e.g. Warm, direct, relatable, conversational"
              className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Top Competitor / Role Model Channels (Comma-separated)
            </label>
            <input
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="e.g. Isaacverse, Ali Abdaal, Johnny Harris"
              className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#E00C1D]/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving || isDetecting}
              className="w-full py-3 px-4 bg-[#E00C1D] hover:bg-[#b0060f] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-red-950/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  <span>Saving Creator Profile...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-green-300" />
                  <span>Channel Profile Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Creator Profile</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
