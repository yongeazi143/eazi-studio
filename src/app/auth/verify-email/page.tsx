"use client";

import { Suspense, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/components/ui/Logo";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "your email address";

  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Clean solid dark background with minimal, modern aesthetic */}
      <div className="absolute inset-0 z-0 bg-[#000000]" />

      {/* Main Box */}
      <div className="relative z-20 w-full max-w-[440px] animate-fade-in-up">
        
        {/* glassmorphic card container */}
        <div className="bg-[#0B0A0F] rounded-2xl border border-white/5 p-8 shadow-2xl relative text-center">
          
          {/* Logo Header using actual Logo PNG */}
          <div className="flex flex-col items-center mb-8">
            <Logo variant="image" noLink={false} imgClassName="h-10 w-auto" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Verify your registration</p>
          </div>

          {/* Mail Icon with Glowing Pulse */}
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(224,12,29,0.15)] animate-pulse-slow">
            <Mail className="w-8 h-8 text-[#E00C1D]" />
          </div>

          <h2 className="text-xl font-bold text-white mb-3">Check your inbox</h2>
          
          <p className="text-xs text-gray-400 leading-relaxed mb-6">
            We sent a verification link to <span className="text-white font-semibold">{email}</span>. 
            Please check your email and click the link to activate your account.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/login")}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#E00C1D] hover:bg-[#c90a18] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
            >
              Back to Sign In
              <ArrowRight size={14} />
            </button>
          </div>

          <p className="text-[10px] text-gray-500 mt-6 leading-relaxed">
            Didn't receive the email? Check your spam folder or contact support.
          </p>

        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white">
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
