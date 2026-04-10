"use client";

import Link from "next/link";

type Tab = "overview" | "ideas" | "agents" | "goals" | "memory";

interface BottomTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { key: Tab | "chat"; label: string; icon: React.ReactNode; href?: string }[] = [
  {
    key: "overview",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "ideas",
    label: "Projects",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    key: "chat",
    label: "Chat",
    href: "/chat",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    key: "goals",
    label: "Goals",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    key: "memory",
    label: "Brain",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A5.5 5.5 0 004 7.5c0 1.5.5 2.8 1.3 3.8L4 14l3-1.5c.8.3 1.6.5 2.5.5A5.5 5.5 0 0015 7.5 5.5 5.5 0 009.5 2z" />
        <path d="M14.5 10a5.5 5.5 0 015.5 5.5c0 1.5-.5 2.8-1.3 3.8L20 22l-3-1.5c-.8.3-1.6.5-2.5.5A5.5 5.5 0 019 15.5c0-.2 0-.4.1-.6" />
      </svg>
    ),
  },
];

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-jarvis-card/95 backdrop-blur-lg border-t border-jarvis-border safe-area-bottom">
      <div className="flex items-center justify-around h-[60px]">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const isChat = tab.key === "chat";

          if (isChat) {
            return (
              <Link
                key={tab.key}
                href="/chat"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors text-jarvis-muted active:text-jarvis-accent"
              >
                <span className="text-jarvis-muted">{tab.icon}</span>
                <span className="text-[10px] font-medium text-jarvis-muted">{tab.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key as Tab)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? "text-jarvis-accent" : "text-jarvis-muted active:text-jarvis-accent"
              }`}
            >
              <span className={isActive ? "text-jarvis-accent" : ""}>{tab.icon}</span>
              <span className={`text-[10px] font-medium ${isActive ? "text-jarvis-accent" : ""}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
