import * as React from "react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";

// --- SVG Icons ---

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MastercardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="36"
    height="24"
  >
    <circle cx="8" cy="12" r="7" fill="#EA001B"></circle>
    <circle cx="16" cy="12" r="7" fill="#F79E1B" fillOpacity="0.8"></circle>
  </svg>
);

// --- Helper Components ---

const DashedLine = () => (
  <div
    className="w-full border-t-2 border-dashed border-border"
    aria-hidden="true"
  />
);

const Barcode = ({ value }: { value: string }) => {
  const hashCode = (s: string) =>
    s.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
  const seed = hashCode(value);
  const random = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const bars = Array.from({ length: 60 }).map((_, index) => {
    const rand = random(seed + index);
    const width = rand > 0.7 ? 2.5 : 1.5;
    return { width };
  });

  const spacing = 1.5;
  const totalWidth = bars.reduce((acc, bar) => acc + bar.width + spacing, 0) - spacing;
  const svgWidth = 250;
  const svgHeight = 70;
  let currentX = (svgWidth - totalWidth) / 2;

  return (
    <div className="flex flex-col items-center py-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        aria-label={`Barcode for value ${value}`}
        className="fill-current text-foreground"
      >
        {bars.map((bar, index) => {
          const x = currentX;
          currentX += bar.width + spacing;
          return (
            <rect
              key={index}
              x={x}
              y="10"
              width={bar.width}
              height="50"
            />
          );
        })}
      </svg>
      <p className="text-sm text-muted-foreground tracking-[0.3em] mt-2">{value}</p>
    </div>
  );
};

const CONFETTI_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#f97316"];

const ConfettiExplosion = () => {
  const confettiCount = 100;

  const particles = React.useMemo(() => {
    return Array.from({ length: confettiCount }).map((_, i) => {
      // Deterministic pseudo-random seed per index
      const seed1 = Math.abs(Math.sin(i * 997.13 + 12.34));
      const seed2 = Math.abs(Math.cos(i * 443.21 + 56.78));
      const seed3 = Math.abs(Math.sin(i * 123.45 + 98.76));
      return {
        left: `${seed1 * 100}%`,
        top: `${-20 + seed2 * 10}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${seed3 * 360}deg`,
        duration: `${2.5 + seed1 * 2.5}s`,
        delay: `${seed2 * 2}s`,
      };
    });
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes fall {
            0% {
                transform: translateY(-10vh) rotate(0deg);
                opacity: 1;
            }
            100% {
              transform: translateY(110vh) rotate(720deg);
              opacity: 0;
            }
          }
        `}
      </style>
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute w-2 h-4"
            style={{
              left: p.left,
              top: p.top,
              backgroundColor: p.color,
              transform: `rotate(${p.rotate})`,
              animation: `fall ${p.duration} ${p.delay} linear forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
};

// --- Main Ticket Component ---

export interface TicketProps extends React.HTMLAttributes<HTMLDivElement> {
  ticketId: string;
  amount?: number;
  date?: Date;
  cardHolder?: string;
  last4Digits?: string;
  barcodeValue: string;
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  metaLabel?: string;
  metaValue?: string;
  observation?: string;
  officerBadge?: string;
  officerStation?: string;
  variant?: "default" | "critical";
  hasVoiceNote?: boolean;
  onReset?: () => void;
  onViewHistory?: () => void;
}

const AnimatedTicket = React.forwardRef<HTMLDivElement, TicketProps>(
  (
    {
      className,
      ticketId,
      amount,
      date = new Date(),
      cardHolder = "Field Officer",
      last4Digits = "8237",
      barcodeValue,
      icon,
      variant = "default",
      title = "Thank you!",
      subtitle = "Your concern has been recorded successfully",
      metaLabel,
      metaValue,
      observation,
      officerBadge = "OIL-FLD-5542",
      officerStation = "Moran Rig #04",
      hasVoiceNote = false,
      onReset,
      onViewHistory,
      ...props
    },
    ref
  ) => {
    const [showConfetti, setShowConfetti] = React.useState(false);

    React.useEffect(() => {
      const mountTimer = setTimeout(() => setShowConfetti(true), 100);
      const unmountTimer = setTimeout(() => setShowConfetti(false), 6000);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(unmountTimer);
      };
    }, []);

    const formattedAmount =
      amount !== undefined
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(amount)
        : null;

    const formattedDate = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(",", " •");

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
        <div
          ref={ref}
          className={cn(
            "relative w-full max-w-sm bg-card text-card-foreground rounded-2xl shadow-lg font-sans z-10 border border-neutral-200/80 bg-white",
            "animate-in fade-in-0 zoom-in-95 duration-500",
            className
          )}
          {...props}
        >
          {/* Ticket cut-out effect */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neutral-100 border-r border-neutral-200/80" />
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neutral-100 border-l border-neutral-200/80" />

          <div className="p-8 flex flex-col items-center text-center">
            <div
              className={cn(
                "p-3 rounded-full animate-in zoom-in-50 delay-300 duration-500 ring-4",
                variant === "critical"
                  ? "bg-red-50 text-red-600 ring-red-500/15"
                  : "bg-emerald-50 text-emerald-600 ring-emerald-500/10"
              )}
            >
              {icon ||
                (variant === "critical" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-10 h-10 text-red-600 animate-in zoom-in-75 delay-500 duration-500"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <CheckCircleIcon className="w-10 h-10 text-emerald-600 animate-in zoom-in-75 delay-500 duration-500" />
                ))}
            </div>
            <h1 className="text-2xl font-bold mt-4 text-neutral-900 tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm text-neutral-500">
              {subtitle}
            </p>
          </div>

          <div className="px-8 pb-8 space-y-6">
            <DashedLine />

            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-xs text-muted-foreground uppercase text-neutral-400 font-medium">Ticket ID</p>
                <p className="font-mono font-semibold text-neutral-900">{ticketId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase text-neutral-400 font-medium">
                  {metaLabel || (formattedAmount ? "Amount" : "Status")}
                </p>
                <p className="font-semibold text-base text-neutral-900">
                  {metaValue || formattedAmount || "Dispatched"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase text-neutral-400 font-medium">Date & Time</p>
              <p className="font-medium text-neutral-800 text-sm">{formattedDate}</p>
            </div>

            {observation && (
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200/60 text-left">
                <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                  Logged Concern
                </p>
                <p className="text-xs italic text-neutral-700 leading-relaxed">
                  &ldquo;{observation}&rdquo;
                </p>
              </div>
            )}

            {hasVoiceNote && (
              <div className="flex items-center gap-2 p-2.5 px-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-left">
                <span className="text-base">🎙️</span>
                <span>Authentic Spoken Voice Note attached for HSE Manager review</span>
              </div>
            )}

            <div className="bg-neutral-50 p-3.5 rounded-xl flex items-center space-x-3.5 border border-neutral-200">
              <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0">
                OIL
              </div>
              <div className="flex flex-col min-w-0">
                <p className="font-bold text-neutral-900 text-xs tracking-tight truncate">
                  OIL India HSE Operational Registry
                </p>
                <p className="text-neutral-500 font-mono text-[11px] truncate">
                  Field Observer ID: {officerBadge} • {officerStation}
                </p>
              </div>
            </div>

            <DashedLine />

            <Barcode value={barcodeValue} />

            <div className="pt-2 space-y-2">
              {onViewHistory && (
                <button
                  type="button"
                  onClick={onViewHistory}
                  className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  Track Concern Stage & Manager Review
                </button>
              )}

              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  Report Another Concern
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
);

AnimatedTicket.displayName = "AnimatedTicket";

export { AnimatedTicket };
