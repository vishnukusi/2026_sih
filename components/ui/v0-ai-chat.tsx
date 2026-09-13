"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    ArrowUpIcon,
    Loader2,
    RefreshCw,
    XCircle,
    Mic,
    X,
    Check,
    Globe,
    Sparkles,
    Play,
    Pause,
    Trash2,
    AudioWaveform,
} from "lucide-react";
import { AnimatedTicket } from "./ticket-confirmation-card";
import { type UserSessionData } from "./auth-form-1";
import { SiriWave, type SiriWaveVariant } from "./siri-wave";

interface ISpeechRecognitionEvent {
    resultIndex: number;
    results: {
        length: number;
        [index: number]: {
            isFinal: boolean;
            [index: number]: {
                transcript: string;
            };
        };
    };
}

interface ISpeechRecognitionErrorEvent {
    error: string;
}

interface ISpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: ISpeechRecognitionEvent) => void;
    onerror: (event: ISpeechRecognitionErrorEvent) => void;
    onend: () => void;
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );
            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

// Authentic Web Audio chime replicating UPI confirmation sound
function playConfirmationChime() {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, now);
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(783.99, now + 0.12);
        osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.24);
        gain2.gain.setValueAtTime(0.25, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.75);
    } catch {
        // Fallback if blocked
    }
}

function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface VercelV0ChatProps {
    user?: UserSessionData | null;
    onViewHistory?: () => void;
}

export function VercelV0Chat({ user, onViewHistory }: VercelV0ChatProps = {}) {
    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [lastAnalyzedObservation, setLastAnalyzedObservation] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [referenceCode, setReferenceCode] = useState<string>("");
    const [submittedInfo, setSubmittedInfo] = useState<{
        sifScore: number;
        isAutoEscalated: boolean;
        hazard?: string;
        hadVoiceNote?: boolean;
    } | null>(null);

    // Voice & SiriWave Modal State
    const [isVoiceOpen, setIsVoiceOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [speechTranscript, setSpeechTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [voiceDuration, setVoiceDuration] = useState(0);
    const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<"en-IN" | "hi-IN" | "en-US">("en-IN");
    const [waveVariant, setWaveVariant] = useState<SiriWaveVariant>("wave");
    const [micError, setMicError] = useState<string | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);

    const recognitionRef = useRef<ISpeechRecognition | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
    const isRecordingRef = useRef(false);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    // Cleanup resources on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {}
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Start Voice Input & SiriWave
    const startVoiceInput = async (lang = selectedLanguage) => {
        setMicError(null);
        setSpeechTranscript("");
        setInterimTranscript("");
        setIsVoiceOpen(true);
        setIsRecording(true);
        isRecordingRef.current = true;
        setVoiceDuration(0);
        audioChunksRef.current = [];

        // 1. Timer
        if (timerRef.current) clearInterval(timerRef.current);
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
            setVoiceDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        // 2. HTML5 MediaRecorder
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = stream;
                const recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    if (audioChunksRef.current.length > 0) {
                        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64 = reader.result as string;
                            setVoiceNoteUrl(base64);
                        };
                        reader.readAsDataURL(blob);
                    }
                    if (mediaStreamRef.current) {
                        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                        mediaStreamRef.current = null;
                    }
                };

                recorder.start(250);
            }
        } catch (mediaErr: unknown) {
            const err = mediaErr as { name?: string };
            console.warn("Microphone access error:", mediaErr);
            if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
                setMicError("Microphone access was blocked. Please enable microphone permissions in your browser address bar.");
            } else {
                setMicError("Unable to access microphone on this device.");
            }
        }

        // 3. Web Speech API Recognition
        try {
            const SpeechRecognitionConstructor =
                typeof window !== "undefined"
                    ? ((window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
                       (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition)
                    : null;

            if (SpeechRecognitionConstructor) {
                const rec = new SpeechRecognitionConstructor();
                recognitionRef.current = rec;
                rec.continuous = true;
                rec.interimResults = true;
                rec.lang = lang;

                rec.onresult = (event: ISpeechRecognitionEvent) => {
                    let interim = "";
                    let final = "";

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            final += transcript + " ";
                        } else {
                            interim += transcript;
                        }
                    }

                    if (final) {
                        setSpeechTranscript((prev) => {
                            const trimmed = final.trim();
                            if (!prev) return trimmed;
                            return `${prev} ${trimmed}`;
                        });
                    }
                    setInterimTranscript(interim);
                };

                rec.onerror = (event: ISpeechRecognitionErrorEvent) => {
                    if (event.error === "no-speech") return;
                    if (event.error === "not-allowed") {
                        setMicError("Microphone permission was denied. Please permit mic access in your browser.");
                    }
                };

                rec.onend = () => {
                    if (isRecordingRef.current && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch {}
                    }
                };

                rec.start();
            } else {
                setMicError("Live dictation is optimized for Chrome, Edge, and Safari. Your audio will still be recorded!");
            }
        } catch (speechErr) {
            console.warn("Speech recognition initialization error:", speechErr);
        }
    };

    // Stop Voice Input
    const closeVoiceModal = (commitText: boolean = true) => {
        setIsRecording(false);
        isRecordingRef.current = false;
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {}
            recognitionRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch {}
        }

        if (commitText) {
            const fullSpoken = `${speechTranscript} ${interimTranscript}`.trim();
            if (fullSpoken) {
                setValue((prev) => {
                    const existing = prev.trim();
                    if (!existing) return fullSpoken;
                    return `${existing}\n${fullSpoken}`;
                });
                setTimeout(() => adjustHeight(), 50);
            }
        }

        setIsVoiceOpen(false);
    };

    // Directly Submit Concern from Voice Modal
    const submitDirectlyFromVoice = () => {
        const fullSpoken = `${speechTranscript} ${interimTranscript}`.trim();
        const finalQuery = (fullSpoken || value).trim();
        closeVoiceModal(true);
        if (finalQuery) {
            handleAnalyze(finalQuery);
        }
    };

    // Change language while voice modal is open
    const changeLanguage = (newLang: "en-IN" | "hi-IN" | "en-US") => {
        setSelectedLanguage(newLang);
        if (isRecording) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {}
            }
            startVoiceInput(newLang);
        }
    };

    // Toggle Preview of Voice Note in Main Input Box
    const togglePlayPreview = () => {
        if (!audioPreviewRef.current && voiceNoteUrl) {
            const audio = new Audio(voiceNoteUrl);
            audioPreviewRef.current = audio;
            audio.onended = () => setIsPlayingPreview(false);
            audio.play();
            setIsPlayingPreview(true);
        } else if (audioPreviewRef.current) {
            if (isPlayingPreview) {
                audioPreviewRef.current.pause();
                setIsPlayingPreview(false);
            } else {
                audioPreviewRef.current.play();
                setIsPlayingPreview(true);
            }
        }
    };

    const clearVoiceNote = () => {
        if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
            audioPreviewRef.current = null;
        }
        setVoiceNoteUrl(null);
        setVoiceDuration(0);
        setIsPlayingPreview(false);
    };

    const handleAnalyze = async (textToAnalyze?: string) => {
        const query = (textToAnalyze ?? value).trim();
        if (!query || isLoading) return;

        setIsLoading(true);
        setError(null);
        setLastAnalyzedObservation(query);

        try {
            const reporterPayload = user
                ? {
                      name: user.name,
                      role:
                          user.designation ||
                          (user.role === "worker"
                              ? "HSE Field Safety Officer (Derrick Floor)"
                              : "HSE Operations Manager"),
                      email: user.email,
                      station: user.station || "Moran Rig #04 • Wellhead Section",
                      radioChannel: user.radioChannel || "UHF CH-04",
                      badgeId: user.badgeId || "OIL-FLD-5542",
                      phone: user.phone || "+91 94350 44521",
                      avatarUrl: user.avatarUrl,
                  }
                : undefined;

            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    observation: query,
                    reporter: reporterPayload,
                    voiceNoteUrl: voiceNoteUrl || undefined,
                }),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || "Failed to log concern.");
            }

            // Generate clean reference code
            const ref = `OIL-HSE-${Math.floor(100000 + Math.random() * 900000)}`;
            setReferenceCode(ref);

            const score = json.data?.sif_score ?? json.concernCard?.sif_score ?? 0;
            const autoEscalated = Boolean(json.autoEscalated || score > 75 || json.concernCard?.status === "In Progress");

            setSubmittedInfo({
                sifScore: score,
                isAutoEscalated: autoEscalated,
                hazard: json.data?.hazard || json.concernCard?.hazard,
                hadVoiceNote: Boolean(voiceNoteUrl),
            });

            // Play confirmation chime
            playConfirmationChime();

            setIsSubmitted(true);
            setValue("");
            adjustHeight(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleAnalyze();
        }
    };

    return (
        <div className="relative w-full h-full min-h-full flex-1 flex flex-col items-center justify-center p-4">
            {isSubmitted ? (
                /* Ticket Confirmation Card with Confetti Explosion */
                <div className="w-full flex items-center justify-center my-auto animate-in fade-in zoom-in-95 duration-500">
                    <AnimatedTicket
                        ticketId={referenceCode}
                        date={new Date()}
                        cardHolder={user?.name ? `${user.name} (${user.badgeId || "OIL-FLD"})` : "Field Officer (OIL)"}
                        last4Digits={user?.badgeId ? user.badgeId.slice(-4) : "5542"}
                        barcodeValue={referenceCode.replace(/\D/g, "") || "928374829104"}
                        variant={submittedInfo?.isAutoEscalated ? "critical" : "default"}
                        title={
                            submittedInfo?.isAutoEscalated
                                ? "CRITICAL SIF • AUTO-ESCALATED"
                                : "YOUR CONCERN IS RECORDED."
                        }
                        subtitle={
                            submittedInfo?.isAutoEscalated
                                ? `High fatal potential hazard detected (SIF Score: ${submittedInfo.sifScore} > 75). Automatically routed directly to 'In Progress' for immediate intervention.`
                                : "THANKS FOR REPORTING."
                        }
                        metaLabel="Dispatch Routing"
                        metaValue={
                            submittedInfo?.isAutoEscalated
                                ? "⚡ IN PROGRESS (Auto)"
                                : (user?.station || "Moran Rig #04")
                        }
                        observation={lastAnalyzedObservation}
                        officerBadge={user?.badgeId || "OIL-FLD-5542"}
                        officerStation={user?.station || "Moran Rig #04"}
                        hasVoiceNote={submittedInfo?.hadVoiceNote}
                        onReset={() => {
                            setIsSubmitted(false);
                            setValue("");
                            setSubmittedInfo(null);
                            clearVoiceNote();
                            adjustHeight(true);
                        }}
                        onViewHistory={onViewHistory}
                    />
                </div>
            ) : (
                /* Standard Observation Input Form */
                <div className="w-full max-w-4xl mx-auto space-y-6 my-auto">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>OIL AI Safety Intelligence • Derrick Floor Intake</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
                            Report Field Safety Concern
                        </h1>
                        <p className="text-sm text-neutral-500 max-w-xl">
                            Log unsafe acts, barrier failures, or speak your observations hands-free. Real-time NLP classifies SIF Precursor density and dispatches to HSE Management.
                        </p>
                    </div>

                    {/* Input Box */}
                    <div className="w-full">
                        <div className="relative bg-white rounded-xl border border-neutral-200 shadow-sm focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-200 transition-all">
                            <div className="overflow-y-auto">
                                <Textarea
                                    ref={textareaRef}
                                    value={value}
                                    onChange={(e) => {
                                        setValue(e.target.value);
                                        adjustHeight();
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Describe an observation, near-miss report, or speak hands-free with mic..."
                                    className={cn(
                                        "w-full px-4 py-3",
                                        "resize-none",
                                        "bg-transparent",
                                        "border-none",
                                        "text-neutral-900 text-sm",
                                        "focus:outline-none",
                                        "focus-visible:ring-0 focus-visible:ring-offset-0",
                                        "placeholder:text-neutral-400 placeholder:text-sm",
                                        "min-h-[60px]"
                                    )}
                                    style={{ overflow: "hidden" }}
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Voice Note Preview Chip if Recorded */}
                            {voiceNoteUrl && (
                                <div className="px-4 pb-2 pt-1 flex items-center gap-2 animate-in fade-in duration-200">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium shadow-2xs">
                                        <button
                                            type="button"
                                            onClick={togglePlayPreview}
                                            className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 cursor-pointer shrink-0 transition-colors"
                                            title={isPlayingPreview ? "Pause voice note" : "Play voice note preview"}
                                        >
                                            {isPlayingPreview ? (
                                                <Pause className="w-3 h-3" />
                                            ) : (
                                                <Play className="w-3 h-3 ml-0.5" />
                                            )}
                                        </button>
                                        <span className="font-mono font-semibold">
                                            🎙️ Voice Dispatch Note ({formatDuration(voiceDuration)})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearVoiceNote}
                                            className="text-neutral-400 hover:text-red-600 ml-1.5 cursor-pointer p-0.5 transition-colors"
                                            title="Discard audio recording"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-neutral-400">
                                        Attached to concern payload for Manager
                                    </span>
                                </div>
                            )}

                            {/* Action Bar */}
                            <div className="flex items-center justify-between p-3 border-t border-neutral-100">
                                <div className="flex items-center gap-2">
                                    {/* SiriWave Mic Button */}
                                    <button
                                        type="button"
                                        onClick={() => startVoiceInput()}
                                        className="group px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 text-neutral-800 shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                        title="Speak your concern using Siri Wave Voice AI"
                                    >
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                        <Mic className="w-3.5 h-3.5 text-neutral-700 group-hover:text-red-600 transition-colors" />
                                        <span className="font-semibold text-neutral-700 group-hover:text-neutral-900">
                                            Speak Concern
                                        </span>
                                    </button>

                                    <span className="text-xs text-neutral-400 hidden sm:inline">
                                        Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono text-[10px]">Enter ↵</kbd> to submit
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleAnalyze()}
                                        disabled={!value.trim() || isLoading}
                                        className={cn(
                                            "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                                            value.trim() && !isLoading
                                                ? "bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs"
                                                : "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                                        )}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Submit Concern</span>
                                                <ArrowUpIcon className="w-3.5 h-3.5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
                            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold">Submission Error</p>
                                <p className="text-xs mt-0.5 text-red-600">{error}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleAnalyze()}
                                className="px-2.5 py-1 bg-white border border-red-200 hover:bg-red-100 rounded-md text-xs font-medium text-red-700 cursor-pointer flex items-center gap-1"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* SiriWave Ambient Voice Modal */}
            {isVoiceOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="relative w-full max-w-xl bg-gradient-to-b from-neutral-900 via-[#0c0c0e] to-black border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col items-center text-center space-y-5 overflow-hidden">
                        {/* Ambient glow behind SiriWave */}
                        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Top Header */}
                        <div className="w-full flex items-center justify-between border-b border-neutral-800/80 pb-4 z-10">
                            <div className="flex items-center gap-2.5">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                                <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-300">
                                    OIL Voice AI Dictation
                                </span>
                            </div>

                            {/* Timer & Close */}
                            <div className="flex items-center gap-3">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                                    {formatDuration(voiceDuration)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => closeVoiceModal(false)}
                                    className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                                    aria-label="Close voice modal"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* SiriWave Visualizer */}
                        <div className="relative z-10 flex flex-col items-center">
                            <SiriWave
                                variant={waveVariant}
                                size={260}
                                renderScale={1}
                                className="shadow-[0_0_50px_rgba(59,130,246,0.3)] rounded-2xl mx-auto border border-neutral-800/80"
                            />

                            {/* Visualizer Style Switcher */}
                            <div className="flex items-center gap-1 mt-3 p-1 bg-neutral-900/90 rounded-full border border-neutral-800 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setWaveVariant("wave")}
                                    className={cn(
                                        "px-3 py-1 rounded-full font-medium transition-all cursor-pointer",
                                        waveVariant === "wave"
                                            ? "bg-neutral-700 text-white shadow-xs"
                                            : "text-neutral-400 hover:text-neutral-200"
                                    )}
                                >
                                    iOS Waveform
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWaveVariant("fluid-dots")}
                                    className={cn(
                                        "px-3 py-1 rounded-full font-medium transition-all cursor-pointer",
                                        waveVariant === "fluid-dots"
                                            ? "bg-neutral-700 text-white shadow-xs"
                                            : "text-neutral-400 hover:text-neutral-200"
                                    )}
                                >
                                    Fluid Energy
                                </button>
                            </div>
                        </div>

                        {/* Live Transcription Readout Panel */}
                        <div className="w-full z-10 bg-neutral-900/70 border border-neutral-800/90 rounded-2xl p-4 text-left min-h-[95px] flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                    <AudioWaveform className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                                    Live Voice Transcription
                                </span>

                                {/* Language Selector */}
                                <div className="flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-neutral-400" />
                                    <select
                                        value={selectedLanguage}
                                        onChange={(e) => changeLanguage(e.target.value as "en-IN" | "hi-IN" | "en-US")}
                                        className="bg-transparent text-neutral-300 text-[11px] font-medium border-none focus:outline-none cursor-pointer"
                                    >
                                        <option value="en-IN" className="bg-neutral-900 text-white">English (India) 🇮🇳</option>
                                        <option value="hi-IN" className="bg-neutral-900 text-white">हिन्दी (Hindi) 🇮🇳</option>
                                        <option value="en-US" className="bg-neutral-900 text-white">English (US) 🌐</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 flex items-center">
                                {speechTranscript || interimTranscript ? (
                                    <p className="text-sm font-medium text-neutral-100 leading-relaxed">
                                        {speechTranscript} <span className="text-blue-400 italic">{interimTranscript}</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-neutral-500 italic">
                                        Listening... Speak your observation clearly (e.g. &ldquo;Bypassed gas alarm detected at Moran Rig #04 Derrick floor&rdquo;).
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Error notice if microphone is blocked */}
                        {micError && (
                            <div className="w-full text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-xl p-2.5 text-left z-10">
                                {micError}
                            </div>
                        )}

                        {/* Bottom Modal Actions */}
                        <div className="w-full flex items-center justify-between gap-3 pt-2 z-10">
                            <button
                                type="button"
                                onClick={() => closeVoiceModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => closeVoiceModal(true)}
                                    disabled={!speechTranscript.trim() && !interimTranscript.trim() && voiceDuration === 0}
                                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Done Speaking</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={submitDirectlyFromVoice}
                                    disabled={!speechTranscript.trim() && !interimTranscript.trim()}
                                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>Analyze Now</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
