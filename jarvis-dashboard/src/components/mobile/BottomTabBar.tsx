"use client";

type Tab = "overview" | "ideas" | "agents" | "goals" | "memory" | "history" | "approvals";
type MobileTab = "overview" | "ideas" | "agents" | "chat";

interface BottomTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  mobileChatActive: boolean;
  onMobileChatToggle: (active: boolean) => void;
}

const MOBILE_TABS: { key: MobileTab; label: string; icon: React.ReactNode }[] = [
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
    label: "Ideas",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
      </svg>
    ),
  },
  {
    key: "agents",
    label: "Agents",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="4" />
        <path d="M8 16h.01M16 16h.01" />
      </svg>
    ),
  },
  {
    key: "chat",
    label: "Chat",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function BottomTabBar({ activeTab, onTabChange, mobileChatActive, onMobileChatToggle }: BottomTabBarProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-jarvis-card/95 backdrop-blur-lg border-t border-jarvis-border safe-area-bottom">
      <div className="flex items-center justify-around" style={{ height: 60 }}>
        {MOBILE_TABS.map((tab) => {
          const isChat = tab.key === "chat";
          const isActive = isChat ? mobileChatActive : (!mobileChatActive && tab.key === activeTab);

          return (
            <button
              key={tab.key}
              onClick={() => {
                if (isChat) {
                  onMobileChatToggle(true);
                } else {
                  onMobileChatToggle(false);
                  onTabChange(tab.key as Tab);
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors min-h-[44px] ${
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
