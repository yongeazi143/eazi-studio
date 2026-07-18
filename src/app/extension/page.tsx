"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Download, Puzzle, Sparkles, CheckCircle2, ArrowRight, 
  HelpCircle, Info, Lock, MonitorPlay, ChevronDown 
} from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function ExtensionPage() {
  const [downloading, setDownloading] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/extension/download");
      if (!response.ok) throw new Error("Network error during download");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "eazi-flow-automator.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to download extension package. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const steps = [
    {
      num: "01",
      title: "Download the Bridge ZIP",
      desc: "Click the main download button above to get the compiled extension package. Extract/unzip the file into a dedicated folder on your computer.",
      tip: "Remember where you unzip the folder, as you will need to select it in Chrome."
    },
    {
      num: "02",
      title: "Open Extension Settings",
      desc: "In Google Chrome, open a new tab and navigate to chrome://extensions/ (or click the three dots menu -> Extensions -> Manage Extensions).",
      tip: "You must run this on a desktop browser. Chrome extensions do not support mobile."
    },
    {
      num: "03",
      title: "Enable Developer Mode",
      desc: "In the top-right corner of the Extensions dashboard, toggle the switch for 'Developer mode' to the active (ON) position.",
      tip: "This enables the 'Load unpacked' button required for self-hosted extensions."
    },
    {
      num: "04",
      title: "Load the Unpacked Folder",
      desc: "Click the 'Load unpacked' button in the top-left corner. Navigate to and select the unzipped chrome-extension folder from your computer.",
      tip: "Select the folder that contains the manifest.json file, not the root zip folder itself."
    },
    {
      num: "05",
      title: "Authorize & Open Google FX",
      desc: "Open a new tab and go to labs.google/fx/tools/flow. Ensure you are signed in. The extension automates this tab in the background to render image storyboards.",
      tip: "Keep the Google Flow tab open. If you close it, the automation bridge will pause."
    }
  ];

  const faqs = [
    {
      q: "Why do I need this extension?",
      a: "Google FX Flow provides state-of-the-art cinematic image generation for free, but it does not have a public developer API. The EaziStudio Automator acts as a secure local bridge. It allows our dashboard to queue image prompts, automate their rendering in your open Google tab, and retrieve the finished images without requiring paid API credits."
    },
    {
      q: "Is it safe to use?",
      a: "Yes, 100%. The extension runs entirely in your local browser sandbox. It does not access or modify any personal data, passwords, or browsing history. It only interacts with labs.google/fx/tools/flow and your local Eazi Studio dashboard tab."
    },
    {
      q: "Why isn't it on the Chrome Web Store?",
      a: "Because this extension is a customized automation bridge built specifically for Eazi Studio creators, it uses Developer Mode to run locally. Self-hosting the extension avoids long Google review delays and gives you instant updates."
    },
    {
      q: "What should I do if the extension status shows 'Tab Missing'?",
      a: "Ensure you have an open browser tab at labs.google/fx/tools/flow and that the page is fully loaded. If it still shows 'Tab Missing', click the refresh icon next to the extension in your extension dashboard and refresh both the Google Flow tab and your Eazi Studio dashboard."
    }
  ];

  return (
    <div className="min-h-screen bg-[#060608] text-gray-100 font-sans selection:bg-[#E00C1D]/30 selection:text-white pb-24 relative overflow-hidden">
      {/* Background Grids & Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.07] pointer-events-none" />
      
      {/* Red Ambient Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#E00C1D] opacity-10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#ff6a3d] opacity-5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between py-6 px-6 xl:px-0">
        <Link href="/" className="flex items-center cursor-pointer">
          <Logo variant="image" imgClassName="h-10 md:h-14" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/login?mode=signup" className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-all">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Title Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 flex flex-col items-center text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/5 border border-red-500/15 text-xs font-semibold text-red-400 mb-6 backdrop-blur-md">
          <Puzzle className="w-3.5 h-3.5" /> EaziStudio Automator Bridge
        </div>

        <h1 className="text-[clamp(32px,4vw,56px)] font-black tracking-tight leading-[1.1] text-white mb-6 max-w-3xl">
          Supercharge Storyboard Generation with our <span className="bg-gradient-to-r from-red-500 via-[#ff6a3d] to-yellow-500 bg-clip-text text-transparent">Automation Extension</span>
        </h1>

        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mb-12 leading-relaxed">
          Google FX Flow produces beautiful cinematic video frames for free, but lacks an API. Install our local chrome extension to bridge Eazi Studio and Google Flow seamlessly.
        </p>

        {/* Main Action Download Box */}
        <div className="w-full max-w-3xl bg-gradient-to-b from-[#111116] to-[#0a0a0c] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl relative">
          <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
          
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-500 to-[#ff6a3d] flex items-center justify-center text-white shadow-xl shadow-red-950/20 mb-6">
              <Puzzle className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Download Bridge Package</h3>
            <p className="text-xs text-gray-400 max-w-md mb-8 leading-relaxed">
              Compatible with Google Chrome, Microsoft Edge, Brave, and other Chromium-based desktop browsers.
            </p>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-8 py-4 bg-gradient-to-r from-[#E00C1D] to-[#ff512f] hover:from-[#ff1a2b] hover:to-[#e52d27] text-white text-sm font-bold rounded-xl shadow-xl shadow-red-950/30 transition-all flex items-center gap-2 cursor-pointer scale-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Compiling ZIP Archive...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  Download Extension (.ZIP)
                </>
              )}
            </button>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 w-full pt-8 border-t border-white/5 text-left">
              <div className="flex gap-3">
                <Lock className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">100% Safe & Local</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Runs strictly inside your local browser. No data leaves your machine.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Bypass API Costs</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Generates unlimited high-quality storyboard images absolutely free.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Chromium Support</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Works on Chrome, Edge, Brave, Opera, and Vivaldi.</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Setup Instructions Heading */}
        <div className="mt-24 mb-12 flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">How to Install and Link</h2>
          <div className="h-1 w-12 bg-red-500 rounded-full" />
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 text-left w-full max-w-6xl mb-24">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-[#111115] border border-white/5 p-6 rounded-2xl relative flex flex-col justify-between group hover:border-red-500/20 transition-all duration-300">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:bg-red-500/10 group-hover:border-red-500/20 group-hover:text-red-400 transition-all">
                {step.num}
              </div>
              
              <div className="pt-4">
                <h4 className="text-sm font-bold text-white mb-2">{step.title}</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-4">{step.desc}</p>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                <p className="text-[9px] text-[#ff6a3d] italic leading-normal">
                  <span className="font-bold">Tip: </span>{step.tip}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <div className="w-full max-w-3xl mb-24 text-left">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-8 text-center">Frequently Asked Questions</h2>
          
          <div className="flex flex-col gap-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-[#111115] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-6 flex items-center justify-between text-left font-bold text-sm text-white hover:text-red-400 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${activeFaq === idx ? "rotate-180 text-red-500" : ""}`} />
                </button>
                
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    activeFaq === idx ? "max-h-[200px] border-t border-white/5" : "max-h-0"
                  }`}
                >
                  <p className="p-6 text-xs text-gray-400 leading-relaxed bg-[#0a0a0d]">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 pt-12 max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <Logo variant="image" imgClassName="h-8 opacity-50" />
        <span className="text-[10px] text-gray-500 font-medium">
          &copy; {new Date().getFullYear()} Eazi Studio. All rights reserved.
        </span>
        <div className="flex gap-6 text-[10px] font-semibold text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/login" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="https://labs.google/fx/tools/flow" target="_blank" className="hover:text-white transition-colors">Google FX Flow</Link>
        </div>
      </footer>
    </div>
  );
}
