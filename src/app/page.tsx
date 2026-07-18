"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useTransform, useScroll, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  ChevronRight, ChevronDown, Sparkles, Video, PenTool, Volume2,
  Image as ImageIcon, Tag, Archive, Puzzle, CheckCircle2,
  ArrowRight, ShieldCheck, Zap
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { FlipWords } from "@/components/ui/flip-words";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";
import { cn } from "@/utils/cn";

export default function Home() {
  const words = ["Profitable", "Viral", "Engaging", "Faceless", "Cinematic", "Premium"];
  const [activeTab, setActiveTab] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);

  const navItems = [
    { label: "Showcase", href: "#showcase" },
    { label: "Features", href: "#features" },
    { label: "Extension", href: "#extension" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace("#", "");
    const element = document.getElementById(id);
    if (element) {
      const offset = 120; // Beautiful gap above section header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScrollEvent = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScrollEvent);
    return () => window.removeEventListener("scroll", handleScrollEvent);
  }, []);

  const geminiRef = useRef(null);
  const { scrollYProgress: geminiScrollProgress } = useScroll({
    target: geminiRef,
    offset: ["start start", "end end"],
  });

  const geminiPathLengthFirst = useTransform(geminiScrollProgress, [0, 0.7], [0.2, 1.2]);
  const geminiPathLengthSecond = useTransform(geminiScrollProgress, [0, 0.7], [0.15, 1.2]);
  const geminiPathLengthThird = useTransform(geminiScrollProgress, [0, 0.7], [0.1, 1.2]);
  const geminiPathLengthFourth = useTransform(geminiScrollProgress, [0, 0.7], [0.05, 1.2]);
  const geminiPathLengthFifth = useTransform(geminiScrollProgress, [0, 0.7], [0, 1.2]);

  const pipelineTabs = [
    {
      tabName: "Ideation",
      title: "AI Video Ideation",
      description: "Stuck on what video to create next? Eazi Studio automatically brainstorms high-performing topic ideas, generates viral hook suggestions, and structures outlines tailored specifically for your target niche. Explore different storytelling structures like Stoic Philosophy, Drama, Listicle, and Informational to captivate your audience from the very first second.",
      image: "/assets/ideation.png",
      icon: <Sparkles className="w-4 h-4" />,
      urlPath: "/dashboard/ideation"
    },
    {
      tabName: "Scripting",
      title: "Faceless Scripting",
      description: "Write and fine-tune attention-grabbing video scripts. Choose a framework, enter your topic parameters, and generate high-retention narration text. Use the real-time editor to iterate on individual sections, ensure perfect flow, and maintain consistent storytelling voice throughout the entire video pipeline.",
      image: "/assets/scripting.png",
      icon: <PenTool className="w-4 h-4" />,
      urlPath: "/dashboard/script/cmrl82s59000r3"
    },
    {
      tabName: "Audio Transcript",
      title: "Audio & Timestamp Alignment",
      description: "Upload your voiceover or audio file. Eazi Studio transcribes it automatically, creating precise word-level and sentence-level timestamp alignments. These markers segment your script into chronological scenes, forming the foundation of your automated visual storyboard.",
      image: "/assets/audio-transcript.png",
      icon: <Volume2 className="w-4 h-4" />,
      urlPath: "/dashboard/audio-transcript/cmrl82s59000r3"
    },
    {
      tabName: "AI Storyboard",
      title: "Automation Storyboard Rendering",
      description: "Link your Eazi Studio dashboard directly to Google FX Flow via our secure, local Chrome Extension. The extension automates rendering in the background, generating cinematic video frames corresponding to each script segment. You get professional-grade, custom-tailored storyboard illustrations absolutely free.",
      image: "/assets/storyboard.png",
      icon: <ImageIcon className="w-4 h-4" />,
      urlPath: "/dashboard/storyboard-images/cmrl82s59000r3"
    },
    {
      tabName: "Publishing",
      title: "Metadata Packaging & Publishing",
      description: "Generate psychological-angle titles, SEO descriptions with embedded timestamps, and tags. Optimize your thumbnail using Concept Variance presets, and download the entire compiled ZIP package with scripts, voiceovers, thumbnails, and visual assets ready for upload.",
      image: "/assets/publish.png",
      icon: <Tag className="w-4 h-4" />,
      urlPath: "/dashboard/publish/cmrl82s59000r3"
    }
  ];

  const landingFaqs = [
    {
      q: "Is Eazi Studio really 100% free?",
      a: "Yes! During our open public beta, Eazi Studio is completely free. You get full access to unlimited ideation, script writing, sentence syncing, and storyboard rendering without any credit card requirements or hidden subscription fees."
    },
    {
      q: "Why do I need a Chrome Extension?",
      a: "Google provides cloud rendering APIs (like Vertex AI Imagen), but they carry heavy commercial usage fees. Eazi Studio's Chrome Extension acts as a secure local bridge, automating storyboard rendering inside your free web tab so you can generate unlimited visual sequences completely free of API charges."
    },
    {
      q: "Do I need my own OpenAI or Gemini API keys?",
      a: "No API keys are required. All video outlines, hook variations, and script editing tools work out-of-the-box on our servers with zero configuration or cost."
    },
    {
      q: "Is the Chrome Extension safe to run?",
      a: "Yes, 100%. The Chrome Extension is sandboxed inside your local browser. It only communicates with your Eazi Studio dashboard tab and Google FX Flow, and does not monitor your personal browsing history, passwords, or files."
    },
    {
      q: "What files do I get in my project export?",
      a: "When you export a finished project, Eazi Studio compiles your assets into a structured ZIP package containing:\n\n• Rendered Storyboard Images: High-quality visual scenes matching each script segment.\n• Finalized Script: Your complete narrative text and metadata.\n• Voiceover Audio: Synthesized narration audio synchronized to your scenes.\n• Timeline Metadata: Precise word-level synchronization markers ready to import into your editor."
    },
    {
      q: "Which desktop web browsers are supported?",
      a: "The Eazi Studio Automator is compatible with all desktop Chromium-based browsers, including Google Chrome, Microsoft Edge, Brave, and Opera."
    },
    {
      q: "Can I use Eazi Studio on my mobile phone?",
      a: "You can write scripts, generate ideas, and manage your dashboard on mobile. However, you will need a desktop browser to run the Chrome Extension automator for storyboard rendering."
    },
    {
      q: "Can I import pre-recorded voiceovers?",
      a: "Yes! You can upload your own pre-recorded voiceover audio files. Eazi Studio will automatically transcribe them and sync scene-level timestamps to align your storyboards."
    },
    {
      q: "Where is my project data stored?",
      a: "Your projects are stored securely on our cloud servers. The local Chrome Extension does not transmit any dashboard data externally; it only coordinates actions inside your active browser tabs."
    }
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 font-sans selection:bg-[#E00C1D]/30 selection:text-white pb-16 relative w-full overflow-x-clip" style={{ overflowX: 'clip' }}>

      {/* Background Grids & Ambient Glows wrapped in overflow-hidden container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2a2a3a_1px,transparent_1px),linear-gradient(to_bottom,#2a2a3a_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.08]" />

        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70%] max-w-200 h-96 bg-gradient-to-b from-[#E00C1D] to-transparent opacity-20 rounded-b-full blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-96 h-96 bg-red-600 opacity-5 rounded-full blur-[120px]" />

        {/* Background Beams */}
        <BackgroundBeams className="h-[50rem] md:h-[60rem] opacity-35" />
      </div>

      {/* Sticky Transparent Header with Aceternity Hover Navigation */}
      <header className={cn(
        "sticky top-0 z-50 w-full py-4 px-6 md:px-12 flex items-center justify-between transition-all duration-300 border-b",
        isScrolled 
          ? "border-white/[0.04] bg-[#070709]/80 backdrop-blur-md" 
          : "border-transparent bg-transparent backdrop-blur-none"
      )}>
        <div className="flex items-center">
          <Link href="/">
            <Logo variant="image" imgClassName="h-8 md:h-12" />
          </Link>
        </div>
        
        {/* Center Navigation Links (Aceternity style) */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-full p-1.5 relative">
          {navItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              onClick={(e) => handleScroll(e, item.href)}
              className="relative px-4 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors duration-300 rounded-full cursor-pointer"
              onMouseEnter={() => setHoveredNavIndex(idx)}
              onMouseLeave={() => setHoveredNavIndex(null)}
            >
              <span className="relative z-10">{item.label}</span>
              {hoveredNavIndex === idx && (
                <motion.span
                  layoutId="hover-nav-pill"
                  className="absolute inset-0 bg-white/[0.04] border border-white/[0.08] rounded-full z-0"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <Link href="/login" className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/login?mode=signup" className="group cursor-pointer">
            <HoverBorderGradient
              containerClassName="rounded-xl cursor-pointer"
              className="bg-[#E00C1D] hover:bg-[#b0060f] text-white text-xs font-bold px-4 py-2.5 rounded-[inherit] cursor-pointer"
            >
              Start Free
            </HoverBorderGradient>
          </Link>
        </div>
      </header>

      {/* Hero Section + 3D Container Scroll Showcase */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-4 flex flex-col items-center">

        {/* Aceternity ContainerScroll wraps both Hero Title and Mockup Frame */}
        <ContainerScroll
          titleComponent={
            <div className="max-w-5xl mx-auto mb-0 mt-20">
              <h1 className="text-[32px] sm:text-[44px] md:text-[52px] lg:text-[58px] font-black tracking-tight leading-[1.1] text-white mb-6 max-w-4xl mx-auto">
                Start generating <FlipWords words={words} className="text-[#E00C1D] px-0 inline-block font-black" /> AI videos on autopilot completely free today.
              </h1>

              <p className="text-base sm:text-lg md:text-[18px] font-normal text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
                The ultimate all-in-one platform for YouTube automation. 100% free with no pricing plans and no credit cards required. Go from a single idea to high-converting scripts, audio timestamps, storyboards, thumbnails, and SEO packages in minutes.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login?mode=signup" className="w-full sm:w-auto">
                  <HoverBorderGradient
                    containerClassName="rounded-xl w-full sm:w-auto"
                    className="w-full sm:w-auto px-8 py-4 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-sm font-bold rounded-[inherit] flex items-center justify-center gap-1.5"
                  >
                    Create Your First Project
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </HoverBorderGradient>
                </Link>

                <Link
                  href="/extension"
                  className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Puzzle className="w-4 h-4 text-red-500" />
                  Get Chrome Extension
                </Link>
              </div>
            </div>
          }
        >
          {(progress) => {
            const yDark = useTransform(progress, [0, 0.45, 0.8, 1], ["0%", "0%", "-20%", "-20%"]);
            const yLight = useTransform(progress, [0, 0.45, 0.8, 1], ["120%", "120%", "0%", "0%"]);
            return (
              <div className="relative w-full h-full bg-zinc-950 rounded-[inherit] overflow-hidden">
                <motion.img
                  src="/assets/dark-dashboard.png"
                  alt="Eazi Studio Creator Dashboard Dark"
                  className="absolute inset-0 w-full h-full object-contain object-top rounded-[inherit]"
                  style={{ y: yDark }}
                  draggable={false}
                />
                <motion.img
                  src="/assets/light-dashboard.png"
                  alt="Eazi Studio Creator Dashboard Light"
                  className="absolute inset-0 w-full h-full object-contain object-top rounded-[inherit]"
                  style={{ y: yLight }}
                  draggable={false}
                />
              </div>
            );
          }}
        </ContainerScroll>
      </section>

      {/* Feature Showcase via Interactive Tabbed Workspace */}
      <section id="showcase" className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center mb-12 flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">All-In-One Production Suite</h2>
          <p className="text-xs text-gray-400 max-w-md leading-relaxed">
            Explore the automated video creation pipeline. Switch tabs to see how each workspace runs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-start lg:justify-center gap-2 border-b border-white/5 pb-6 overflow-x-auto no-scrollbar max-w-3xl mx-auto mb-16 px-2 relative">
          {pipelineTabs.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer z-10 text-gray-400 hover:text-white"
              >
                {isActive && (
                  <motion.span
                    layoutId="active-tab-pill"
                    className="absolute inset-0 bg-red-500/10 border border-red-500/30 rounded-full -z-10 shadow-lg shadow-red-500/5"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={isActive ? "text-red-500" : ""}>{tab.icon}</span>
                <span className={isActive ? "text-red-500" : ""}>{tab.tabName}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Panel */}
        <div className="min-h-[420px] max-w-6xl mx-auto">
          <motion.div
            key={activeTab}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
          >
            {/* Left Content Column */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
              }}
              className="lg:col-span-4 text-left flex flex-col justify-center"
            >
              <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full uppercase tracking-wider w-fit mb-4">
                Step 0{activeTab + 1}
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white mb-4">
                {pipelineTabs[activeTab].title}
              </h3>
              <p className="text-xs md:text-[13px] text-gray-400 leading-relaxed mb-6">
                {pipelineTabs[activeTab].description}
              </p>
              
              <div className="flex items-center gap-3">
                <Link href="/login?mode=signup">
                  <HoverBorderGradient
                    containerClassName="rounded-xl"
                    className="px-5 py-3 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-xs font-bold rounded-[inherit] flex items-center gap-1 cursor-pointer"
                  >
                    Try This Workspace
                    <ChevronRight className="w-3.5 h-3.5" />
                  </HoverBorderGradient>
                </Link>
              </div>
            </motion.div>

            {/* Right Mockup Preview Column */}
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.95, x: 20 },
                visible: { opacity: 1, scale: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
              }}
              className="lg:col-span-8"
            >
              <div className="relative border border-white/10 bg-[#0d0d12]/90 rounded-2xl shadow-2xl p-2 md:p-3 overflow-hidden">
                {/* Browser Controls */}
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <div className="bg-white/5 border border-white/5 text-[9px] text-gray-500 font-mono px-6 py-0.5 rounded-md w-full max-w-[280px] text-center truncate">
                    https://eazi-studio.com{pipelineTabs[activeTab].urlPath}
                  </div>
                  <div className="w-10" />
                </div>
                {/* Image Screenshot Frame */}
                <div className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-[#070709] flex items-center justify-center">
                  <img
                    src={pipelineTabs[activeTab].image}
                    alt={pipelineTabs[activeTab].title}
                    className="w-full h-full object-contain hover:scale-[1.01] transition-transform duration-500"
                    draggable={false}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24 border-t border-white/5">
        <div className="text-center mb-16 flex flex-col items-center">
          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Features
          </span>
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3">Designed for Channel Creators</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md leading-relaxed">
            Eazi Studio packs high-retention features to accelerate Explainer and Faceless video production.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Card 1: Concept Variance Styling (Span 2) */}
          <div className="md:col-span-2 bg-[#0c0c0e]/60 border border-white/5 rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-white/10 transition-colors">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Concept Variance Styling</h3>
              <p className="text-xs text-gray-400 max-w-md leading-relaxed mb-8">
                Instantly style your automated storyboards. Swap between Doodle, Anime, 3D Pixar, CGI, Sci-Fi, or Retro presets to maintain a coherent aesthetic across your entire channel feed.
              </p>
            </div>
            
            {/* Visual Preset Tags Float */}
            <div className="flex flex-wrap gap-2.5 pt-4">
              <span className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 shadow-lg shadow-red-950/20">
                🌸 Anime / Ghibli
              </span>
              <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-gray-300">
                🧸 3D Pixar Style
              </span>
              <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-gray-300">
                🏙️ Cinematic CGI
              </span>
              <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-gray-300">
                🖍️ Doodle Whiteboard
              </span>
              <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-gray-300">
                🌌 Sci-Fi Concept Art
              </span>
              <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-gray-300">
                👾 Retro Pixel Art
              </span>
            </div>
          </div>

          {/* Card 2: Chromium native (Span 1) */}
          <div className="bg-[#0c0c0e]/60 border border-white/5 rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-white/10 transition-colors">
            <div className="absolute top-0 right-0 w-60 h-60 bg-red-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
                <Puzzle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Chromium Native</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Compatible with any desktop browser. Install on Google Chrome, Brave, Edge, or Opera in minutes.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-black/40 border border-white/5 rounded-2xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bridge Status</span>
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] font-bold text-green-400">🟢 COMPATIBLE</span>
            </div>
          </div>

          {/* Card 3: 100% Private Sandbox (Span 1) */}
          <div className="bg-[#0c0c0e]/60 border border-white/5 rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-white/10 transition-colors">
            <div className="absolute top-0 right-0 w-60 h-60 bg-red-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Private Sandbox</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Your prompt queues are executed locally inside your browser sandbox. Your data remains fully secure.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-gray-300 font-medium">Local host bridge active</span>
            </div>
          </div>

          {/* Card 4: Precision Word-Level Sync (Span 2) */}
          <div className="md:col-span-2 bg-[#0c0c0e]/60 border border-white/5 rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-white/10 transition-colors">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Word-Level Timestamp Syncing</h3>
              <p className="text-xs text-gray-400 max-w-md leading-relaxed mb-8">
                Eazi Studio automatically transcribes your voiceover, aligning each sentence to precise millisecond intervals. Storyboard scenes are mapped directly to timestamps, resulting in flawless pacing.
              </p>
            </div>

            {/* Waveform visual simulation */}
            <div className="flex items-end gap-1.5 h-12 pt-2 max-w-md">
              <div className="w-full h-[20%] bg-red-500/20 rounded-full" />
              <div className="w-full h-[40%] bg-red-500/30 rounded-full" />
              <div className="w-full h-[80%] bg-[#E00C1D] rounded-full shadow-[0_0_10px_rgba(224,12,29,0.3)] animate-pulse" />
              <div className="w-full h-[50%] bg-[#E00C1D] rounded-full shadow-[0_0_10px_rgba(224,12,29,0.3)]" />
              <div className="w-full h-[95%] bg-[#E00C1D] rounded-full shadow-[0_0_10px_rgba(224,12,29,0.3)] animate-pulse" />
              <div className="w-full h-[30%] bg-red-500/40 rounded-full" />
              <div className="w-full h-[60%] bg-red-500/20 rounded-full" />
              <div className="w-full h-[15%] bg-white/5 rounded-full" />
              <div className="w-full h-[45%] bg-white/5 rounded-full" />
              <div className="w-full h-[75%] bg-white/5 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Extension Automation Callout via Google Gemini Effect */}
      <section id="extension" className="relative z-10 w-full border-t border-white/5" ref={geminiRef}>
        <div className="h-[240vh] bg-black w-full relative pt-20">
          <GoogleGeminiEffect
            pathLengths={[
              geminiPathLengthFirst,
              geminiPathLengthSecond,
              geminiPathLengthThird,
              geminiPathLengthFourth,
              geminiPathLengthFifth,
            ]}
            title="No API Fees. Unlimited Storyboards."
            description="Google FX Flow provides state-of-the-art cinematic image generation for free, but it does not have a public API. Our Chrome Extension acts as a secure local bridge. It allows our dashboard to automate the rendering of storyboards in your browser tab completely free."
            buttonText="Download Chrome Extension"
            buttonHref="/extension"
          />
        </div>
      </section>

      {/* Footer, Pricing and CTA wrapper with solid background to scroll over and cover the sticky Gemini section */}
      <div className="mt-[-60vh] relative z-20 bg-[#070709] w-full pt-10 pb-16">
        
        {/* Pricing Section (Comparison Card) */}
        <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-b border-white/5">
          <div className="text-center mb-16 flex flex-col items-center">
            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
              Value Comparison
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-3">Why pay for credits?</h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md leading-relaxed">
              Compare Eazi Studio's open model against typical paid video generators.
            </p>
          </div>

          {/* Centered Comparison Card */}
          <div className="max-w-3xl mx-auto bg-[#0c0c0e]/80 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E00C1D]/30 to-transparent" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
              {/* Left Column: Eazi Studio */}
              <div className="p-8 relative bg-gradient-to-b from-red-500/[0.02] to-transparent text-left flex flex-col justify-between">
                <div className="absolute top-4 right-6 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Unlimited Free Beta
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Eazi Studio</h3>
                  <p className="text-[11px] text-gray-400 mb-6">Empowering creators with unlimited local automations.</p>
                  
                  <div className="flex items-baseline gap-1.5 mb-8">
                    <span className="text-4xl font-black text-white">$0</span>
                    <span className="text-xs text-gray-500 font-medium">/ forever free in beta</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-2.5 text-xs text-gray-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span><strong>Unlimited</strong> storyboards via Chrome Extension</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span><strong>Unlimited</strong> script generations & outlines</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span><strong>Full access</strong> to all workspaces & features</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span><strong>No credit card</strong> details requested</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <Link href="/login?mode=signup" className="w-full">
                    <HoverBorderGradient
                      containerClassName="rounded-xl w-full"
                      className="w-full px-4 py-3 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-xs font-bold rounded-[inherit] flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-red-500/10"
                    >
                      Create Free Account
                      <ChevronRight className="w-3.5 h-3.5" />
                    </HoverBorderGradient>
                  </Link>
                </div>
              </div>

              {/* Right Column: Other Paid Generators */}
              <div className="p-8 text-left bg-black/40 flex flex-col justify-between opacity-70 hover:opacity-90 transition-opacity">
                <div>
                  <h3 className="text-lg font-bold text-gray-300 mb-1">Other Paid Generators</h3>
                  <p className="text-[11px] text-gray-500 mb-6">Typical commercial cloud rendering tools.</p>
                  
                  <div className="flex items-baseline gap-1.5 mb-8">
                    <span className="text-4xl font-black text-gray-400">$30 - $90</span>
                    <span className="text-xs text-gray-600 font-medium">/ month</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-2.5 text-xs text-gray-400">
                      <span className="w-4.5 h-4.5 text-gray-600 font-bold text-center shrink-0">✕</span>
                      <span><strong>Strict rendering credits</strong> (charged per video)</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-400">
                      <span className="w-4.5 h-4.5 text-gray-600 font-bold text-center shrink-0">✕</span>
                      <span><strong>Limited script drafting</strong> or outline caps</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-400">
                      <span className="w-4.5 h-4.5 text-gray-600 font-bold text-center shrink-0">✕</span>
                      <span><strong>Feature locks</strong> (paywalls on basic tools)</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-400">
                      <span className="w-4.5 h-4.5 text-gray-600 font-bold text-center shrink-0">✕</span>
                      <span><strong>Auto-renewing</strong> subscription requirements</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <span className="block text-center text-[10px] text-gray-500 font-semibold py-3 border border-white/5 bg-white/[0.02] rounded-xl">
                    Saves you $300+/year
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="relative z-10 max-w-3xl mx-auto px-6 py-20 border-b border-white/5">
          <div className="text-center mb-16 flex flex-col items-center">
            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
              FAQ
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-3">Frequently Asked Questions</h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md leading-relaxed">
              Find answers to common questions about Eazi Studio, the Chrome Extension, and rendering storyboards.
            </p>
          </div>

          <div className="space-y-4">
            {landingFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index}
                  className="bg-[#0c0c0e]/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left text-sm md:text-base font-bold text-white hover:text-red-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-300", isOpen && "rotate-180 text-red-500")} />
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 text-xs md:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4 whitespace-pre-line">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Ready to automate your channel?</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
            Create premium explainer and faceless videos with viral scripts, timestamped storyboards, and custom thumbnails today.
          </p>
          <Link href="/login?mode=signup" className="inline-flex">
            <HoverBorderGradient
              containerClassName="rounded-xl"
              className="px-8 py-4 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-sm font-bold rounded-[inherit] flex items-center gap-1.5"
            >
              Get Started Now
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </HoverBorderGradient>
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 pt-12 max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo variant="image" imgClassName="h-8 opacity-50" />
          <span className="text-[10px] text-gray-500 font-medium">
            &copy; {new Date().getFullYear()} Eazi Studio. All rights reserved.
          </span>
          <div className="flex gap-6 text-[10px] font-semibold text-gray-400">
            <Link href="/extension" className="hover:text-white transition-colors">Extension Bridge</Link>
            <Link href="/login" className="hover:text-white transition-colors">Dashboard Login</Link>
            <Link href="/login?mode=signup" className="hover:text-white transition-colors">Register</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
