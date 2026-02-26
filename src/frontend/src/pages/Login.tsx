import React from "react";
import { Loader2, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";

export default function Login() {
  const { login, loginStatus } = useInternetIdentity();
  const isLoggingIn = loginStatus === "logging-in";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-8 animate-fade-up">
        {/* Logo / branding */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Queue Availability Manager</h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              Track daily queue exclusion approvals for your support team
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card space-y-4 text-left">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sign in to continue</p>
            <p className="text-xs text-muted-foreground">
              Secure login required to access team queue data
            </p>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={login}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Access is restricted to authorized team members only
        </p>
      </div>
    </div>
  );
}
