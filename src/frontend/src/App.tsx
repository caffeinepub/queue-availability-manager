import React, { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, History, LogOut, Loader2, Heart, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import HistoryPage from "@/pages/History";
import ConfigPage from "@/pages/Config";
import ProfileSetup from "@/components/ProfileSetup";
import { useGetCallerUserProfile, useIsCallerAdmin } from "@/hooks/useQueries";

type Tab = "dashboard" | "history" | "config";

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const { data: userProfile, isLoading: profileLoading, isFetched: profileFetched, isError: profileError } = useGetCallerUserProfile();
  const { data: isAdmin = false } = useIsCallerAdmin();

  const isAuthenticated = !!identity;
  // Guard against error states (e.g. anonymous principal) to prevent spurious modal flash
  const showProfileSetup = isAuthenticated && !profileLoading && !profileError && profileFetched && userProfile === null;

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
  };

  const userName = userProfile?.name ?? identity?.getPrincipal().toString().slice(0, 8) + "…";

  const baseNavItems: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "history", label: "History", Icon: History },
  ];

  const navItems = isAdmin
    ? [...baseNavItems, { id: "config" as Tab, label: "Config", Icon: Settings }]
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
              <span className="font-semibold text-sm hidden sm:block">Queue Availability Manager</span>
              <span className="font-semibold text-sm sm:hidden">QAM</span>
            </div>

            {/* Nav tabs */}
            <nav className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                    activeTab === id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {/* User / logout */}
            <div className="flex items-center gap-2">
              {profileLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-xs text-muted-foreground hidden sm:block font-medium truncate max-w-32">
                  {userName}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                aria-label="Sign out"
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
          © 2026. Built with{" "}
          <Heart className="inline h-3 w-3 fill-danger text-danger" />{" "}
          using{" "}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      {/* Profile setup modal */}
      <ProfileSetup open={showProfileSetup} />
    </>
  );
}

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;

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
