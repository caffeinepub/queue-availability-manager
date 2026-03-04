import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import {
  useCreateUser,
  useDeleteUser,
  useGetHourlyLimits,
  useListAllUsers,
  useSetHourlyLimit,
  useSetUserRole,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  Clock,
  Info,
  Loader2,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

// ── Local types matching the backend API ──────────────────────────────────────

type RoleVariant = { admin: null } | { user: null } | { guest: null };

interface BackendUserInfo {
  userId: bigint;
  name: string;
  role: RoleVariant;
}

// Extended profile stored in localStorage (frontend-only)
interface UserExtProfile {
  managerName: string;
  fullName: string;
  email: string;
}

const EXT_PROFILE_PREFIX = "qam_user_ext_";

function getExtProfile(userId: bigint): UserExtProfile {
  try {
    const raw = localStorage.getItem(`${EXT_PROFILE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw) as UserExtProfile;
  } catch {
    // ignore
  }
  return { managerName: "", fullName: "", email: "" };
}

function setExtProfile(userId: bigint, profile: UserExtProfile) {
  localStorage.setItem(
    `${EXT_PROFILE_PREFIX}${userId}`,
    JSON.stringify(profile),
  );
}

// ── Role helpers ───────────────────────────────────────────────────────────────

function roleKey(role: unknown): "admin" | "user" | "guest" {
  if (role && typeof role === "object") {
    if ("admin" in role) return "admin";
    if ("user" in role) return "user";
  }
  return "guest";
}

function roleVariant(key: string): RoleVariant {
  if (key === "admin") return { admin: null };
  if (key === "user") return { user: null };
  return { guest: null };
}

const SLOT_PERIODS = [
  "7 AM - 8 AM",
  "8 AM - 9 AM",
  "9 AM - 10 AM",
  "10 AM - 11 AM",
  "11 AM - 12 PM",
  "12 PM - 1 PM",
  "1 PM - 2 PM",
  "2 PM - 3 PM",
  "3 PM - 4 PM",
  "4 PM - 5 PM",
  "5 PM - 6 PM",
  "6 PM - 7 PM",
];

// ── Hourly Limit Row ──────────────────────────────────────────────────────────

function HourlyLimitRow({
  periodIndex,
  label,
  currentLimit,
}: {
  periodIndex: number;
  label: string;
  currentLimit: number;
}) {
  const [inputVal, setInputVal] = useState(currentLimit.toString());
  const [dirty, setDirty] = useState(false);
  const setLimitMutation = useSetHourlyLimit();

  React.useEffect(() => {
    setInputVal(currentLimit.toString());
    setDirty(false);
  }, [currentLimit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    setDirty(e.target.value !== currentLimit.toString());
  };

  const handleSave = async () => {
    const parsed = Number.parseInt(inputVal, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Please enter a valid number (0 or greater)");
      return;
    }
    try {
      await setLimitMutation.mutateAsync({ periodIndex, limit: parsed });
      toast.success(`Limit for ${label} updated to ${parsed}`);
      setDirty(false);
    } catch {
      toast.error(`Failed to update limit for ${label}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setInputVal(currentLimit.toString());
      setDirty(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <Input
          type="number"
          min={0}
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-20 h-8 text-sm font-mono text-center"
          disabled={setLimitMutation.isPending}
          data-ocid="config.hourly_limit.input"
        />
        <span className="text-xs text-muted-foreground">max per hour</span>
      </div>
      <Button
        size="sm"
        variant={dirty ? "default" : "ghost"}
        className="h-8 gap-1.5"
        onClick={handleSave}
        disabled={setLimitMutation.isPending || !dirty}
        data-ocid="config.hourly_limit.save_button"
      >
        {setLimitMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {dirty ? "Save" : "Saved"}
      </Button>
    </div>
  );
}

// ── Role Badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: unknown }) {
  const key = roleKey(role);
  if (key === "admin") {
    return (
      <Badge className="gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
        <ShieldCheck className="h-3 w-3" />
        Admin
      </Badge>
    );
  }
  if (key === "user") {
    return (
      <Badge
        className="gap-1 bg-success/10 text-success border-success/20 hover:bg-success/10"
        style={{ color: "oklch(0.62 0.18 150)" }}
      >
        <User className="h-3 w-3" />
        Member
      </Badge>
    );
  }
  return (
    <Badge className="badge-guest gap-1 border">
      <Shield className="h-3 w-3" />
      Guest
    </Badge>
  );
}

// ── Add User Form ─────────────────────────────────────────────────────────────

function AddUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const createUser = useCreateUser();
  const [managerName, setManagerName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!managerName.trim()) e.managerName = "Manager name is required";
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!lastName.trim()) e.lastName = "Last name is required";
    if (!username.trim()) e.username = "Username is required";
    if (!email.trim()) e.email = "Email address is required";
    if (!initialPassword) e.initialPassword = "Initial password is required";
    if (initialPassword && initialPassword.length < 6)
      e.initialPassword = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    try {
      const newUserId = await createUser.mutateAsync({
        username: username.trim(),
        initialPassword,
      });

      // Store extended profile in localStorage
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      setExtProfile(newUserId, {
        managerName: managerName.trim(),
        fullName,
        email: email.trim(),
      });

      toast.success(`User "${username.trim()}" created successfully`);

      // Reset form
      setManagerName("");
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmail("");
      setInitialPassword("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      noValidate
      data-ocid="config.add_user.panel"
    >
      {/* Manager Name */}
      <div className="space-y-1.5">
        <Label
          htmlFor="add-manager-name"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Manager Name
        </Label>
        <Input
          id="add-manager-name"
          data-ocid="config.add_user.input"
          placeholder="e.g. Sarah Johnson"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          disabled={createUser.isPending}
        />
        {errors.managerName && (
          <p className="text-xs text-destructive">{errors.managerName}</p>
        )}
      </div>

      {/* First Name + Last Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="add-first-name"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            First Name
          </Label>
          <Input
            id="add-first-name"
            data-ocid="config.add_user.input"
            placeholder="First"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={createUser.isPending}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="add-last-name"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            Last Name
          </Label>
          <Input
            id="add-last-name"
            data-ocid="config.add_user.input"
            placeholder="Last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={createUser.isPending}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <Label
          htmlFor="add-username"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Username
        </Label>
        <Input
          id="add-username"
          data-ocid="config.add_user.input"
          placeholder="Used to log in (e.g. jsmith)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={createUser.isPending}
          autoComplete="off"
        />
        {errors.username && (
          <p className="text-xs text-destructive">{errors.username}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label
          htmlFor="add-email"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Email Address
        </Label>
        <Input
          id="add-email"
          data-ocid="config.add_user.input"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={createUser.isPending}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Initial Password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="add-initial-password"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Initial Password
        </Label>
        <Input
          id="add-initial-password"
          data-ocid="config.add_user.input"
          type="password"
          placeholder="Minimum 6 characters"
          value={initialPassword}
          onChange={(e) => setInitialPassword(e.target.value)}
          disabled={createUser.isPending}
          autoComplete="new-password"
        />
        {errors.initialPassword && (
          <p className="text-xs text-destructive">{errors.initialPassword}</p>
        )}
        <p className="text-xs text-muted-foreground">
          The user can change their password after logging in.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full gap-2"
        disabled={createUser.isPending}
        data-ocid="config.add_user.submit_button"
      >
        {createUser.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {createUser.isPending ? "Creating User..." : "Add User"}
      </Button>
    </form>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({
  userInfo,
  currentUserId,
  index,
}: {
  userInfo: BackendUserInfo;
  currentUserId: bigint | null;
  index: number;
}) {
  const currentRoleKey = roleKey(userInfo.role);
  const [selectedRoleKey, setSelectedRoleKey] =
    useState<string>(currentRoleKey);
  const [dirty, setDirty] = useState(false);
  const setRoleMutation = useSetUserRole();
  const deleteUserMutation = useDeleteUser();

  // Load extended profile from localStorage
  const ext = getExtProfile(userInfo.userId);

  React.useEffect(() => {
    setSelectedRoleKey(roleKey(userInfo.role));
    setDirty(false);
  }, [userInfo.role]);

  const handleRoleChange = (val: string) => {
    setSelectedRoleKey(val);
    setDirty(val !== currentRoleKey);
  };

  const handleSave = async () => {
    try {
      await setRoleMutation.mutateAsync({
        userId: userInfo.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: roleVariant(selectedRoleKey) as any,
      });
      toast.success(
        `${userInfo.name || "User"} role updated to ${selectedRoleKey}`,
      );
      setDirty(false);
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUserMutation.mutateAsync(userInfo.userId);
      toast.success(`${userInfo.name || "User"} has been deleted`);
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const isGuest = currentRoleKey === "guest";
  const isSelf = currentUserId !== null && userInfo.userId === currentUserId;
  const displayName = ext.fullName || userInfo.name || "—";

  return (
    <TableRow
      data-ocid={`config.users.row.${index}`}
      className={cn(isGuest && "bg-guest-row")}
    >
      {/* Manager Name */}
      <TableCell className="text-sm pl-6">
        {ext.managerName || (
          <span className="italic text-muted-foreground/60">—</span>
        )}
      </TableCell>

      {/* Full Name */}
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{displayName}</span>
          {isGuest && (
            <span className="text-[10px] text-guest font-medium mt-0.5">
              Pending approval
            </span>
          )}
        </div>
      </TableCell>

      {/* Username / Login */}
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {userInfo.name || "—"}
        </span>
      </TableCell>

      {/* Email */}
      <TableCell className="text-sm">
        {ext.email || (
          <span className="italic text-muted-foreground/60">—</span>
        )}
      </TableCell>

      {/* Current Role */}
      <TableCell>
        <RoleBadge role={userInfo.role} />
      </TableCell>

      {/* Change Role + Actions */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Select
            value={selectedRoleKey}
            onValueChange={handleRoleChange}
            disabled={setRoleMutation.isPending}
          >
            <SelectTrigger
              className="h-8 w-28 text-xs"
              data-ocid={`config.users.select.${index}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">Member</SelectItem>
              <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={dirty ? "default" : "ghost"}
            className="h-8 gap-1.5"
            onClick={handleSave}
            disabled={setRoleMutation.isPending || !dirty}
            data-ocid={`config.users.save_button.${index}`}
          >
            {setRoleMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {dirty ? "Save" : "Saved"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isSelf || deleteUserMutation.isPending}
                data-ocid={`config.users.delete_button.${index}`}
                title={
                  isSelf ? "You cannot delete your own account" : "Delete user"
                }
              >
                {deleteUserMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-ocid="config.delete_user.dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove <strong>{displayName}</strong>{" "}
                  and revoke their access. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-ocid="config.delete_user.cancel_button">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  data-ocid="config.delete_user.confirm_button"
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Change Password Section ───────────────────────────────────────────────────

function ChangePasswordSection() {
  const { userInfo } = useAuth();
  const { login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required";
    if (!newPassword) errs.newPassword = "New password is required";
    if (newPassword && newPassword.length < 6)
      errs.newPassword = "Password must be at least 6 characters";
    if (newPassword !== confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    setSuccess(false);

    try {
      // Verify current password
      const username = userInfo?.name;
      if (!username) throw new Error("Could not determine your username");
      const verifyResult = await login(username, currentPassword);
      if (verifyResult.err) {
        setErrors({ currentPassword: "Current password is incorrect" });
        return;
      }
      // Note: backend doesn't have a changePassword endpoint yet.
      // For now, show a message that the password update must be done by admin.
      toast.info(
        "Password changes require an administrator to reset your account. Please contact your admin.",
        { duration: 8000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your account password. You'll need your current password to
          confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info alert */}
        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Password changes are managed by your administrator. Contact your
            admin to reset your password if needed.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm" noValidate>
          <div className="space-y-1.5">
            <Label
              htmlFor="current-password"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Current Password
            </Label>
            <Input
              id="current-password"
              data-ocid="config.password.input"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">
                {errors.currentPassword}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="new-password"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              New Password
            </Label>
            <Input
              id="new-password"
              data-ocid="config.password.input"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirm-new-password"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Confirm New Password
            </Label>
            <Input
              id="confirm-new-password"
              data-ocid="config.password.input"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {success && (
            <div
              data-ocid="config.password.success_state"
              className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700"
            >
              Password updated successfully.
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            data-ocid="config.password.submit_button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Config Page ───────────────────────────────────────────────────────────────

export default function Config() {
  const { data: hourlyLimits = [], isLoading: limitsLoading } =
    useGetHourlyLimits();
  const { data: rawUsers = [], isLoading: usersLoading } = useListAllUsers();
  const { userId: currentUserId } = useAuth();

  // Cast to BackendUserInfo[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = rawUsers as unknown as BackendUserInfo[];

  const limitsMap = new Map<number, number>(
    hourlyLimits.map((hl) => [Number(hl.periodIndex), Number(hl.limit)]),
  );

  const guestCount = users.filter((u) => roleKey(u.role) === "guest").length;

  // Sort: guests first (pending approval), then users, then admins
  const sortedUsers = [...users].sort((a, b) => {
    const order = { guest: 0, user: 1, admin: 2 };
    return order[roleKey(a.role)] - order[roleKey(b.role)];
  });

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          Configuration
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage hourly slot limits and user access
        </p>
      </div>

      {/* Section A: Hourly Slot Limits */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Slot Limits
          </CardTitle>
          <CardDescription>
            Set the maximum number of ICs allowed off-queue per hour slot (7 AM
            – 7 PM CT).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {limitsLoading ? (
            <div className="space-y-2">
              {SLOT_PERIODS.map((slot) => (
                <Skeleton key={slot} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {SLOT_PERIODS.map((label, idx) => (
                <HourlyLimitRow
                  key={label}
                  periodIndex={idx}
                  label={label}
                  currentLimit={limitsMap.get(idx) ?? 10}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section B: User Management */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Management
                {guestCount > 0 && (
                  <Badge className="badge-guest border ml-1 text-xs">
                    {guestCount} pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Add new users and manage roles and access.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add User Form */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Add New User
            </h3>
            <div className="bg-muted/30 border border-border/60 rounded-lg p-4">
              <AddUserForm />
            </div>
          </div>

          <Separator />

          {/* Info banner */}
          <div className="px-3.5 py-2.5 rounded-md bg-guest-row border border-guest text-sm text-guest flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Users added via this form are automatically set as{" "}
              <strong>Members</strong>. Users who self-register appear as{" "}
              <strong>Guest</strong> (highlighted in orange) until approved.
            </span>
          </div>

          {/* User Table */}
          {usersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div
              data-ocid="config.users.empty_state"
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                No users yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Use the form above to add your first user
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-0">
              <Table data-ocid="config.users.table">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground pl-6">
                      Manager
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Full Name
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Username
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Role
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((userInfo, idx) => (
                    <UserRow
                      key={userInfo.userId.toString()}
                      userInfo={userInfo}
                      currentUserId={currentUserId}
                      index={idx + 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Change Password */}
      <ChangePasswordSection />
    </div>
  );
}
