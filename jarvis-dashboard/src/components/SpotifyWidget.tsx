"use client";

import { useState, useEffect, useRef } from "react";

interface SpotifyData {
  isPlaying: boolean;
  connected: boolean;
  appNotConfigured?: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  progressMs?: number;
  durationMs?: number;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function SpotifyWidget() {
  const [data, setData] = useState<SpotifyData | null>(null);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetched = useRef(false);

  // Single fetch function — no useCallback, no deps
  async function fetchNow() {
    try {
      const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      const j: SpotifyData = await r.json();
      console.log("[SpotifyWidget] fetched:", j.connected, j.isPlaying, j.title);
      setData(j);
      if (j.progressMs !== undefined) setProgress(j.progressMs);
    } catch {
      setData({ isPlaying: false, connected: false });
    }
  }

  // On mount: check URL, fetch, poll
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const params = new URLSearchParams(window.location.search);
    const justConnected = params.get("spotify") === "connected";
    if (justConnected) {
      window.history.replaceState({}, "", "/");
    }

    // Fetch immediately (with small delay if just connected)
    if (justConnected) {
      setTimeout(fetchNow, 800);
    } else {
      fetchNow();
    }

    // Poll every 10s
    const poll = setInterval(fetchNow, 10000);
    return () => clearInterval(poll);
  }, []);

  // Tick progress every second when playing
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (data?.isPlaying && data?.durationMs) {
      const dur = data.durationMs;
      tickRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + 1000, dur));
      }, 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [data?.isPlaying, data?.durationMs]);

  async function sendAction(action: string) {
    await fetch("/api/spotify/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "play") setData((d) => d ? { ...d, isPlaying: true } : d);
    if (action === "pause") setData((d) => d ? { ...d, isPlaying: false } : d);
    if (action === "next" || action === "previous") setTimeout(fetchNow, 600);
  }

  async function disconnect() {
    await fetch("/api/spotify/disconnect", { method: "POST" });
    setData({ isPlaying: false, connected: false });
  }

  const pct = data?.durationMs ? Math.min((progress / data.durationMs) * 100, 100) : 0;

  // ── Loading ─────────────────────────────────────────────
  if (!data) {
    return (
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#64748b] mb-3">Now Playing</h3>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-[#1e1e2e] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#1e1e2e] rounded animate-pulse w-3/4" />
            <div className="h-2 bg-[#1e1e2e] rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // ── Not connected ───────────────────────────────────────
  if (!data.connected) {
    return (
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#64748b] mb-3">Now Playing</h3>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-[#1e1e2e] flex items-center justify-center flex-shrink-0">
            <SpotifyLogo />
          </div>
          <div className="flex-1">
            {data.appNotConfigured ? (
              <p className="text-xs text-[#64748b]">Add Spotify credentials to .env.local</p>
            ) : (
              <>
                <p className="text-sm text-[#e2e8f0] mb-2">Connect Spotify</p>
                <a
                  href="/api/spotify/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white hover:scale-105 active:scale-95 transition-transform"
                  style={{ backgroundColor: "#1DB954" }}
                >
                  <SpotifyLogoSmall />
                  Connect Spotify
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Connected but not playing ───────────────────────────
  if (!data.title) {
    return (
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#64748b]">Now Playing</h3>
          <button onClick={disconnect} className="text-[10px] text-[#64748b]/50 hover:text-[#64748b]">Disconnect</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-[#1e1e2e] flex items-center justify-center"><SpotifyLogo /></div>
          <p className="text-sm text-[#64748b]">Not playing — open Spotify to start</p>
        </div>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#64748b]">Now Playing</h3>
        <button onClick={disconnect} className="text-[10px] text-[#64748b]/50 hover:text-[#64748b]">Disconnect</button>
      </div>
      <div className="flex gap-3">
        {data.albumArt ? (
          <img src={data.albumArt} alt="" className="w-14 h-14 rounded-lg flex-shrink-0 shadow-lg" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-[#1e1e2e] flex items-center justify-center"><SpotifyLogo /></div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{data.title}</p>
          <p className="text-xs text-[#64748b] truncate">{data.artist}</p>
          {/* Progress */}
          <div className="mt-2">
            <div className="w-full bg-[#1e1e2e] rounded-full h-1 mb-1">
              <div className="h-1 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: "#1DB954" }} />
            </div>
            <div className="flex justify-between text-[10px] text-[#64748b]">
              <span>{formatMs(progress)}</span>
              <span>{data.durationMs ? formatMs(data.durationMs) : ""}</span>
            </div>
          </div>
          {/* Controls */}
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => sendAction("previous")} className="text-[#64748b] hover:text-white transition-colors" title="Previous">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            <button
              onClick={() => sendAction(data.isPlaying ? "pause" : "play")}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              style={{ backgroundColor: "#1DB954" }}
              title={data.isPlaying ? "Pause" : "Play"}
            >
              {data.isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={() => sendAction("next")} className="text-[#64748b] hover:text-white transition-colors" title="Next">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotifyLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function SpotifyLogoSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
