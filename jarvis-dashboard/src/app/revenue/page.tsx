"use client";

import Link from "next/link";
import RevenueTab from "@/components/dashboard/RevenueTab";

export default function RevenuePage() {
  return (
    <div className="min-h-screen bg-jarvis-bg text-jarvis-text">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-jarvis-muted hover:text-jarvis-text transition-colors text-sm mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>
        <RevenueTab />
      </div>
    </div>
  );
}
