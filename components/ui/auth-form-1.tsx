"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  MailCheck,
  MapPin,
  Phone,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  signInWithGooglePopup,
  isFirebaseConfigured,
  type GoogleAuthResult,
} from "@/lib/firebase";

// --------------------------------
// Types and Enums
// --------------------------------

enum AuthView {
  SIGN_IN = "sign-in",
  SIGN_UP = "sign-up",
  FORGOT_PASSWORD = "forgot-password",
  RESET_SUCCESS = "reset-success",
}

interface AuthState {
  view: AuthView;
}

interface FormState {
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
}

// --------------------------------
// Schemas
// --------------------------------

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  name: z.string().min(2, "Full Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  badgeId: z.string().optional(),
  designation: z.string().optional(),
  station: z.string().optional(),
  radioChannel: z.string().optional(),
  phone: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type SignInFormValues = z.infer<typeof signInSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export type UserRole = "worker" | "manager";

export interface UserSessionData {
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  badgeId?: string;
  designation?: string;
  station?: string;
  radioChannel?: string;
  phone?: string;
  status?: string;
  approval?: {
    approvedByManagerName: string;
    approvedByManagerBadge: string;
    approvedByManagerEmail: string;
    approvedByManagerDesignation: string;
    approvedAt: string | Date;
    assignedRole: "worker" | "manager";
    remarks?: string;
  };
}

interface AuthProps extends React.ComponentProps<"div"> {
  onLoginSuccess?: (user: UserSessionData) => void;
  defaultRole?: UserRole;
}

function Auth({ className, onLoginSuccess, defaultRole = "worker", ...props }: AuthProps) {
  const [state, setState] = React.useState<AuthState>({ view: AuthView.SIGN_IN });
  const [prefilledGoogleData, setPrefilledGoogleData] = React.useState<GoogleAuthResult | null>(null);

  const setView = React.useCallback((view: AuthView) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  return (
    <div
      data-slot="auth"
      className={cn(
        "mx-auto w-full max-w-md transition-all duration-300",
        className
      )}
      {...props}
    >
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white text-zinc-950 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-50/70 via-transparent to-zinc-100/40 pointer-events-none" />
        <div className="relative z-10 max-h-[88vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {state.view === AuthView.SIGN_IN && (
              <AuthSignIn
                key="sign-in"
                defaultRole={defaultRole}
                onLoginSuccess={onLoginSuccess}
                onForgotPassword={() => setView(AuthView.FORGOT_PASSWORD)}
                onSignUp={() => {
                  setPrefilledGoogleData(null);
                  setView(AuthView.SIGN_UP);
                }}
                onSignUpWithGoogle={(googleData) => {
                  setPrefilledGoogleData(googleData);
                  setView(AuthView.SIGN_UP);
                }}
              />
            )}
            {state.view === AuthView.SIGN_UP && (
              <AuthSignUp
                key="sign-up"
                defaultRole={defaultRole}
                prefilledGoogleData={prefilledGoogleData}
                onLoginSuccess={onLoginSuccess}
                onSignIn={() => {
                  setPrefilledGoogleData(null);
                  setView(AuthView.SIGN_IN);
                }}
              />
            )}
            {state.view === AuthView.FORGOT_PASSWORD && (
              <AuthForgotPassword
                key="forgot-password"
                onSignIn={() => setView(AuthView.SIGN_IN)}
                onSuccess={() => setView(AuthView.RESET_SUCCESS)}
              />
            )}
            {state.view === AuthView.RESET_SUCCESS && (
              <AuthResetSuccess
                key="reset-success"
                onSignIn={() => setView(AuthView.SIGN_IN)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// --------------------------------
// Shared Components
// --------------------------------

interface AuthFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  className?: string;
}

function AuthForm({ onSubmit, children, className }: AuthFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-4 text-start", className)}
    >
      {children}
    </form>
  );
}

interface AuthErrorProps {
  message?: string | null;
}

function AuthError({ message }: AuthErrorProps) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}

function AuthSeparator({ text = "Or continue with" }: { text?: string }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-2.5 text-neutral-400 font-mono text-[10px]">
          {text}
        </span>
      </div>
    </div>
  );
}

function GoogleAuthButton({
  mode,
  isLoading,
  onClick,
}: {
  mode: "signin" | "signup";
  isLoading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isLoading}
      onClick={onClick}
      className={cn(
        "w-full h-10 px-4 py-2 bg-white hover:bg-neutral-50/90 text-neutral-800 text-xs font-semibold",
        "border border-neutral-300 hover:border-neutral-400 shadow-2xs rounded-xl",
        "flex items-center justify-center gap-2.5 transition-all cursor-pointer"
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-neutral-600" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleIcon className="h-4 w-4 shrink-0" />
          <span>{mode === "signin" ? "Sign in with Google" : "Sign up with Google"}</span>
        </>
      )}
    </Button>
  );
}

interface GoogleAccount {
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  avatarUrl: string;
  station?: string;
  badgeId?: string;
}

const PRESET_GOOGLE_ACCOUNTS: GoogleAccount[] = [
  {
    name: "Lav Kumar",
    email: "lav@gmail.com",
    role: "worker",
    designation: "HSE Field Safety Officer (Derrick Floor)",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    station: "Moran Rig #04 • Wellhead Section",
    badgeId: "OIL-FLD-5542",
  },
  {
    name: "Priyanka Bora",
    email: "priyanka@oilindia.in",
    role: "manager",
    designation: "Chief General Manager (Process Safety & SIF Control)",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    station: "Assam & Assam-Arakan Basin (Duliajan HQ)",
    badgeId: "OIL-MGR-1002",
  },
];

interface GoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "signin" | "signup";
  selectedRole?: UserRole;
  onSelectAccount: (account: GoogleAccount) => void;
}

function GoogleAccountChooserModal({
  isOpen,
  onClose,
  mode,
  selectedRole = "worker",
  onSelectAccount,
}: GoogleAccountModalProps) {
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customEmail, setCustomEmail] = React.useState("");
  const [customRole, setCustomRole] = React.useState<UserRole>(selectedRole);
  const [customError, setCustomError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setShowCustomInput(false);
      setCustomError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    if (!customEmail || !customEmail.includes("@")) {
      setCustomError("Please provide a valid Google email address.");
      return;
    }
    const name = customName.trim() || customEmail.split("@")[0];
    onSelectAccount({
      name,
      email: customEmail.trim().toLowerCase(),
      role: customRole,
      designation: customRole === "manager" ? "HSE Operations Manager" : "HSE Field Safety Officer",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      station: customRole === "manager" ? "Corporate Duliajan HQ" : "Moran Rig #04 • Wellhead Section",
      badgeId: `OIL-${customRole === "manager" ? "MGR" : "FLD"}-${Math.floor(1000 + Math.random() * 9000)}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden text-start">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-neutral-100 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GoogleIcon className="w-5 h-5" />
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                Google Identity Service
              </span>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              {mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
            </h3>
            <p className="text-xs text-neutral-500">
              Choose an account to continue to <span className="font-semibold text-neutral-700">OIL India HSE Intelligence</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pt-4 space-y-3">
          {!isFirebaseConfigured() && (
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-[11px] space-y-0.5">
              <div className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulated Mode Active</span>
              </div>
              <p className="text-blue-800/80 text-[10px] leading-relaxed">
                Add your Firebase API keys to <code className="px-1 py-0.5 bg-blue-100 rounded font-mono">.env.local</code> to enable live Google OAuth popups.
              </p>
            </div>
          )}
          {!showCustomInput ? (
            <>
              <div className="space-y-2">
                {PRESET_GOOGLE_ACCOUNTS.map((acc) => {
                  const isRoleMatch = acc.role === selectedRole;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => onSelectAccount(acc)}
                      className={cn(
                        "w-full p-3 rounded-xl border text-start flex items-center gap-3 transition-all cursor-pointer group",
                        isRoleMatch
                          ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400"
                          : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      <img
                        src={acc.avatarUrl}
                        alt={acc.name}
                        className="w-10 h-10 rounded-full border border-neutral-200 object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {acc.name}
                          </span>
                          {isRoleMatch && (
                            <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
                              Match
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 font-mono truncate">
                          {acc.email}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {acc.designation}
                        </p>
                      </div>
                      <div className="text-neutral-400 group-hover:text-neutral-900 transition-colors">
                        <Check className={cn("w-4 h-4", isRoleMatch ? "text-emerald-600" : "opacity-0 group-hover:opacity-100")} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Use another Google account</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              {customError && (
                <p className="text-xs text-destructive">{customError}</p>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Full Name</Label>
                <Input
                  placeholder="Debajit Saikia"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Google Email Address</Label>
                <Input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Target Role
                </Label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-lg border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setCustomRole("worker")}
                    className={cn(
                      "py-1 text-xs font-semibold rounded cursor-pointer transition-all",
                      customRole === "worker"
                        ? "bg-white text-neutral-900 shadow-2xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    )}
                  >
                    Field Officer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRole("manager")}
                    className={cn(
                      "py-1 text-xs font-semibold rounded cursor-pointer transition-all",
                      customRole === "manager"
                        ? "bg-white text-neutral-900 shadow-2xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    )}
                  >
                    HSE Manager
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomInput(false)}
                  className="w-1/3 text-xs"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="w-2/3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Continue with Google
                </Button>
              </div>
            </form>
          )}

          <p className="text-[10px] text-neutral-400 leading-relaxed text-center pt-2">
            To continue, Google will share your verified name, email address, and profile photo with OIL India HSE Intelligence.
          </p>
        </div>
      </div>
    </div>
  );
}

// --------------------------------
// Sign In Component
// --------------------------------

interface AuthSignInProps {
  onForgotPassword: () => void;
  onSignUp: () => void;
  onSignUpWithGoogle?: (googleData: GoogleAuthResult) => void;
  onLoginSuccess?: (user: UserSessionData) => void;
  defaultRole?: UserRole;
}

function AuthSignIn({ onForgotPassword, onSignUp, onSignUpWithGoogle, onLoginSuccess, defaultRole = "worker" }: AuthSignInProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(defaultRole);
  const [pendingNotice, setPendingNotice] = React.useState<string | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = React.useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = React.useState(false);
  const [formState, setFormState] = React.useState<FormState>({
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "lav@gmail.com", password: "123456" },
  });

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === "manager") {
      setValue("email", "priyanka@oilindia.in");
      setValue("password", "123456");
    } else {
      setValue("email", "lav@gmail.com");
      setValue("password", "123456");
    }
  };

  const handleGoogleAuthClick = async () => {
    if (isFirebaseConfigured()) {
      setIsGoogleSigningIn(true);
      setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
      setPendingNotice(null);

      try {
        const googleUser = await signInWithGooglePopup();
        if (!googleUser.email) {
          throw new Error("No verified email returned from Google account.");
        }

        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "firebase_signin",
            email: googleUser.email,
            role: selectedRole,
          }),
        });

        const json = await res.json();

        if (json.status === "not_found") {
          // Account doesn't exist yet in OIL HSE records!
          // Intelligently route to Sign Up with Google details prefilled
          onSignUpWithGoogle?.(googleUser);
          return;
        }

        if (!res.ok || !json.success) {
          if (json.status === "pending") {
            setPendingNotice(
              json.error ||
                "Your account registration is currently pending clearance by an HSE Manager. Please await manager verification."
            );
            return;
          }
          throw new Error(json.error || "Failed to sign in with Google.");
        }

        onLoginSuccess?.(json.user);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Google authentication error";
        if (!msg.includes("popup-closed-by-user") && !msg.includes("cancelled-popup-request")) {
          setFormState((prev) => ({ ...prev, error: msg }));
        }
      } finally {
        setIsGoogleSigningIn(false);
        setFormState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setIsGoogleModalOpen(true);
    }
  };

  const handleGoogleSignIn = async (account: GoogleAccount) => {
    setIsGoogleSigningIn(true);
    setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
    setPendingNotice(null);
    setIsGoogleModalOpen(false);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "google_signin",
          email: account.email,
          role: account.role || selectedRole,
        }),
      });

      const json = await res.json();

      if (json.status === "not_found") {
        onSignUpWithGoogle?.({
          displayName: account.name,
          email: account.email,
          photoURL: account.avatarUrl,
          uid: `sim_${account.email}`,
        });
        return;
      }

      if (!res.ok || !json.success) {
        if (json.status === "pending") {
          setPendingNotice(
            json.error ||
              "Your account registration is currently pending clearance by an HSE Manager. Please await manager verification."
          );
          return;
        }
        throw new Error(json.error || "Failed to sign in with Google.");
      }

      onLoginSuccess?.(json.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google authentication error";
      setFormState((prev) => ({ ...prev, error: msg }));
    } finally {
      setIsGoogleSigningIn(false);
      setFormState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const onSubmit = async (data: SignInFormValues) => {
    setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
    setPendingNotice(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signin",
          email: data.email,
          password: data.password,
          role: selectedRole,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.status === "pending") {
          setPendingNotice(
            json.error ||
              "Your account registration is currently pending clearance by an HSE Manager. Please await manager verification."
          );
          return;
        }
        throw new Error(json.error || "Invalid credentials.");
      }

      onLoginSuccess?.(json.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error";
      setFormState((prev) => ({ ...prev, error: msg }));
    } finally {
      setFormState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <motion.div
      data-slot="auth-sign-in"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome Back</h1>
        <p className="mt-1 text-xs text-muted-foreground">Sign in to your authorized safety account</p>
      </div>

      {/* Role Switcher */}
      <div className="mb-5 space-y-1.5">
        <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Login Role</Label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
          <button
            type="button"
            onClick={() => handleRoleSelect("worker")}
            className={cn(
              "flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "worker"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Field Officer
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect("manager")}
            className={cn(
              "flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "manager"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            HSE Manager
          </button>
        </div>
      </div>

      {/* Pending Approval Notice Banner */}
      {pendingNotice && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Clearance Pending</span>
          </div>
          <p className="text-amber-800 leading-relaxed text-[11px]">{pendingNotice}</p>
          <div className="pt-1 border-t border-amber-200 flex justify-between items-center text-[10px]">
            <span className="text-amber-700">Need manager sign-off?</span>
            <button
              type="button"
              onClick={() => handleRoleSelect("manager")}
              className="text-blue-700 font-bold hover:underline cursor-pointer"
            >
              Sign In as Manager to Approve
            </button>
          </div>
        </div>
      )}

      <AuthError message={formState.error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Official Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@oilindia.in"
            disabled={formState.isLoading}
            className={cn(errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={onForgotPassword}
              disabled={formState.isLoading}
            >
              Forgot password?
            </Button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={formState.showPassword ? "text" : "password"}
              placeholder="••••••••"
              disabled={formState.isLoading}
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() =>
                setFormState((prev) => ({ ...prev, showPassword: !prev.showPassword }))
              }
              disabled={formState.isLoading}
            >
              {formState.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={formState.isLoading}>
          {formState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying credentials...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </AuthForm>

      <AuthSeparator text="Or continue with" />
      <GoogleAuthButton
        mode="signin"
        isLoading={isGoogleSigningIn || formState.isLoading}
        onClick={handleGoogleAuthClick}
      />

      <GoogleAccountChooserModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        mode="signin"
        selectedRole={selectedRole}
        onSelectAccount={handleGoogleSignIn}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        New to OIL India HSE?{" "}
        <Button
          variant="link"
          className="h-auto p-0 text-xs font-semibold text-neutral-900 cursor-pointer"
          onClick={onSignUp}
          disabled={formState.isLoading}
        >
          Submit account request
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Sign Up Component (Verification Request Form)
// --------------------------------

interface AuthSignUpProps {
  onSignIn: () => void;
  onLoginSuccess?: (user: UserSessionData) => void;
  defaultRole?: UserRole;
  prefilledGoogleData?: GoogleAuthResult | null;
}

interface SubmittedRequestData {
  name: string;
  email: string;
  badgeId: string;
  designation: string;
  station: string;
  radioChannel: string;
  phone: string;
  role: UserRole;
  avatarUrl: string;
}

function AuthSignUp({ onSignIn, defaultRole = "worker", prefilledGoogleData }: AuthSignUpProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(defaultRole);
  const [avatarPreview, setAvatarPreview] = React.useState<string>(
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [submittedRequest, setSubmittedRequest] = React.useState<SubmittedRequestData | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = React.useState(false);
  const [googleConnected, setGoogleConnected] = React.useState<{ name: string; email: string } | null>(null);

  const [formState, setFormState] = React.useState<FormState>({
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      badgeId: defaultRole === "manager" ? "OIL-MGR-8821" : "OIL-FLD-5542",
      designation: defaultRole === "manager" ? "HSE Operations Manager" : "Field Safety Officer",
      station: defaultRole === "manager" ? "Corporate HSE Directorate • Duliajan" : "Moran Rig #04 • Wellhead Section",
      radioChannel: defaultRole === "manager" ? "UHF CH-01" : "UHF CH-04",
      phone: "+91 94350 44521",
    },
  });

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === "manager") {
      setValue("designation", "HSE Operations Manager");
      setValue("station", "Corporate HSE Directorate • Duliajan");
      setValue("radioChannel", "UHF CH-01");
      setValue("badgeId", "OIL-MGR-8821");
    } else {
      setValue("designation", "Field Safety Officer");
      setValue("station", "Moran Rig #04 • Wellhead Section");
      setValue("radioChannel", "UHF CH-04");
      setValue("badgeId", "OIL-FLD-5542");
    }
  };

  // Automatically populate Google credentials if routed from Google sign-in
  React.useEffect(() => {
    if (prefilledGoogleData) {
      if (prefilledGoogleData.displayName) {
        setValue("name", prefilledGoogleData.displayName, { shouldValidate: true });
      }
      if (prefilledGoogleData.email) {
        setValue("email", prefilledGoogleData.email, { shouldValidate: true });
      }
      setValue("password", "google_firebase_sso", { shouldValidate: true });
      if (prefilledGoogleData.photoURL) {
        setAvatarPreview(prefilledGoogleData.photoURL);
      }
      setGoogleConnected({
        name: prefilledGoogleData.displayName || "Google User",
        email: prefilledGoogleData.email || "",
      });
    }
  }, [prefilledGoogleData, setValue]);

  const handleGoogleSignUpClick = async () => {
    if (isFirebaseConfigured()) {
      setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const googleUser = await signInWithGooglePopup();
        if (googleUser.displayName) {
          setValue("name", googleUser.displayName, { shouldValidate: true });
        }
        if (googleUser.email) {
          setValue("email", googleUser.email, { shouldValidate: true });
        }
        setValue("password", "google_firebase_sso", { shouldValidate: true });
        if (googleUser.photoURL) {
          setAvatarPreview(googleUser.photoURL);
        }
        setGoogleConnected({
          name: googleUser.displayName || "Google User",
          email: googleUser.email || "",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Google authentication error";
        if (!msg.includes("popup-closed-by-user") && !msg.includes("cancelled-popup-request")) {
          setFormState((prev) => ({ ...prev, error: msg }));
        }
      } finally {
        setFormState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setIsGoogleModalOpen(true);
    }
  };

  const handleGoogleSignUpSelect = (account: GoogleAccount) => {
    setIsGoogleModalOpen(false);
    setValue("name", account.name, { shouldValidate: true });
    setValue("email", account.email, { shouldValidate: true });
    setValue("password", "google_sso_verified", { shouldValidate: true });
    if (account.badgeId) setValue("badgeId", account.badgeId, { shouldValidate: true });
    if (account.designation) setValue("designation", account.designation, { shouldValidate: true });
    if (account.station) setValue("station", account.station, { shouldValidate: true });
    if (account.role) setSelectedRole(account.role);
    if (account.avatarUrl) setAvatarPreview(account.avatarUrl);
    setGoogleConnected({ name: account.name, email: account.email });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: SignUpFormValues) => {
    setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          name: data.name,
          email: data.email,
          password: data.password,
          role: selectedRole,
          badgeId: data.badgeId,
          designation: data.designation,
          station: data.station,
          radioChannel: data.radioChannel,
          phone: data.phone,
          avatarUrl: avatarPreview,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit registration request.");
      }

      setSubmittedRequest({
        name: data.name,
        email: data.email,
        badgeId: data.badgeId || (selectedRole === "manager" ? "OIL-MGR-8821" : "OIL-FLD-5542"),
        designation: data.designation || (selectedRole === "manager" ? "HSE Operations Manager" : "Field Safety Officer"),
        station: data.station || (selectedRole === "manager" ? "Corporate HSE Directorate • Duliajan" : "Moran Rig #04 • Wellhead Section"),
        radioChannel: data.radioChannel || (selectedRole === "manager" ? "UHF CH-01" : "UHF CH-04"),
        phone: data.phone || "+91 94350 44521",
        role: selectedRole,
        avatarUrl: avatarPreview,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormState((prev) => ({ ...prev, error: msg }));
    } finally {
      setFormState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // If request has been submitted, show the confirmation screen
  if (submittedRequest) {
    return (
      <motion.div
        data-slot="auth-request-submitted"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="p-8 space-y-5"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto ring-4 ring-amber-50">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Clearance Request Submitted
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Your profile details and operational credentials have been forwarded to the HSE Management Portal.
          </p>
        </div>

        {/* Profile Card Preview */}
        <div className="bg-neutral-50/90 border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Submitted Profile
            </span>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
              {submittedRequest.badgeId}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <img
              src={submittedRequest.avatarUrl}
              alt="Applicant"
              className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <h4 className="text-sm font-bold text-neutral-900 leading-tight truncate">
                {submittedRequest.name}
              </h4>
              <p className="text-xs text-neutral-600 font-medium truncate">
                {submittedRequest.designation}
              </p>
              <p className="text-[11px] text-neutral-500 font-mono truncate">
                {submittedRequest.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200/70 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-600">
              <MapPin size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">{submittedRequest.station}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-600">
              <Radio size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">{submittedRequest.radioChannel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-600 col-span-2">
              <Phone size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">{submittedRequest.phone}</span>
            </div>
          </div>
        </div>

        {/* Manager Verification Notice */}
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Next Step: Manager Sign-Off</span>
          </div>
          <p className="text-blue-800/90 leading-relaxed">
            An existing HSE Manager (such as Chief General Manager Priyanka Bora) will inspect your rig station, radio frequency, and badge credentials to grant clearance. You will then be able to log in.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Button
            type="button"
            onClick={onSignIn}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
          >
            Back to Sign In
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-slot="auth-sign-up"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Create an Account</h1>
        <p className="mt-1 text-xs text-muted-foreground">Sign up for your authorized safety account</p>
      </div>

      {/* Role Selection Switcher */}
      <div className="mb-5 space-y-1.5">
        <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Account Role
        </Label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
          <button
            type="button"
            onClick={() => handleRoleSelect("worker")}
            className={cn(
              "flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "worker"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Field Officer
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect("manager")}
            className={cn(
              "flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "manager"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            HSE Manager
          </button>
        </div>
      </div>

      {googleConnected && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] truncate">
              Google Account: <strong>{googleConnected.email}</strong>
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
            Verified SSO
          </span>
        </div>
      )}

      <AuthError message={formState.error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
            {googleConnected && (
              <span className="text-[10px] text-emerald-600 font-medium">Verified by Google</span>
            )}
          </div>
          <Input
            id="name"
            type="text"
            placeholder="Debajit Saikia"
            disabled={formState.isLoading}
            className={cn(errors.name && "border-destructive")}
            {...register("name")}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="email" className="text-xs font-medium">Official Email</Label>
            {googleConnected && (
              <span className="text-[10px] text-emerald-600 font-medium">Verified by Google</span>
            )}
          </div>
          <Input
            id="email"
            type="email"
            placeholder="name@oilindia.in"
            disabled={formState.isLoading}
            className={cn(errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {!googleConnected ? (
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={formState.showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={formState.isLoading}
                className={cn(errors.password && "border-destructive")}
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() =>
                  setFormState((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                }
                disabled={formState.isLoading}
              >
                {formState.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Password</Label>
            <div className="h-9 px-3 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
              <span>Managed by Google SSO</span>
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="badgeId" className="text-xs font-medium">Badge ID</Label>
            <Input
              id="badgeId"
              type="text"
              placeholder="OIL-FLD-5542"
              disabled={formState.isLoading}
              className={cn("text-xs font-mono", errors.badgeId && "border-destructive")}
              {...register("badgeId")}
            />
            {errors.badgeId && <p className="text-[11px] text-destructive">{errors.badgeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="designation" className="text-xs font-medium">Designation</Label>
            <Input
              id="designation"
              type="text"
              placeholder="Safety Officer"
              disabled={formState.isLoading}
              className={cn("text-xs", errors.designation && "border-destructive")}
              {...register("designation")}
            />
            {errors.designation && <p className="text-[11px] text-destructive">{errors.designation.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="station" className="text-xs font-medium">Rig / Station Base</Label>
          <Input
            id="station"
            type="text"
            placeholder="Moran Rig #04 • Wellhead Section"
            disabled={formState.isLoading}
            className={cn("text-xs", errors.station && "border-destructive")}
            {...register("station")}
          />
          {errors.station && <p className="text-[11px] text-destructive">{errors.station.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="radioChannel" className="text-xs font-medium">Radio Channel</Label>
            <Input
              id="radioChannel"
              type="text"
              placeholder="UHF CH-04"
              disabled={formState.isLoading}
              className={cn("text-xs font-mono", errors.radioChannel && "border-destructive")}
              {...register("radioChannel")}
            />
            {errors.radioChannel && <p className="text-[11px] text-destructive">{errors.radioChannel.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-medium">Phone</Label>
            <Input
              id="phone"
              type="text"
              placeholder="+91 94350 44521"
              disabled={formState.isLoading}
              className={cn("text-xs font-mono", errors.phone && "border-destructive")}
              {...register("phone")}
            />
            {errors.phone && <p className="text-[11px] text-destructive">{errors.phone.message}</p>}
          </div>
        </div>

        <Button type="submit" className="w-full mt-2" disabled={formState.isLoading}>
          {formState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting request...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </AuthForm>

      <AuthSeparator text="Or continue with" />
      <GoogleAuthButton
        mode="signup"
        isLoading={formState.isLoading}
        onClick={handleGoogleSignUpClick}
      />

      <GoogleAccountChooserModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        mode="signup"
        selectedRole={selectedRole}
        onSelectAccount={handleGoogleSignUpSelect}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Button
          variant="link"
          className="h-auto p-0 text-xs font-semibold text-neutral-900 cursor-pointer"
          onClick={onSignIn}
          disabled={formState.isLoading}
        >
          Sign in
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Forgot Password Component
// --------------------------------

interface AuthForgotPasswordProps {
  onSignIn: () => void;
  onSuccess: () => void;
}

function AuthForgotPassword({ onSignIn, onSuccess }: AuthForgotPasswordProps) {
  const [formState, setFormState] = React.useState<FormState>({
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (_data: ForgotPasswordFormValues) => {
    setFormState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSuccess();
    } catch {
      setFormState((prev) => ({ ...prev, error: "An unexpected error occurred" }));
    } finally {
      setFormState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <motion.div
      data-slot="auth-forgot-password"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4"
        onClick={onSignIn}
        disabled={formState.isLoading}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Back</span>
      </Button>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your official email to receive a clearance verification link
        </p>
      </div>

      <AuthError message={formState.error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@oilindia.in"
            disabled={formState.isLoading}
            className={cn(errors.email && "border-destructive")}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={formState.isLoading}>
          {formState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending link...
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </AuthForm>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Remember your password?{" "}
        <Button
          variant="link"
          className="h-auto p-0 text-xs font-semibold text-neutral-900 cursor-pointer"
          onClick={onSignIn}
          disabled={formState.isLoading}
        >
          Sign in
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Reset Success Component
// --------------------------------

interface AuthResetSuccessProps {
  onSignIn: () => void;
}

function AuthResetSuccess({ onSignIn }: AuthResetSuccessProps) {
  return (
    <motion.div
      data-slot="auth-reset-success"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col items-center p-8 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
        <MailCheck className="h-8 w-8 text-emerald-600" />
      </div>

      <h1 className="text-xl font-bold text-foreground">Check Your Email</h1>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        We sent an HSE password reset confirmation to your registered email address.
      </p>

      <Button
        variant="outline"
        className="mt-6 w-full max-w-xs cursor-pointer"
        onClick={onSignIn}
      >
        Back to Sign In
      </Button>
    </motion.div>
  );
}

// --------------------------------
// Exports
// --------------------------------

export {
  Auth,
  AuthSignIn,
  AuthSignUp,
  AuthForgotPassword,
  AuthResetSuccess,
  AuthForm,
  AuthError,
  GoogleAuthButton,
  GoogleAccountChooserModal,
  GoogleIcon,
  AuthSeparator,
};
