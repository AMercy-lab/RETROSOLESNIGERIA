"use client";

import { useSyncExternalStore } from "react";

// "2h 14m left" / "Overdue by 20m"
export function formatRemaining(ms: number) {
  const mins = Math.round(Math.abs(ms) / 60000);
  const text = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return ms >= 0 ? `${text} left` : `Overdue by ${text}`;
}

// A shared clock that ticks every 30 seconds (null while rendering on the server).
const TICK = 30_000;
function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, TICK);
  return () => clearInterval(timer);
}
const getNow = () => Math.floor(Date.now() / TICK) * TICK;
const getServerNow = () => null;

export default function Countdown({ dueAt, label }: { dueAt: string; label?: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  if (now === null) return <span className="text-brand-muted">…</span>;

  const ms = Date.parse(dueAt) - now;
  const urgent = ms < 30 * 60_000;
  return (
    <span className={`font-semibold ${urgent ? "text-brand-red" : ""}`} data-testid="countdown">
      {label ? `${label}: ` : ""}
      {formatRemaining(ms)}
    </span>
  );
}
