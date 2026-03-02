import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, Loader2, LogIn, UserPlus } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "register";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const resetErrors = () =>
    setFieldErrors({
      username: undefined,
      password: undefined,
      confirm: undefined,
      form: undefined,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    // Client-side validation
    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = "Username is required";
    if (!password) errors.password = "Password is required";
    if (mode === "register") {
      if (password.length < 6)
        errors.password = "Password must be at least 6 characters";
      if (password !== confirmPassword)
        errors.confirm = "Passwords do not match";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const result = await register(username.trim(), password);
        if (result.err) {
          setFieldErrors({ form: result.err });
        } else {
          // After registration the user is auto-logged-in as guest — show info toast
          setRegistrationSuccess(true);
          toast.info(
            "Account created. Waiting for admin approval before you can access the app.",
            { duration: 8000 },
          );
        }
      } else {
        const result = await login(username.trim(), password);
        if (result.err) {
          setFieldErrors({ form: result.err });
        }
        // On success the auth context updates and App.tsx re-renders the shell
      }
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetErrors();
    setRegistrationSuccess(false);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
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

        {/* Login / Register card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card space-y-5 text-left">
          {/* Card header */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {mode === "login"
                ? "Sign in to continue"
                : "Create a new account"}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === "login"
                ? "Enter your username and password to access the dashboard"
                : "Your account will need admin approval before you can access the app"}
            </p>
          </div>

          {/* Form */}
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
                placeholder="e.g. jane.smith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
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
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                disabled={isSubmitting}
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

            {/* Confirm password (register only) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm-password"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  data-ocid="register.input"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={!!fieldErrors.confirm}
                  aria-describedby={
                    fieldErrors.confirm ? "confirm-error" : undefined
                  }
                />
                {fieldErrors.confirm && (
                  <p
                    id="confirm-error"
                    data-ocid="register.error_state"
                    className="text-xs text-destructive mt-1"
                  >
                    {fieldErrors.confirm}
                  </p>
                )}
              </div>
            )}

            {/* Registration success message */}
            {registrationSuccess && (
              <div
                data-ocid="register.success_state"
                className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2.5 text-sm text-primary"
              >
                Account created. Waiting for admin approval.
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              data-ocid={
                mode === "login"
                  ? "login.submit_button"
                  : "register.submit_button"
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : mode === "login" ? (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {/* Mode switch */}
          <div className="pt-1 border-t border-border/50 text-center">
            {mode === "login" ? (
              <p className="text-xs text-muted-foreground">
                Don't have an account?{" "}
                <button
                  type="button"
                  data-ocid="login.link"
                  className="text-primary hover:underline font-medium"
                  onClick={() => switchMode("register")}
                >
                  Register
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  data-ocid="register.link"
                  className="text-primary hover:underline font-medium"
                  onClick={() => switchMode("login")}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60 text-center">
          Access is restricted to authorized team members only
        </p>
      </div>
    </div>
  );
}
