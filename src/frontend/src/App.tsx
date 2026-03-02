import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIsCallerAdmin } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import ConfigPage from "@/pages/Config";
import DashboardPage from "@/pages/Dashboard";
import HistoryPage from "@/pages/History";
import LoginPage from "@/pages/Login";
import { useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
} from "lucide-react";
import React, { useState } from "react";

type Tab = "dashboard" | "history" | "config";

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const { logout, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const { data: isAdmin = false } = useIsCallerAdmin();

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
  };

  const userName = userInfo?.name ?? "User";

  const baseNavItems: {
    id: Tab;
    label: string;
    Icon: typeof LayoutDashboard;
  }[] = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "history", label: "History", Icon: History },
  ];

  const navItems = isAdmin
    ? [
        ...baseNavItems,
        { id: "config" as Tab, label: "Config", Icon: Settings },
      ]
    : baseNavItems;

  return (
    <>
      {/* App header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border/60 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm hidden sm:block">
                Queue Availability Manager
              </span>
              <span className="font-semibold text-sm sm:hidden">QAM</span>
            </div>

            {/* Nav tabs */}
            <nav className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  data-ocid={`nav.${id}.tab`}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                    activeTab === id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {/* User / logout */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block font-medium truncate max-w-32">
                {userName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                aria-label="Sign out"
                data-ocid="nav.logout.button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "config" && isAdmin && <ConfigPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-auto py-4">
        <p className="text-center text-xs text-muted-foreground/50">
          © {new Date().getFullYear()}. Built with{" "}
          <Heart className="inline h-3 w-3 fill-danger text-danger" /> using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </>
  );
}

export default function App() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppShell />
      <Toaster />
    </div>
  );
}
