import { ReactNode } from "react";
import Link from "next/link";
import { User, Video } from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function TopNav() {
  return (
    <nav className="h-16 w-full border-b border-white/5 bg-[#0D0B1E]/80 backdrop-blur-xl px-8 flex items-center justify-between z-50 sticky top-0">
      <div className="flex items-center gap-8">
        <Logo variant="icon" href="/dashboard" />
        <div className="hidden md:flex items-center gap-2">
          <Link href="/dashboard" className="px-4 py-2 rounded-full text-sm font-medium text-[#C4C0D8] hover:text-white hover:bg-white/5 transition-colors">
            Projects
          </Link>
          <Link href="/dashboard/ideation" className="px-4 py-2 rounded-full text-sm font-medium text-[#C4C0D8] hover:text-white hover:bg-white/5 transition-colors">
            Ideation
          </Link>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="hidden md:flex items-center gap-2 px-5 py-2 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 text-[#9B6FF7] text-sm font-semibold hover:bg-[#8B5CF6]/25 transition-all">
          Upgrade Plan
        </button>
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </nav>
  );
}
