import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddApproval,
  useGetCallerUserProfile,
  useGetDailyApprovals,
  useGetSlotUsageWithLimits,
  useRemoveApproval,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { ArrowDownAZ, Clock, Loader2, Plus, Trash2, UserX } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const HOURS = [
  "7 AM",
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
  "6 PM",
  "7 PM",
];

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

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / BigInt(1_000_000));
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SlotOverviewGrid({
  slotUsageMap,
  isLoading,
}: {
  slotUsageMap: Map<string, { count: number; limit: number }>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {SLOT_PERIODS.map((slot) => (
          <Skeleton key={slot} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {SLOT_PERIODS.map((slot) => {
        const entry = slotUsageMap.get(slot) ?? { count: 0, limit: 10 };
        const { count, limit } = entry;
        const ratio = limit > 0 ? count / limit : 0;
        const isFull = ratio >= 1.0;
        const isNearFull = ratio > 0.7 && ratio < 1.0;

        const colorClass = isFull
          ? "border-danger/40 bg-danger/8 text-danger"
          : isNearFull
            ? "border-warning/40 bg-warning/8 text-warning"
            : "border-border/60 bg-card text-foreground";

        const countColorClass = isFull
          ? "text-danger font-bold"
          : isNearFull
            ? "text-warning font-semibold"
            : "text-success font-semibold";

        return (
          <div
            key={slot}
            className={cn(
              "rounded-lg border px-2.5 py-2 flex flex-col gap-1 transition-colors",
              colorClass,
            )}
          >
            <span className="text-[10px] font-medium leading-tight text-muted-foreground">
              {slot}
            </span>
            <div className="flex items-center justify-between mt-auto">
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  countColorClass,
                )}
              >
                {count} / {limit}
              </span>
              {isFull && (
                <Badge
                  variant="destructive"
                  className="text-[9px] px-1 py-0 h-4 leading-tight"
                >
                  Full
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const today = new Date();

  // Data
  const { data: approvals = [], isLoading: approvalsLoading } =
    useGetDailyApprovals();
  const { data: slotUsageData = [], isLoading: slotUsageLoading } =
    useGetSlotUsageWithLimits();
  const { data: userProfile } = useGetCallerUserProfile();

  // Mutations
  const addApprovalMutation = useAddApproval();
  const removeApprovalMutation = useRemoveApproval();

  // Sort state for approvals list
  const [sortBy, setSortBy] = useState<"startTime" | "icName">("startTime");

  // Add approval form
  const [icName, setIcName] = useState("");
  const [selectedStartHour, setSelectedStartHour] = useState("");
  const [selectedEndHour, setSelectedEndHour] = useState("");

  // Sorted approvals
  const sortedApprovals = useMemo(() => {
    const copy = [...approvals];
    if (sortBy === "icName") {
      copy.sort((a, b) => a.icName.localeCompare(b.icName));
    } else {
      // sort by start hour index
      copy.sort(
        (a, b) =>
          HOURS.indexOf(a.startHour ?? "") - HOURS.indexOf(b.startHour ?? ""),
      );
    }
    return copy;
  }, [approvals, sortBy]);

  // Build a slot usage map for O(1) lookups (keyed by SLOT_PERIODS strings)
  const slotUsageMap = new Map<string, { count: number; limit: number }>(
    slotUsageData.map((s) => [
      s.timeSlot,
      { count: Number(s.count), limit: Number(s.limit) },
    ]),
  );

  const handleAddApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icName.trim()) {
      toast.error("Please enter the IC name");
      return;
    }
    if (!selectedStartHour) {
      toast.error("Please select a start time");
      return;
    }
    if (!selectedEndHour) {
      toast.error("Please select an end time");
      return;
    }

    // Check capacity for every hour in the range using per-slot limits
    const startIdx = HOURS.indexOf(selectedStartHour);
    const endIdx = HOURS.indexOf(selectedEndHour);
    for (let i = startIdx; i < endIdx; i++) {
      const period = SLOT_PERIODS[i];
      const entry = slotUsageMap.get(period) ?? { count: 0, limit: 10 };
      if (entry.count >= entry.limit) {
        toast.error(
          `The ${period} slot is full (${entry.count}/${entry.limit})`,
        );
        return;
      }
    }

    const managerName = userProfile?.name ?? "Unknown";
    try {
      await addApprovalMutation.mutateAsync({
        icName: icName.trim(),
        managerName,
        startHour: selectedStartHour,
        endHour: selectedEndHour,
      });
      toast.success(`${icName.trim()} added to queue exclusions`);
      setIcName("");
      setSelectedStartHour("");
      setSelectedEndHour("");
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("already has an approved exclusion")
      ) {
        toast.error(err.message);
      } else {
        toast.error("Failed to add approval");
      }
    }
  };

  const handleRemove = async (entryId: bigint, name: string) => {
    try {
      await removeApprovalMutation.mutateAsync(entryId);
      toast.success(`${name} removed from queue exclusions`);
    } catch {
      toast.error("Failed to remove approval");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header row */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Queue Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {formatDate(today)}
        </p>
      </div>

      {/* Hourly Slot Overview */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Slot Availability
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              7 AM – 7 PM CT
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SlotOverviewGrid
            slotUsageMap={slotUsageMap}
            isLoading={slotUsageLoading}
          />
        </CardContent>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Add approval form */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Queue Exclusion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddApproval} className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="ic-name"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  IC Name
                </Label>
                <Input
                  id="ic-name"
                  placeholder="e.g. Jane Smith"
                  value={icName}
                  onChange={(e) => setIcName(e.target.value)}
                  disabled={addApprovalMutation.isPending}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="start-hour"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Start Time
                  </Label>
                  <Select
                    value={selectedStartHour}
                    onValueChange={(val) => {
                      setSelectedStartHour(val);
                      if (
                        selectedEndHour &&
                        HOURS.indexOf(selectedEndHour) <= HOURS.indexOf(val)
                      ) {
                        setSelectedEndHour("");
                      }
                    }}
                    disabled={addApprovalMutation.isPending}
                  >
                    <SelectTrigger id="start-hour">
                      <SelectValue placeholder="Start…" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.slice(0, -1).map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="end-hour"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    End Time
                  </Label>
                  <Select
                    value={selectedEndHour}
                    onValueChange={setSelectedEndHour}
                    disabled={
                      addApprovalMutation.isPending || !selectedStartHour
                    }
                  >
                    <SelectTrigger id="end-hour">
                      <SelectValue
                        placeholder={selectedStartHour ? "End…" : "Start first"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.slice(HOURS.indexOf(selectedStartHour) + 1).map(
                        (hour) => {
                          const startIdx = HOURS.indexOf(selectedStartHour);
                          const endIdx = HOURS.indexOf(hour);
                          const hasFullSlot = Array.from(
                            { length: endIdx - startIdx },
                            (_, i) => SLOT_PERIODS[startIdx + i],
                          ).some((p) => {
                            const e = slotUsageMap.get(p) ?? {
                              count: 0,
                              limit: 10,
                            };
                            return e.count >= e.limit;
                          });
                          return (
                            <SelectItem
                              key={hour}
                              value={hour}
                              disabled={hasFullSlot}
                              className={cn(hasFullSlot && "opacity-50")}
                            >
                              <span className="flex items-center justify-between gap-3 w-full">
                                <span>{hour}</span>
                                {hasFullSlot && (
                                  <span className="text-xs font-mono text-danger">
                                    Full slot in range
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {userProfile?.name && (
                <p className="text-xs text-muted-foreground">
                  Approving as{" "}
                  <span className="font-medium text-foreground/70">
                    {userProfile.name}
                  </span>
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  addApprovalMutation.isPending ||
                  !icName.trim() ||
                  !selectedStartHour ||
                  !selectedEndHour
                }
                className="w-full"
              >
                {addApprovalMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add to Queue Exclusion
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Approvals list */}
        <Card className="lg:col-span-3 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>Today's Approved Exclusions</span>
              <div className="flex items-center gap-1.5 ml-auto">
                {!approvalsLoading && approvals.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {approvals.length}
                  </Badge>
                )}
                <Button
                  variant={sortBy === "startTime" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1 text-xs px-2"
                  onClick={() => setSortBy("startTime")}
                  title="Sort by start time"
                >
                  <Clock className="h-3 w-3" />
                  Time
                </Button>
                <Button
                  variant={sortBy === "icName" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1 text-xs px-2"
                  onClick={() => setSortBy("icName")}
                  title="Sort by IC name"
                >
                  <ArrowDownAZ className="h-3 w-3" />
                  Name
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvalsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : approvals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserX className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No approvals yet today
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Approved queue exclusions will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {sortedApprovals.map((entry) => (
                  <div
                    key={entry.entryId.toString()}
                    className="flex items-center gap-3 py-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.icName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Approved by{" "}
                        <span className="font-medium text-foreground/70">
                          {entry.managerName}
                        </span>
                        {" · "}
                        <span className="font-mono">
                          {formatTimestamp(entry.timestampNs)}
                        </span>
                      </p>
                      {entry.startHour && entry.endHour && (
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] px-1.5 py-0 h-4 font-normal gap-1"
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {entry.startHour} – {entry.endHour}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(entry.entryId, entry.icName)}
                      disabled={removeApprovalMutation.isPending}
                      aria-label={`Remove ${entry.icName}`}
                    >
                      {removeApprovalMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
