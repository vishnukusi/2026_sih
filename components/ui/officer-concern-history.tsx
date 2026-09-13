"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type CardData, type ColumnData } from "@/types/concerns";
import { type UserSessionData } from "./auth-form-1";
import { CardDetailModal } from "./card-detail-modal";
import { GlassmorphismProfileCard } from "./profile-card-1";


interface OfficerConcernHistoryProps {
  user: UserSessionData | null;
  onLogNewConcern?: () => void;
}

export function OfficerConcernHistory({ user, onLogNewConcern }: OfficerConcernHistoryProps) {
  const [board, setBoard] = React.useState<ColumnData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStage, setSelectedStage] = React.useState<string>("all");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [inspectCardInfo, setInspectCardInfo] = React.useState<{ card: CardData; columnTitle: string; columnId: string } | null>(null);

  const toggleExpand = (cardId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allCards.map(({ card }) => card.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const fetchConcerns = React.useCallback(async () => {
    if (!user?.email && !user?.name) {
      setBoard([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (user.email) params.set("officerEmail", user.email);
      if (user.name) params.set("officerName", user.name);

      const res = await fetch(`/api/concerns?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.board)) {
        setBoard(json.board);
      }
    } catch (err) {
      console.warn("Failed to fetch concerns history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, user?.name]);

  React.useEffect(() => {
    fetchConcerns();
    const interval = setInterval(fetchConcerns, 5000);
    return () => clearInterval(interval);
  }, [fetchConcerns]);

  // Flatten all cards with their current column context
  const allCards = React.useMemo(() => {
    const list: { card: CardData; columnTitle: string; columnId: string }[] = [];
    board.forEach((col) => {
      (col.cards || []).forEach((c) => {
        list.push({
          card: c,
          columnTitle: col.title,
          columnId: col.id,
        });
      });
    });
    return list;
  }, [board]);

  // Filter cards matching this field officer ONLY - strictly private isolation
  const officerCards = React.useMemo(() => {
    if (!user) return [];

    const userEmail = (user.email || "").toLowerCase().trim();
    const userName = (user.name || "").toLowerCase().trim();

    return allCards.filter(({ card }) => {
      const repEmail = (card.reporter?.email || "").toLowerCase().trim();
      const repName = (card.reporter?.name || "").toLowerCase().trim();

      // 1. Primary Authority: Match exact officer account email
      if (userEmail && repEmail) {
        return repEmail === userEmail;
      }

      // 2. Fallback: Match full name if card reporter email was not recorded
      if (userName && repName && !repEmail) {
        return repName === userName;
      }

      return false;
    });
  }, [allCards, user]);

  // Apply stage filter and search filter
  const filteredCards = React.useMemo(() => {
    return officerCards.filter(({ card, columnTitle }) => {
      // Stage filter
      if (selectedStage !== "all") {
        if (selectedStage === "todo" && columnTitle !== "To Do") return false;
        if (selectedStage === "inprogress" && columnTitle !== "In Progress") return false;
        if (selectedStage === "done" && columnTitle !== "Done") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = card.title.toLowerCase().includes(q);
        const obsMatch = (card.observation || card.description || "").toLowerCase().includes(q);
        const hazardMatch = (card.hazard || "").toLowerCase().includes(q);
        const idMatch = card.id.toLowerCase().includes(q);
        const reviewerMatch = (card.reviewer?.name || "").toLowerCase().includes(q);
        return titleMatch || obsMatch || hazardMatch || idMatch || reviewerMatch;
      }

      return true;
    });
  }, [officerCards, selectedStage, searchQuery]);

  // Compute stage counts
  const stageCounts = React.useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;

    officerCards.forEach(({ columnTitle }) => {
      if (columnTitle === "To Do") todo++;
      else if (columnTitle === "In Progress") inProgress++;
      else if (columnTitle === "Done") done++;
    });

    return { total: officerCards.length, todo, inProgress, done };
  }, [officerCards]);

  const getStageBadge = (columnTitle: string) => {
    switch (columnTitle) {
      case "To Do":
        return {
          label: "Stage 1: Flagged SIF-P (To Do)",
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          step: 1,
          description: "Observation logged. Awaiting manager triage & work-order dispatch.",
        };
      case "In Progress":
        return {
          label: "Stage 2: Action Assigned (In Progress)",
          bg: "bg-purple-50 text-purple-800 border-purple-200",
          step: 2,
          description: "HSE Manager has assigned field corrective actions, barricading, or audit.",
        };
      case "Done":
        return {
          label: "Stage 3: Barrier Restored (Verified & Closed)",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          step: 3,
          description: "Safety barrier confirmed restored. Manager completed verification audit.",
        };
      default:
        return {
          label: columnTitle,
          bg: "bg-neutral-100 text-neutral-800 border-neutral-200",
          step: 1,
          description: "Safety concern recorded in registry.",
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/70 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Concern History
          </h1>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-neutral-100">
          {/* Stage Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedStage("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                selectedStage === "all"
                  ? "bg-neutral-900 text-white shadow-xs"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/70"
              )}
            >
              <span>All Concerns</span>
              <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-bold", selectedStage === "all" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700")}>
                {stageCounts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStage("inprogress")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border",
                selectedStage === "inprogress"
                  ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                  : "bg-neutral-100/80 text-neutral-600 border-neutral-200/70 hover:bg-neutral-200/70"
              )}
            >
              <span>In Progress</span>
              <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-bold", selectedStage === "inprogress" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700")}>
                {stageCounts.inProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStage("done")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border",
                selectedStage === "done"
                  ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                  : "bg-neutral-100/80 text-neutral-600 border-neutral-200/70 hover:bg-neutral-200/70"
              )}
            >
              <span>Closed</span>
              <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-bold", selectedStage === "done" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700")}>
                {stageCounts.done}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search observation, hazard, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs bg-white h-8.5 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredCards.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center w-full py-16">
            {searchQuery || selectedStage !== "all" ? "No Match Found" : "No concerns submitted yet"}
          </p>
        ) : (
          <div className="space-y-3.5 max-w-5xl mx-auto">
            {/* List Controls & Counter */}
            <div className="flex items-center justify-between px-1 pb-1 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-800">
                  {filteredCards.length} {filteredCards.length === 1 ? "Concern Record" : "Concern Records"}
                </span>
                <span>•</span>
                <span className="text-neutral-400">Click any card to expand full lifecycle details</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer transition-colors"
                >
                  Expand All
                </button>
                <span className="text-neutral-300">•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {filteredCards.map(({ card, columnTitle, columnId }) => {
              const stage = getStageBadge(columnTitle);
              const isExpanded = expandedIds.has(card.id);

              return (
                <div
                  key={card.id}
                  className={cn(
                    "bg-white border rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs",
                    isExpanded
                      ? "border-neutral-300 ring-1 ring-neutral-200 shadow-xs"
                      : "border-neutral-200/90 hover:border-neutral-300 hover:shadow-xs"
                  )}
                >
                  {/* Clickable Header: Clicking toggles card expansion */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(card.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(card.id);
                      }
                    }}
                    className="w-full text-left p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/70 transition-colors select-none group"
                  >
                    {/* Left: Ref Badge, Hazard Title, Snippet, Date */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200",
                            isExpanded
                              ? "bg-neutral-900 text-white border-neutral-900 rotate-180"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200 group-hover:bg-neutral-200 group-hover:text-neutral-900"
                          )}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                            REF: #{card.id.slice(-6).toUpperCase()}
                          </span>
                          {card.voiceNoteUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              🎙️ Voice Note
                            </span>
                          )}
                          <span className="text-xs text-neutral-400">•</span>
                          <span className="text-xs text-neutral-500 font-medium">
                            {card.reportedAt || card.date || "Sep 06, 2026"}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-neutral-900 truncate group-hover:text-neutral-950">
                          {card.hazard || card.title}
                        </h3>

                        {!isExpanded && (
                          <p className="text-xs text-neutral-500 truncate max-w-2xl">
                            {card.observation || card.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Expand/Collapse */}
                    <div className="flex items-center shrink-0 ml-11 md:ml-0">
                      <span className="text-xs font-semibold text-neutral-500 group-hover:text-neutral-900 hidden sm:inline">
                        {isExpanded ? "Collapse" : "Expand"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded View: Strictly Recommended Actions -> Timeline -> Reviewing Manager */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3 space-y-4 border-t border-neutral-100 bg-neutral-50/40 animate-in fade-in slide-in-from-top-1 duration-200">
                      {/* Voice Note Audio Memo Player */}
                      {card.voiceNoteUrl && (
                        <div className="p-3.5 rounded-xl bg-neutral-900 text-white space-y-2 border border-neutral-800 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                              🎙️ Officer Voice Note Dispatch
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">
                              AUDIO RECORDING
                            </span>
                          </div>
                          <audio
                            controls
                            src={card.voiceNoteUrl}
                            className="w-full h-8 rounded accent-emerald-500"
                          />
                        </div>
                      )}
                      {/* 1. Recommended Actions & Mitigations */}
                      {card.llmSuggestions && card.llmSuggestions.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                            <span>Recommended Actions & Mitigations</span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white border border-neutral-200/80 space-y-2.5 shadow-2xs">
                            {card.llmSuggestions.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-neutral-700">
                                <span className="w-4.5 h-4.5 rounded-full bg-neutral-100 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 text-neutral-800 border border-neutral-200">
                                  {idx + 1}
                                </span>
                                <p className="flex-1 leading-relaxed">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. Timeline Checkpoints: Reported, Assigned, Closed */}
                      <div className="bg-white border border-neutral-200/80 rounded-xl p-4 space-y-3.5 shadow-2xs">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                          <span>Timeline Stage</span>
                          <span className="font-mono text-neutral-400">Step {stage.step} of 3</span>
                        </div>

                        {/* Timeline Checkpoints (No connecting lines) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                          {/* Checkpoint 1: Reported */}
                          <div
                            className={cn(
                              "flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl border transition-all",
                              stage.step >= 1
                                ? "bg-neutral-900 border-neutral-800"
                                : "bg-neutral-50/50 border-neutral-200/60"
                            )}
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 mb-1.5",
                                stage.step >= 1
                                  ? "bg-emerald-500 text-white border-emerald-400"
                                  : "bg-white text-neutral-400 border-neutral-300"
                              )}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                            <span
                              className={cn(
                                "text-xs font-bold leading-tight",
                                stage.step >= 1 ? "text-white" : "text-neutral-400"
                              )}
                            >
                              Reported
                            </span>
                          </div>

                          {/* Checkpoint 2: In Progress */}
                          <div
                            className={cn(
                              "flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl border transition-all",
                              stage.step >= 2
                                ? "bg-neutral-900 border-neutral-800"
                                : "bg-neutral-50/50 border-neutral-200/60"
                            )}
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 mb-1.5",
                                stage.step >= 2
                                  ? "bg-emerald-500 text-white border-emerald-400"
                                  : "bg-white text-neutral-400 border-neutral-300"
                              )}
                            >
                              {stage.step >= 2 ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "2"}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-bold leading-tight",
                                stage.step >= 2 ? "text-white" : "text-neutral-400"
                              )}
                            >
                              In Progress
                            </span>
                          </div>

                          {/* Checkpoint 3: Closed */}
                          <div
                            className={cn(
                              "flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl border transition-all",
                              stage.step === 3
                                ? "bg-neutral-900 border-neutral-800"
                                : "bg-neutral-50/50 border-neutral-200/60"
                            )}
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 mb-1.5",
                                stage.step === 3
                                  ? "bg-emerald-500 text-white border-emerald-400"
                                  : "bg-white text-neutral-400 border-neutral-300"
                              )}
                            >
                              {stage.step === 3 ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "3"}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-bold leading-tight",
                                stage.step === 3 ? "text-white" : "text-neutral-400"
                              )}
                            >
                              Closed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Reviewing HSE Manager — rendered as a profile card only when assigned, otherwise shows Awaiting Review */}
                      {card.reviewer ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                            <span>Reviewing HSE Manager</span>
                          </div>
                          <div className="flex justify-center">
                            <GlassmorphismProfileCard
                              theme="project"
                              size="small"
                              avatarUrl={
                                card.reviewer.avatarUrl ||
                                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                              }
                              name={card.reviewer.name}
                              title={card.reviewer.role || "HSE Manager"}
                              bio={
                                card.reviewer.station
                                  ? `Overseeing safety, barrier control, and corrective actions at ${card.reviewer.station}.`
                                  : "Overseeing safety, barrier control, and corrective actions."
                              }
                              metaDetails={[
                                ...(card.reviewer.station
                                  ? [{ label: "Station", value: card.reviewer.station }]
                                  : []),
                                ...(card.reviewer.radioChannel
                                  ? [{ label: "Radio", value: card.reviewer.radioChannel }]
                                  : []),
                                ...(card.reviewer.email
                                  ? [{ label: "Email", value: card.reviewer.email }]
                                  : []),
                              ]}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                            <span>Reviewing HSE Manager</span>
                          </div>
                          <div className="p-3.5 bg-neutral-50 rounded-xl border border-dashed border-neutral-300 text-center flex items-center justify-center">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                              AWAITING FOR MANAGER REVIEW
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Safety Card Detail Modal */}
      {inspectCardInfo && (
        <CardDetailModal
          card={inspectCardInfo.card}
          columnTitle={inspectCardInfo.columnTitle}
          columnId={inspectCardInfo.columnId}
          onClose={() => setInspectCardInfo(null)}
          onMoveColumn={() => {}}
          onDeleteCard={() => {}}
          currentManager={user}
        />
      )}
    </div>
  );
}
