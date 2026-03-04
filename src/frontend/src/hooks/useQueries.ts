import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApprovalEntry,
  DailyRecord,
  DaySummary,
  HourlyLimit,
  SlotUsage,
  SlotUsageWithLimit,
  UserInfo,
} from "../backend.d";
import { useAuth } from "./useAuth";
import { useBackend } from "./useBackend";

// The new backend UserRole is a Candid variant object, not an enum.
// We use a loose type here so it works with both old and new backend.d.ts.
type UserRoleVariant = { admin: null } | { user: null } | { guest: null };

// ── Helper: cast actor to any to work with the new session-token API ──────────
// The backend.d.ts is regenerated during build; until then we use `any` casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = any;

// ── User Profile ─────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();

  return useQuery<UserInfo | null>({
    queryKey: ["currentUserProfile", token],
    queryFn: async () => {
      if (!actor || !token) return null;
      try {
        const result = await (actor as AnyActor).getCallerUserProfile(token);
        // Returns UserProfile | null
        if (result === null || result === undefined) return null;
        // getCallerUserProfile returns { name: string } | null
        return result as UserInfo | null;
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
    retry: false,
  });
}

export function useWhoami() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();

  return useQuery<UserInfo | null>({
    queryKey: ["whoami", token],
    queryFn: async () => {
      if (!actor || !token) return null;
      try {
        const result = await (actor as AnyActor).whoami(token);
        if (result && "ok" in result) return result.ok as UserInfo;
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
    retry: false,
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useGetDailyCap() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<bigint>({
    queryKey: ["dailyCap"],
    queryFn: async () => {
      if (!actor || !token) return BigInt(0);
      return (actor as AnyActor).getDailyCap(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useGetRemainingSlots() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<bigint>({
    queryKey: ["remainingSlots"],
    queryFn: async () => {
      if (!actor || !token) return BigInt(0);
      return (actor as AnyActor).getRemainingSlots(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useGetDailyApprovals() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<ApprovalEntry[]>({
    queryKey: ["dailyApprovals"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getDailyApprovals(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useSetDailyCap() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cap: number) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).setDailyCap(token, BigInt(cap));
      if (result && "err" in result) throw new Error(result.err as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyCap"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
    },
  });
}

export function useAddApproval() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      icName,
      managerName,
      startHour,
      endHour,
      exclusionDate,
    }: {
      icName: string;
      managerName: string;
      startHour: string;
      endHour: string;
      exclusionDate: string;
    }) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).addApproval(
        token,
        icName,
        managerName,
        startHour,
        endHour,
        exclusionDate,
      );
      if (result && "err" in result) throw new Error(result.err as string);
      if (result && "ok" in result) return result.ok as ApprovalEntry;
      return result as ApprovalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["futureApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsage"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsageWithLimits"] });
    },
  });
}

export function useGetSlotUsage() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<SlotUsage[]>({
    queryKey: ["slotUsage"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getSlotUsage(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useRemoveApproval() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: bigint) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).removeApproval(token, entryId);
      if (result && "err" in result) throw new Error(result.err as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["futureApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsage"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsageWithLimits"] });
    },
  });
}

export function useGetFutureApprovals() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<ApprovalEntry[]>({
    queryKey: ["futureApprovals"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getFutureApprovals(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

// ── Slot Usage With Limits ────────────────────────────────────────────────────

export function useGetSlotUsageWithLimits() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<SlotUsageWithLimit[]>({
    queryKey: ["slotUsageWithLimits"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getSlotUsageWithLimits(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

// ── Hourly Limits ─────────────────────────────────────────────────────────────

export function useGetHourlyLimits() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<HourlyLimit[]>({
    queryKey: ["hourlyLimits"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getHourlyLimits(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useSetHourlyLimit() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      periodIndex,
      limit,
    }: { periodIndex: number; limit: number }) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).setHourlyLimit(
        token,
        BigInt(periodIndex),
        BigInt(limit),
      );
      if (result && "err" in result) throw new Error(result.err as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hourlyLimits"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsageWithLimits"] });
    },
  });
}

// ── User Management ───────────────────────────────────────────────────────────

export function useListAllUsers() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<UserInfo[]>({
    queryKey: ["allUsers"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).listAllUsers(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useSetUserRole() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: { userId: bigint; role: UserRoleVariant }) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).setUserRole(token, userId, role);
      if (result && "err" in result) throw new Error(result.err as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useDeleteUser() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: bigint) => {
      if (!actor || !token) throw new Error("Not authenticated");
      const result = await (actor as AnyActor).deleteUser(token, userId);
      if (result && "err" in result) throw new Error(result.err as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useCreateUser() {
  const { actor } = useBackend();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      initialPassword,
    }: {
      username: string;
      initialPassword: string;
    }): Promise<bigint> => {
      if (!actor) throw new Error("Not connected");
      // register is a public endpoint — no token needed
      const result = await (actor as AnyActor).register(
        username,
        initialPassword,
      );
      if (result && "err" in result) throw new Error(result.err as string);
      if (!result || !("ok" in result)) throw new Error("Registration failed");
      const newUserId = result.ok as bigint;

      // Immediately activate as member (not guest) if we have a token
      if (token) {
        try {
          await (actor as AnyActor).setUserRole(token, newUserId, {
            user: null,
          });
        } catch {
          // non-critical — user can be promoted manually
        }
      }

      return newUserId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<boolean>({
    queryKey: ["isCallerAdmin", token],
    queryFn: async () => {
      if (!actor || !token) return false;
      try {
        return await (actor as AnyActor).isCallerAdmin(token);
      } catch {
        return false;
      }
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export function useGetHistory(
  startDate: string | null,
  endDate: string | null,
) {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<Array<[string, DailyRecord]>>({
    queryKey: ["history", startDate, endDate, token],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getHistory(token, startDate, endDate);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}

export function useGetSummary() {
  const { actor, isFetching } = useBackend();
  const { token, isInitializing } = useAuth();
  return useQuery<DaySummary[]>({
    queryKey: ["summary"],
    queryFn: async () => {
      if (!actor || !token) return [];
      return (actor as AnyActor).getSummary(token);
    },
    enabled: !!actor && !isFetching && !isInitializing && !!token,
  });
}
