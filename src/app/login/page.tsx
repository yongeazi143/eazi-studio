"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Logo from "@/components/ui/Logo";
import { cn } from "@/utils/cn";
import { useToast } from "@/context/ToastContext";

const PASSWORD_CHECKS = [
  { label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { label: "At least one uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "At least one lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { label: "At least one number", test: (pw: string) => /[0-9]/.test(pw) },
  { label: "At least one special character (!@#$%^&*)", test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const { showToast } = useToast();

  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const [isLoading, setIsLoading] = useState(false);

  // Form Fields
  const [identifier, setIdentifier] = useState(""); // Email or Username for Login
  const [username, setUsername] = useState(""); // Username for Signup
  const [email, setEmail] = useState(""); // Email for Signup
  const [password, setPassword] = useState(""); // Password for both
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Sync mode when URL param changes
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "signup") {
      setMode("signup");
    } else if (urlMode === "login") {
      setMode("login");
    }
  }, [searchParams]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);

    const supabase = createClient();
    let loginEmail = identifier.trim();

    // If no '@', resolve username to email via database route
    if (!loginEmail.includes("@")) {
      try {
        const res = await fetch(`/api/auth/resolve-email?username=${encodeURIComponent(loginEmail)}`);
        if (!res.ok) {
          const errData = await res.json();
          showToast(errData.error || "Username not found", "error");
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        loginEmail = data.email;
      } catch (err) {
        showToast("Failed to resolve username. Check connection.", "error");
        setIsLoading(false);
        return;
      }
    }

    // Attempt Sign In
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password,
    });

    if (error) {
      showToast(error.message, "error");
      setIsLoading(false);
    } else {
      showToast("Logged in successfully! Redirecting...", "success");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }
  };

  // Handle Signup submission
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Validate all password criteria
    const isPasswordValid = PASSWORD_CHECKS.every((check) => check.test(password));
    if (!isPasswordValid) {
      showToast("Please satisfy all password strength requirements.", "error");
      return;
    }

    setIsLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const supabase = createClient();

    // Pre-check: ensure username is not already taken
    try {
      const usernameCheck = await fetch(`/api/auth/resolve-email?username=${encodeURIComponent(cleanUsername)}`);
      if (usernameCheck.ok) {
        showToast("That username is already taken. Please choose a different one.", "error");
        setIsLoading(false);
        return;
      }
    } catch {
      // Network hiccup — proceed, the server will catch any conflict
    }

    // Sign Up on Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          name: cleanUsername,
        },
      },
    });

    if (error) {
      showToast(error.message, "error");
      setIsLoading(false);
      return;
    }

    // Supabase silently "succeeds" for already-registered emails when email confirmation
    // is enabled — the signal is an empty identities array.
    if (data?.user && (data.user.identities?.length ?? 0) === 0) {
      showToast("An account with this email already exists. Please sign in instead.", "error");
      setIsLoading(false);
      return;
    }

    if (data?.user) {
      // Sync metadata to public Prisma User table
      try {
        const syncRes = await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            username: cleanUsername,
          }),
        });

        if (!syncRes.ok) {
          console.error("Prisma User sync failed");
        }
      } catch (err) {
        console.error("Prisma sync connection error:", err);
      }

      if (!data.session) {
        showToast("Registration successful! Check your email to confirm.", "success");
        setTimeout(() => {
          router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
        }, 1500);
      } else {
        showToast("Account created successfully! Redirecting...", "success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1800);
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-200">
      
      {/* SOLID BG */}
      <div className="absolute inset-0 z-0 bg-background" />

      {/* Main Form Box */}
      <div className="relative z-20 w-full max-w-[420px] animate-fade-in-up">
        
        {/* glassmorphic card container */}
        <div className="glass-card bg-white dark:bg-[#0B0A0F]/90 rounded-2xl border border-black/10 dark:border-white/5 p-8 shadow-2xl relative">
          
          {/* Logo Header using actual Logo PNG */}
          <div className="flex flex-col items-center mb-8">
            <Logo variant="image" noLink={false} imgClassName="h-10 w-auto" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Create viral videos on autopilot</p>
          </div>

          {/* Form Tabs Selector */}
          <div className="flex p-1 bg-black/[0.04] dark:bg-white/5 border border-black/[0.06] dark:border-white/5 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
              }}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer text-center",
                mode === "login"
                  ? "bg-[#E00C1D] text-white shadow-md animate-fade-in"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
              }}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer text-center",
                mode === "signup"
                  ? "bg-[#E00C1D] text-white shadow-md animate-fade-in"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Create Account
            </button>
          </div>

          {/* Switch Forms */}
          {mode === "login" ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Email or Username
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 bg-black/[0.02] dark:bg-[#131217] border border-black/10 dark:border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-550 outline-none transition-all duration-200 text-sm"
                  placeholder="Enter email or username"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black/[0.02] dark:bg-[#131217] border border-black/10 dark:border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-550 outline-none transition-all duration-200 text-sm pr-10"
                    placeholder="Enter password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-[#E00C1D] hover:bg-[#c90a18] text-white text-sm font-bold rounded-xl shadow-md shadow-red-950/20 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  className="w-full px-4 py-3 bg-black/[0.02] dark:bg-[#131217] border border-black/10 dark:border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-550 outline-none transition-all duration-200 text-sm"
                  placeholder="Choose username"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-black/[0.02] dark:bg-[#131217] border border-black/10 dark:border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-550 outline-none transition-all duration-200 text-sm"
                  placeholder="Enter email"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    className="w-full px-4 py-3 bg-black/[0.02] dark:bg-[#131217] border border-black/10 dark:border-white/5 focus:border-[#E00C1D] focus:ring-1 focus:ring-[#E00C1D] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-550 outline-none transition-all duration-200 text-sm pr-10"
                    placeholder="Enter strength password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>

                  {/* Real-time Password Strength Requirements Validator - Popover Card */}
                  {isPasswordFocused && (
                    <div className="absolute z-50 p-4 bg-white/95 dark:bg-[#0F0E15]/95 backdrop-blur-md rounded-xl border border-black/10 dark:border-white/10 shadow-2xl w-full md:w-64 md:left-[calc(100%+20px)] md:top-0 left-0 top-[calc(100%+8px)] animate-pop-over text-left pointer-events-none">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Password Requirements</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {PASSWORD_CHECKS.map((check, idx) => {
                          const passed = check.test(password);
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <div className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                passed ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-black/5 dark:bg-white/5 text-gray-400 dark:text-gray-600"
                              )}>
                                {passed ? <Check size={10} strokeWidth={3} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                              </div>
                              <span className={cn(
                                "text-xs transition-colors",
                                passed ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500"
                              )}>
                                {check.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-[#E00C1D] hover:bg-[#c90a18] text-white text-sm font-bold rounded-xl shadow-md shadow-red-950/20 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          <p className="text-[10px] text-center text-gray-500 mt-6 leading-relaxed">
            By accessing Eazi Studio, you agree to our Terms of Service and Privacy Policy.
          </p>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-[#E00C1D]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
