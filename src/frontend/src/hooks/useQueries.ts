import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApprovalEntry,
  DailyRecord,
  DaySummary,
  HourlyLimit,
  SlotUsage,
  SlotUsageWithLimit,
  UserInfo,
  UserProfile,
  UserRole,
} from "../backend.d";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// ── User Profile ─────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { isInitializing } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      try {
        return await actor.getCallerUserProfile();
      } catch (err: unknown) {
        // Backend throws "User is not registered", "Unauthorized", or "Anonymous" for
        // brand-new users who haven't called saveCallerUserProfile yet. Treat this as
        // "no profile" so the ProfileSetup modal will appear and trigger auto-role-assignment.
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("not registered") ||
          msg.includes("Unauthorized") ||
          msg.includes("Anonymous")
        ) {
          return null;
        }
        // Catch-all: unknown errors also return null to avoid blocking the UI.
        return null;
      }
    },
    enabled: !!actor && !actorFetching && !isInitializing,
    retry: false,
  });

  return {
    ...query,
    // Include isInitializing so the loading state covers the full auth lifecycle
    isLoading: isInitializing || actorFetching || query.isLoading,
    // Once fetched, never flip back to false — avoids modal flicker on re-renders
    isFetched: query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      // Invalidate role-related queries so the nav and admin checks update immediately
      // after the backend auto-assigns a role on first save
      queryClient.invalidateQueries({ queryKey: ["isCallerAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["callerUserRole"] });
    },
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useGetDailyCap() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<bigint>({
    queryKey: ["dailyCap"],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getDailyCap();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useGetRemainingSlots() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<bigint>({
    queryKey: ["remainingSlots"],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getRemainingSlots();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useGetDailyApprovals() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<ApprovalEntry[]>({
    queryKey: ["dailyApprovals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDailyApprovals();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useSetDailyCap() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cap: number) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setDailyCap(BigInt(cap));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyCap"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
    },
  });
}

export function useAddApproval() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      icName,
      managerName,
      startHour,
      endHour,
    }: {
      icName: string;
      managerName: string;
      startHour: string;
      endHour: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addApproval(icName, managerName, startHour, endHour);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsage"] });
    },
  });
}

export function useGetSlotUsage() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<SlotUsage[]>({
    queryKey: ["slotUsage"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSlotUsage();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useRemoveApproval() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      await actor.removeApproval(entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["remainingSlots"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsage"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsageWithLimits"] });
    },
  });
}

// ── Slot Usage With Limits ────────────────────────────────────────────────────

export function useGetSlotUsageWithLimits() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<SlotUsageWithLimit[]>({
    queryKey: ["slotUsageWithLimits"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSlotUsageWithLimits();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

// ── Hourly Limits ─────────────────────────────────────────────────────────────

export function useGetHourlyLimits() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<HourlyLimit[]>({
    queryKey: ["hourlyLimits"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHourlyLimits();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useSetHourlyLimit() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      periodIndex,
      limit,
    }: { periodIndex: number; limit: number }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setHourlyLimit(BigInt(periodIndex), BigInt(limit));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hourlyLimits"] });
      queryClient.invalidateQueries({ queryKey: ["slotUsageWithLimits"] });
    },
  });
}

// ── User Management ───────────────────────────────────────────────────────────

export function useListAllUsers() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<UserInfo[]>({
    queryKey: ["allUsers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAllUsers();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useSetUserRole() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: UserRole }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setUserRole(user, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useDeleteUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!actor) throw new Error("Actor not available");
      await actor.deleteUser(user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<boolean>({
    queryKey: ["isCallerAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch {
        // Backend may trap for brand-new users who have no role yet.
        // Treat any error as "not admin" so the UI doesn't break on first login.
        return false;
      }
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export function useGetHistory(
  startDate: string | null,
  endDate: string | null,
) {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<Array<[string, DailyRecord]>>({
    queryKey: ["history", startDate, endDate],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHistory(startDate, endDate);
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}

export function useGetSummary() {
  const { actor, isFetching } = useActor();
  const { isInitializing } = useInternetIdentity();
  return useQuery<DaySummary[]>({
    queryKey: ["summary"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSummary();
    },
    enabled: !!actor && !isFetching && !isInitializing,
  });
}
