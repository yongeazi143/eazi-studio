import { ReactNode } from "react";
import SideNav from "@/components/layout/SideNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-background text-foreground flex flex-row overflow-hidden w-full">
      <SideNav />
      <main className="flex-1 overflow-y-auto px-8 sm:px-12 py-6">
        {children}
      </main>
    </div>
  );
}
