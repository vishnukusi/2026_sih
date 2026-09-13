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
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  MailCheck,
  MapPin,
  Phone,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
  badgeId: z.string().min(3, "Employee / Badge ID is required"),
  designation: z.string().min(3, "Official Designation is required"),
  station: z.string().min(3, "Assigned Rig / Station Base is required"),
  radioChannel: z.string().min(2, "Radio Channel is required"),
  phone: z.string().min(6, "Contact / Phone number is required"),
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

  const setView = React.useCallback((view: AuthView) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  return (
    <div
      data-slot="auth"
      className={cn(
        "mx-auto w-full transition-all duration-300",
        state.view === AuthView.SIGN_UP ? "max-w-xl" : "max-w-md",
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
                onSignUp={() => setView(AuthView.SIGN_UP)}
              />
            )}
            {state.view === AuthView.SIGN_UP && (
              <AuthSignUp
                key="sign-up"
                defaultRole={defaultRole}
                onLoginSuccess={onLoginSuccess}
                onSignIn={() => setView(AuthView.SIGN_IN)}
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

function AuthSeparator() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-2 text-muted-foreground font-mono text-[10px]">
          OIL Verified Access
        </span>
      </div>
    </div>
  );
}

function AuthSocialButtons({
  onQuickLogin,
}: {
  isLoading?: boolean;
  onQuickLogin?: (email: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider text-center">
        Quick Demo Access
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onQuickLogin?.("lav@gmail.com")}
          className="w-full text-xs font-medium py-1.5 h-auto bg-neutral-50 hover:bg-neutral-100 border-neutral-200 cursor-pointer"
        >
          <User className="mr-1.5 h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Field Officer</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onQuickLogin?.("priyanka@oilindia.in")}
          className="w-full text-xs font-medium py-1.5 h-auto bg-neutral-50 hover:bg-neutral-100 border-neutral-200 cursor-pointer"
        >
          <Briefcase className="mr-1.5 h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="truncate">HSE Manager</span>
        </Button>
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
  onLoginSuccess?: (user: UserSessionData) => void;
  defaultRole?: UserRole;
}

function AuthSignIn({ onForgotPassword, onSignUp, onLoginSuccess, defaultRole = "worker" }: AuthSignInProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(defaultRole);
  const [pendingNotice, setPendingNotice] = React.useState<string | null>(null);
  const [formState, setFormState] = React.useState<FormState>({
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "lav@gmail.com", password: "123456" },
  });

  const handleQuickFill = (email: string) => {
    setValue("email", email);
    setValue("password", "123456");
    if (email.includes("priyanka")) {
      setSelectedRole("manager");
    } else {
      setSelectedRole("worker");
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
            onClick={() => setSelectedRole("worker")}
            className={cn(
              "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "worker"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <User className="h-3.5 w-3.5" />
            Field Officer
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("manager")}
            className={cn(
              "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "manager"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
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
            <span className="text-amber-700">Need immediate demo access?</span>
            <button
              type="button"
              onClick={() => handleQuickFill("priyanka@oilindia.in")}
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

      <AuthSeparator />
      <AuthSocialButtons isLoading={formState.isLoading} onQuickLogin={handleQuickFill} />

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

function AuthSignUp({ onSignIn, defaultRole = "worker" }: AuthSignUpProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(defaultRole);
  const [avatarPreview, setAvatarPreview] = React.useState<string>(
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [submittedRequest, setSubmittedRequest] = React.useState<SubmittedRequestData | null>(null);

  const [formState, setFormState] = React.useState<FormState>({
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      badgeId: "",
      designation: "",
      station: "",
      radioChannel: "",
      phone: "",
    },
  });

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
        badgeId: data.badgeId,
        designation: data.designation,
        station: data.station,
        radioChannel: data.radioChannel,
        phone: data.phone,
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
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Create Account Request</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your official oilfield credentials. All requests require verification by an existing HSE Manager.
        </p>
      </div>

      {/* Role Selection Switcher */}
      <div className="mb-5 space-y-1.5">
        <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Requested Role
        </Label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
          <button
            type="button"
            onClick={() => setSelectedRole("worker")}
            className={cn(
              "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "worker"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <User className="h-3.5 w-3.5" />
            Field Officer
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("manager")}
            className={cn(
              "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              selectedRole === "manager"
                ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            HSE Manager
          </button>
        </div>
      </div>

      {/* Profile Picture Upload */}
      <div className="flex flex-col items-center justify-center space-y-1.5 mb-5">
        <div
          className="relative group cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          title="Click to upload profile photo"
        >
          <Avatar className="h-16 w-16 border-2 border-zinc-200 shadow-sm transition-transform group-hover:scale-105">
            <AvatarImage src={avatarPreview} alt="Profile preview" />
            <AvatarFallback>
              <User className="h-7 w-7 text-zinc-400" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-4 w-4 text-white" />
            <span className="text-[9px] text-white font-medium mt-0.5">Change</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
        <span className="text-[11px] text-zinc-500 font-medium">Profile Photo</span>
      </div>

      <AuthError message={formState.error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        {/* Section 1: Basic Credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              1. Basic Credentials
            </span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Debajit Saikia"
                disabled={formState.isLoading}
                className={cn(errors.name && "border-destructive")}
                {...register("name")}
              />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-medium">Official Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. debajit.saikia@oilindia.in"
                disabled={formState.isLoading}
                className={cn(errors.email && "border-destructive")}
                {...register("email")}
              />
              {errors.email && <p className="text-[11px] text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={formState.showPassword ? "text" : "password"}
                placeholder="•••••••• (Min 6 chars)"
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
            {errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}
          </div>
        </div>

        {/* Section 2: Operational Clearance & Field Telecom */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              2. Operational Clearance & Telecom
            </span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Badge ID Input */}
            <div className="space-y-1">
              <Label htmlFor="badgeId" className="text-xs font-medium flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-neutral-500" />
                <span>Employee / Badge ID</span>
              </Label>
              <Input
                id="badgeId"
                type="text"
                placeholder="e.g. OIL-FLD-5542"
                disabled={formState.isLoading}
                className={cn("font-mono text-xs", errors.badgeId && "border-destructive")}
                {...register("badgeId")}
              />
              {errors.badgeId && <p className="text-[11px] text-destructive">{errors.badgeId.message}</p>}
            </div>

            {/* Official Designation Input */}
            <div className="space-y-1">
              <Label htmlFor="designation" className="text-xs font-medium flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-neutral-500" />
                <span>Official Designation</span>
              </Label>
              <Input
                id="designation"
                type="text"
                placeholder="e.g. HSE Field Safety Officer"
                disabled={formState.isLoading}
                className={cn("text-xs", errors.designation && "border-destructive")}
                {...register("designation")}
              />
              {errors.designation && <p className="text-[11px] text-destructive">{errors.designation.message}</p>}
            </div>
          </div>

          {/* Station Base Input */}
          <div className="space-y-1">
            <Label htmlFor="station" className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-500" />
              <span>Assigned Rig / Station Base</span>
            </Label>
            <Input
              id="station"
              type="text"
              placeholder="e.g. Moran Rig #04 • Wellhead Section"
              disabled={formState.isLoading}
              className={cn("text-xs", errors.station && "border-destructive")}
              {...register("station")}
            />
            {errors.station && <p className="text-[11px] text-destructive">{errors.station.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tactical Radio Channel Input */}
            <div className="space-y-1">
              <Label htmlFor="radioChannel" className="text-xs font-medium flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-neutral-500" />
                <span>Tactical Radio Channel</span>
              </Label>
              <Input
                id="radioChannel"
                type="text"
                placeholder="e.g. UHF CH-04"
                disabled={formState.isLoading}
                className={cn("font-mono text-xs", errors.radioChannel && "border-destructive")}
                {...register("radioChannel")}
              />
              {errors.radioChannel && <p className="text-[11px] text-destructive">{errors.radioChannel.message}</p>}
            </div>

            {/* Emergency Contact Phone Input */}
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-500" />
                <span>Emergency Contact / Phone</span>
              </Label>
              <Input
                id="phone"
                type="text"
                placeholder="e.g. +91 94350 44521"
                disabled={formState.isLoading}
                className={cn("font-mono text-xs", errors.phone && "border-destructive")}
                {...register("phone")}
              />
              {errors.phone && <p className="text-[11px] text-destructive">{errors.phone.message}</p>}
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full mt-4 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold cursor-pointer" disabled={formState.isLoading}>
          {formState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting Clearance Request...
            </>
          ) : (
            "Submit Verification Request"
          )}
        </Button>
      </AuthForm>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already verified?{" "}
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
  AuthSocialButtons,
  AuthSeparator,
};
