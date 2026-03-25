"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TimerProps {
  startedAt: number;
  timeLimitSeconds: number;
  paused: boolean;
  onExpire: () => void;
}

export default function Timer({
  startedAt,
  timeLimitSeconds,
  paused,
  onExpire,
}: TimerProps) {
  const pausedTimeRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  // Track paused time
  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current) {
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }, [paused]);

  const getRemaining = useCallback(() => {
    if (timeLimitSeconds === 0) return Infinity;
    const currentPause = pauseStartRef.current
      ? Date.now() - pauseStartRef.current
      : 0;
    const elapsed =
      (Date.now() - startedAt - pausedTimeRef.current - currentPause) / 1000;
    return Math.max(0, timeLimitSeconds - elapsed);
  }, [startedAt, timeLimitSeconds]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (timeLimitSeconds === 0) return;

    const interval = setInterval(() => {
      if (!paused) {
        const r = getRemaining();
        setRemaining(r);
        if (r <= 0) {
          clearInterval(interval);
          onExpire();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeLimitSeconds, getRemaining, onExpire, paused]);

  if (timeLimitSeconds === 0) {
    return (
      <div className="text-[var(--text-secondary)] text-sm">No time limit</div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;

  return (
    <div
      className={`text-2xl font-mono font-bold tabular-nums ${
        isCritical
          ? "text-[var(--error)] animate-pulse"
          : isLow
            ? "text-[var(--warning)]"
            : paused
              ? "text-[var(--text-secondary)]"
              : "text-[var(--text-primary)]"
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
