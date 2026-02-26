import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";
import type { ApprovalEntry, UserProfile, DaySummary, DailyRecord, SlotUsage } from "../backend.d";

// ── User Profile ─────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { isInitializing } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
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
    mutationFn: async ({ icName, managerName, startHour, endHour }: { icName: string; managerName: string; startHour: string; endHour: string }) => {
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
    },
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export function useGetHistory(startDate: string | null, endDate: string | null) {
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
