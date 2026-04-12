"use client";

import { useState, useEffect } from "react";

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not already in standalone mode
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);
    const dismissed = localStorage.getItem("jarvis-pwa-dismissed");

    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("jarvis-pwa-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-[70px] left-3 right-3 z-40 animate-[slideUp_0.3s_ease-out] md:hidden">
      <div className="bg-[#12121a] border border-[#6366f1]/30 rounded-2xl p-4 shadow-xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">J</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Install JARVIS</p>
            <p className="text-xs text-[#64748b] mt-0.5">
              Tap{" "}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" className="inline -mt-0.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
              {" "}Share then <span className="text-white font-medium">&quot;Add to Home Screen&quot;</span>
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-[#64748b] hover:text-white p-1 -mt-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
