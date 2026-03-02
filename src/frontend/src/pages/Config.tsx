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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useDeleteUser,
  useGetHourlyLimits,
  useListAllUsers,
  useSetHourlyLimit,
  useSetUserRole,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  Clock,
  Loader2,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

// ── Local types matching the new backend API ──────────────────────────────────

// The new backend returns UserRole as a Candid variant object, not an enum.
// Shape: { admin: null } | { user: null } | { guest: null }
type RoleVariant = { admin: null } | { user: null } | { guest: null };

// The new backend UserInfo has userId: bigint instead of principal: Principal
interface BackendUserInfo {
  userId: bigint;
  name: string;
  role: RoleVariant;
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

  // Sync when currentLimit changes (e.g. after successful save)
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
  // guest
  return (
    <Badge className="badge-guest gap-1 border">
      <Shield className="h-3 w-3" />
      Guest
    </Badge>
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

  // Sync when role changes externally
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
  // Show short user ID for identification
  const userIdStr = userInfo.userId.toString();
  const shortId = `#${userIdStr.slice(-6)}`;

  return (
    <TableRow
      data-ocid={`config.users.row.${index}`}
      className={cn(isGuest && "bg-guest-row")}
    >
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="text-sm">
            {userInfo.name || (
              <span className="italic text-muted-foreground">No name set</span>
            )}
          </span>
          {isGuest && (
            <span className="text-[10px] text-guest font-medium mt-0.5">
              New — pending approval
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span
          className="font-mono text-xs text-muted-foreground"
          title={`User ID: ${userIdStr}`}
        >
          {shortId}
        </span>
      </TableCell>
      <TableCell>
        <RoleBadge role={userInfo.role} />
      </TableCell>
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
                  This will permanently remove{" "}
                  <strong>{userInfo.name || "this user"}</strong> and revoke
                  their access. They can re-register by logging in again.
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

// ── Config Page ───────────────────────────────────────────────────────────────

export default function Config() {
  const { data: hourlyLimits = [], isLoading: limitsLoading } =
    useGetHourlyLimits();
  const { data: rawUsers = [], isLoading: usersLoading } = useListAllUsers();
  const { userId: currentUserId } = useAuth();

  // Cast to BackendUserInfo[] — the new backend returns userId (bigint) not principal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = rawUsers as unknown as BackendUserInfo[];

  // Build a map from periodIndex → limit for quick access
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
                Manage roles and access for everyone who has registered.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Info banner */}
          <div className="mx-6 mb-4 px-3.5 py-2.5 rounded-md bg-guest-row border border-guest text-sm text-guest flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              New users appear with <strong>Guest</strong> status and are
              highlighted in orange. Change their role to{" "}
              <strong>Member</strong> to grant access, or <strong>Admin</strong>{" "}
              for full control.
            </span>
          </div>

          {usersLoading ? (
            <div className="space-y-2 px-6 pb-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div
              data-ocid="config.users.empty_state"
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                No users yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Users will appear here once they register
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-ocid="config.users.table">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground pl-6">
                      Name
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      User ID
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Current Role
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                      Change Role
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
    </div>
  );
}
