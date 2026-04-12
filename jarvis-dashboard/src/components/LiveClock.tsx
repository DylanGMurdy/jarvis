"use client";

import { useState, useEffect } from "react";

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const time = now.toLocaleTimeString("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="hidden md:flex flex-col items-end leading-tight px-3 border-r border-jarvis-border/50">
      <span className="text-sm font-mono text-jarvis-text tabular-nums tap-target-auto">{time}</span>
      <span className="text-[10px] text-jarvis-muted tap-target-auto">{date} · SLC</span>
    </div>
  );
}
