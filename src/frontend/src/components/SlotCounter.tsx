import { cn } from "@/lib/utils";
import React from "react";

interface SlotCounterProps {
  remaining: number;
  cap: number;
  className?: string;
}

type SlotStatus = "good" | "warning" | "full";

function getStatus(remaining: number, cap: number): SlotStatus {
  if (remaining === 0) return "full";
  if (cap === 0) return "good";
  if (remaining / cap <= 0.5) return "warning";
  return "good";
}

const STATUS_CONFIG = {
  good: {
    ring: "stroke-success",
    text: "text-success",
    bg: "bg-success/10",
    label: null,
  },
  warning: {
    ring: "stroke-warning",
    text: "text-warning",
    bg: "bg-warning/10",
    label: null,
  },
  full: {
    ring: "stroke-danger",
    text: "text-danger",
    bg: "bg-danger/10",
    label: "FULL",
  },
} as const;

export default function SlotCounter({
  remaining,
  cap,
  className,
}: SlotCounterProps) {
  const status = getStatus(remaining, cap);
  const config = STATUS_CONFIG[status];
  const used = cap - remaining;

  // SVG ring dimensions
  const size = 200;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPct = cap > 0 ? used / cap : 0;
  const dashOffset = circumference * (1 - fillPct);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Ring + number */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn(config.ring, "transition-all duration-700 ease-out")}
          />
        </svg>

        {/* Center content */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center rounded-full",
            config.bg,
          )}
        >
          {status === "full" ? (
            <span
              className={cn(
                "font-mono text-3xl font-bold tracking-tight",
                config.text,
                "animate-slot-pulse",
              )}
            >
              FULL
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "font-mono text-5xl font-bold tabular-nums leading-none",
                  config.text,
                )}
              >
                {remaining}
              </span>
              <span className="text-muted-foreground text-xs font-medium mt-1 tracking-widest uppercase">
                remaining
              </span>
            </>
          )}
        </div>
      </div>

      {/* Used / Cap label */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground font-medium">
          <span className="font-mono font-semibold text-foreground">
            {used}
          </span>
          {" of "}
          <span className="font-mono font-semibold text-foreground">{cap}</span>
          {" slots used"}
        </p>
      </div>
    </div>
  );
}
