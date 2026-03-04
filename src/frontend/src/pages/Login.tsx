import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActorInternal as useActor } from "@/hooks/useActorInternal";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, Loader2, LogIn, ShieldCheck } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

// ── Admin Bootstrap ───────────────────────────────────────────────────────────
// On first load, attempt to register the pre-configured admin account.
// If the admin already exists or the username is taken, this is a no-op.
const BOOTSTRAP_USERNAME = "joswood";
const BOOTSTRAP_PASSWORD = "1234abcd";

function useAdminBootstrap() {
  const { actor } = useActor();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!actor || attempted.current) return;
    attempted.current = true;
    setBootstrapping(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (actor as any)
      .register(BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD)
      .then(() => {
        setBootstrapped(true);
      })
      .catch(() => {
        // Already registered or error — treat as ok
        setBootstrapped(true);
      })
      .finally(() => {
        setBootstrapping(false);
      });
  }, [actor]);

  return { bootstrapped, bootstrapping };
}

export default function Login() {
  const { login } = useAuth();
  const { bootstrapping } = useAdminBootstrap();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    form?: string;
  }>({});

  const resetErrors = () =>
    setFieldErrors({
      username: undefined,
      password: undefined,
      form: undefined,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = "Username is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (result.err) {
        setFieldErrors({ form: result.err });
      }
      // On success the auth context updates and App.tsx re-renders the shell
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-up">
        {/* Logo / branding */}
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Queue Availability Manager
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              Track daily queue exclusion approvals for your support team
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card space-y-5 text-left">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sign in to continue</p>
            <p className="text-xs text-muted-foreground">
              Enter your username and password to access the dashboard
            </p>
          </div>

          {bootstrapping && (
            <div
              data-ocid="login.loading_state"
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Initializing…
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Global form error */}
            {fieldErrors.form && (
              <div
                data-ocid="login.error_state"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                {fieldErrors.form}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Username
              </Label>
              <Input
                id="username"
                data-ocid="login.input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting || bootstrapping}
                aria-invalid={!!fieldErrors.username}
                aria-describedby={
                  fieldErrors.username ? "username-error" : undefined
                }
              />
              {fieldErrors.username && (
                <p
                  id="username-error"
                  data-ocid="login.error_state"
                  className="text-xs text-destructive mt-1"
                >
                  {fieldErrors.username}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Password
              </Label>
              <Input
                id="password"
                data-ocid="login.input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting || bootstrapping}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "password-error" : undefined
                }
              />
              {fieldErrors.password && (
                <p
                  id="password-error"
                  data-ocid="login.error_state"
                  className="text-xs text-destructive mt-1"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              data-ocid="login.submit_button"
              disabled={isSubmitting || bootstrapping}
            >
              {isSubmitting ? (
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
          </form>

          <div className="pt-1 border-t border-border/50 text-center space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Contact your administrator to get an account.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
              <ShieldCheck className="h-3 w-3" />
              <span>Admin: joswood</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60 text-center">
          Access is restricted to authorized team members only
        </p>
      </div>
    </div>
  );
}
