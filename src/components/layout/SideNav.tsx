"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Lightbulb, FileText, Mic, Image, Tv, Share2, LogOut,
  PanelLeftClose, PanelLeftOpen, Wand2
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

const NAV_ITEMS = [
  { href: "/dashboard",                   label: "Dashboard",        Icon: LayoutDashboard, exact: true },
  { href: "/dashboard/ideation",          label: "Ideation Studio",  Icon: Lightbulb },
  { href: "/dashboard/script",            label: "Script Editor",    Icon: FileText,   linkHref: "/dashboard/script/1" },
  { href: "/dashboard/audio-transcript",  label: "Audio & Transcript", Icon: Mic,      linkHref: "/dashboard/audio-transcript/1" },
  { href: "/dashboard/storyboard-images", label: "Image Generation", Icon: Image,      linkHref: "/dashboard/storyboard-images/1" },
  { href: "/dashboard/thumbnail",         label: "Thumbnail Creator",Icon: Tv,         linkHref: "/dashboard/thumbnail/1" },
  { href: "/dashboard/presets",           label: "Niche Presets",    Icon: Wand2 },
  { href: "/dashboard/publish",           label: "Metadata & Publish",Icon: Share2,    linkHref: "/dashboard/publish/1" },
];

export default function SideNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    fetchUser();
  }, []);

  const getDisplayName = () =>
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const getInitials = () => {
    const name = getDisplayName();
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase() || "US";
  };

  const handleLogout = async () => {
    const supabase = createClient();
    localStorage.removeItem("youtube_provider_token");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      className={`
        h-full border-r border-black/5 dark:border-white/5 bg-white dark:bg-black flex flex-col justify-between shrink-0
        transition-[width] duration-300 ease-in-out
        ${isCollapsed ? "w-[72px]" : "w-64"}
      `}
    >
      {/* ── Top section (no overflow-hidden so tooltips can render outside) ── */}
      <div className="flex flex-col gap-0">

        {/* Header */}
        <div 
          className={`
            flex items-center min-h-[64px] pt-5 pb-3 transition-all duration-300
            ${isCollapsed ? "justify-center px-0" : "justify-between px-4"}
          `}
        >
          {/* Logo — fades out when collapsed */}
          <div
            className={`
              transition-all duration-300 ease-in-out overflow-hidden
              ${isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-36 opacity-100"}
            `}
          >
            <Logo
              variant="image"
              href="/dashboard"
              imgClassName="h-7 object-contain"
              className="justify-start"
            />
          </div>

          {/* Toggle button */}
          <button
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`
              p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/8 transition-all cursor-pointer shrink-0
              ${isCollapsed ? "" : "ml-auto"}
            `}
          >
            {isCollapsed
              ? <PanelLeftOpen className="w-[18px] h-[18px]" />
              : <PanelLeftClose className="w-[18px] h-[18px]" />
            }
          </button>
        </div>

        {/* Menu label */}
        <div
          className={`
            px-4 pb-1 overflow-hidden transition-all duration-300 ease-in-out
            ${isCollapsed ? "h-0 opacity-0 mb-0" : "h-6 opacity-100 mb-1"}
          `}
        >
          <p className="text-[11px] font-semibold text-gray-400 dark:text-[#7B7890] uppercase tracking-wider">
            Menu
          </p>
        </div>

        {/* Nav items — gap increased from 0.5 to 1.5 for better breathing room */}
        <div className="flex flex-col gap-1.5 px-2.5">
          {NAV_ITEMS.map(({ href, label, Icon, exact, linkHref }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={linkHref ?? href}
                className={`
                  group relative flex items-center rounded-xl
                  text-[13px] font-medium transition-all duration-200
                  ${isCollapsed ? "justify-center gap-0 px-0 py-2.5" : "justify-start gap-3 px-3 py-2.5"}
                  ${active
                    ? "text-[#E00C1D] bg-[#E00C1D]/5 dark:text-white dark:bg-white/5 font-semibold"
                    : "text-gray-500 hover:text-gray-900 dark:text-[#C4C0D8] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors duration-200 ${active ? "text-[#E00C1D]" : "text-gray-400 dark:text-[#C4C0D8] group-hover:text-gray-900 dark:group-hover:text-white"}`}
                />

                {/* Label — slides + fades with overflow clipping */}
                <span
                  className={`
                    whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out
                    ${isCollapsed ? "w-0 max-w-0 opacity-0" : "w-auto max-w-[160px] opacity-100"}
                  `}
                >
                  {label}
                </span>

                {/* Collapsed tooltip */}
                {isCollapsed && (
                  <span className="
                    absolute left-full ml-5 px-3 py-1.5 z-50
                    bg-white dark:bg-[#121214]/95 backdrop-blur-md text-gray-900 dark:text-white text-[12.5px] font-semibold
                    rounded-xl border border-black/10 dark:border-red-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(224,12,29,0.15)]
                    whitespace-nowrap pointer-events-none
                    opacity-0 translate-x-[-6px]
                    group-hover:opacity-100 group-hover:translate-x-0
                    transition-all duration-200
                  ">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Footer / User area (no overflow-hidden so tooltips work) ── */}
      <div className="p-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-3.5">
        {!isCollapsed && <ThemeSwitcher />}
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div className="shrink-0">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  referrerPolicy="no-referrer"
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E00C1D] to-[#ff6a3d] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white tracking-wider">
                    {getInitials()}
                  </span>
                </div>
              )}
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{getDisplayName()}</p>
              <p className="text-[10px] text-gray-500 dark:text-[#7B7890] truncate">{user?.email || "Loading..."}</p>
            </div>

            {/* Logout */}
            <div className="shrink-0">
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer flex items-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Theme cycling button in collapsed mode */}
            <ThemeSwitcher isCollapsed={true} />

            {/* Collapsed Avatar with Tooltip */}
            <div className="group relative shrink-0">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  referrerPolicy="no-referrer"
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover cursor-pointer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E00C1D] to-[#ff6a3d] flex items-center justify-center cursor-pointer">
                  <span className="text-[10px] font-bold text-white tracking-wider">
                    {getInitials()}
                  </span>
                </div>
              )}

              <span className="
                absolute left-full ml-5 px-3 py-1.5 z-50 top-1/2 -translate-y-1/2
                bg-white dark:bg-[#121214]/95 backdrop-blur-md text-gray-900 dark:text-white text-[12.5px] font-semibold
                rounded-xl border border-black/10 dark:border-red-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(224,12,29,0.15)]
                whitespace-nowrap pointer-events-none
                opacity-0 translate-x-[-6px]
                group-hover:opacity-100 group-hover:translate-x-0
                transition-all duration-200
              ">
                {getDisplayName()}
              </span>
            </div>

            {/* Collapsed Logout with Tooltip */}
            <div className="group relative shrink-0">
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <span className="
                absolute left-full ml-5 px-3 py-1.5 z-50 top-1/2 -translate-y-1/2
                bg-white dark:bg-[#121214]/95 backdrop-blur-md text-gray-900 dark:text-white text-[12.5px] font-semibold
                rounded-xl border border-black/10 dark:border-red-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(224,12,29,0.15)]
                whitespace-nowrap pointer-events-none
                opacity-0 translate-x-[-6px]
                group-hover:opacity-100 group-hover:translate-x-0
                transition-all duration-200
              ">
                Log Out
              </span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
