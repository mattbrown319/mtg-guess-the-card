"use client";

import { useState, useEffect, useCallback } from "react";

interface TimerProps {
  startedAt: number;
  timeLimitSeconds: number;
  onExpire: () => void;
}

export default function Timer({
  startedAt,
  timeLimitSeconds,
  onExpire,
}: TimerProps) {
  const getRemaining = useCallback(() => {
    if (timeLimitSeconds === 0) return Infinity;
    const elapsed = (Date.now() - startedAt) / 1000;
    return Math.max(0, timeLimitSeconds - elapsed);
  }, [startedAt, timeLimitSeconds]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (timeLimitSeconds === 0) return;

    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeLimitSeconds, getRemaining, onExpire]);

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
            : "text-[var(--text-primary)]"
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
