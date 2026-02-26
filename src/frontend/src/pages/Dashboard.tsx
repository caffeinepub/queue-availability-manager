import React, { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, Plus, Trash2, UserX, Loader2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SlotCounter from "@/components/SlotCounter";
import {
  useGetDailyCap,
  useGetRemainingSlots,
  useGetDailyApprovals,
  useSetDailyCap,
  useAddApproval,
  useRemoveApproval,
  useGetSlotUsage,
  useGetCallerUserProfile,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";

const HOURS = [
  "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM",
  "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM",
];

const SLOT_PERIODS = [
  "7 AM - 8 AM", "8 AM - 9 AM", "9 AM - 10 AM", "10 AM - 11 AM",
  "11 AM - 12 PM", "12 PM - 1 PM", "1 PM - 2 PM", "2 PM - 3 PM",
  "3 PM - 4 PM", "4 PM - 5 PM", "5 PM - 6 PM", "6 PM - 7 PM",
];

const SLOT_MAX = 10;

function formatTimestamp(ts: bigint): string {
  // nanoseconds → ms
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
  slotUsageMap: Map<string, number>;
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
        const count = slotUsageMap.get(slot) ?? 0;
        const isFull = count >= SLOT_MAX;
        const isNearFull = count >= 7 && count < SLOT_MAX;

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
              colorClass
            )}
          >
            <span className="text-[10px] font-medium leading-tight text-muted-foreground">
              {slot}
            </span>
            <div className="flex items-center justify-between mt-auto">
              <span className={cn("font-mono text-sm tabular-nums", countColorClass)}>
                {count} / {SLOT_MAX}
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
  const { data: cap = BigInt(0), isLoading: capLoading } = useGetDailyCap();
  const { data: remaining = BigInt(0), isLoading: remainingLoading } = useGetRemainingSlots();
  const { data: approvals = [], isLoading: approvalsLoading } = useGetDailyApprovals();
  const { data: slotUsageData = [], isLoading: slotUsageLoading } = useGetSlotUsage();
  const { data: userProfile } = useGetCallerUserProfile();

  // Mutations
  const setCapMutation = useSetDailyCap();
  const addApprovalMutation = useAddApproval();
  const removeApprovalMutation = useRemoveApproval();

  // Cap editing
  const [editingCap, setEditingCap] = useState(false);
  const [capInput, setCapInput] = useState("");

  // Add approval form
  const [icName, setIcName] = useState("");
  const [selectedStartHour, setSelectedStartHour] = useState("");
  const [selectedEndHour, setSelectedEndHour] = useState("");

  // Build a slot usage map for O(1) lookups (keyed by SLOT_PERIODS strings)
  const slotUsageMap = new Map<string, number>(
    slotUsageData.map((s) => [s.timeSlot, Number(s.count)])
  );

  const capNum = Number(cap);
  const remainingNum = Number(remaining);
  const isFull = remainingNum === 0 && capNum > 0;

  const handleCapEdit = () => {
    setCapInput(capNum.toString());
    setEditingCap(true);
  };

  const handleCapSave = async () => {
    const parsed = parseInt(capInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Please enter a valid number");
      return;
    }
    try {
      await setCapMutation.mutateAsync(parsed);
      toast.success(`Daily cap updated to ${parsed}`);
      setEditingCap(false);
    } catch {
      toast.error("Failed to update cap");
    }
  };

  const handleCapKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCapSave();
    if (e.key === "Escape") setEditingCap(false);
  };

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
    if (isFull) {
      toast.error("No slots remaining — daily cap has been reached");
      return;
    }

    // Check capacity for every hour in the range
    const startIdx = HOURS.indexOf(selectedStartHour);
    const endIdx = HOURS.indexOf(selectedEndHour);
    for (let i = startIdx; i < endIdx; i++) {
      const period = SLOT_PERIODS[i];
      const count = slotUsageMap.get(period) ?? 0;
      if (count >= SLOT_MAX) {
        toast.error(`The ${period} slot is full (${SLOT_MAX}/${SLOT_MAX})`);
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
    } catch {
      toast.error("Failed to add approval");
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

  const isLoading = capLoading || remainingLoading;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Queue Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{formatDate(today)}</p>
        </div>

        {/* Daily Cap control */}
        <Card className="shadow-xs border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Daily Cap
              </span>
              {editingCap ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={capInput}
                    onChange={(e) => setCapInput(e.target.value)}
                    onKeyDown={handleCapKeyDown}
                    className="w-20 h-7 text-sm font-mono text-center"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCapSave}
                    disabled={setCapMutation.isPending}
                  >
                    {setCapMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-success" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingCap(false)}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {capLoading ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                      {capNum}
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCapEdit}
                    aria-label="Edit daily cap"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Slot Overview */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Slot Availability
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Max {SLOT_MAX} per slot · 7 AM – 7 PM CT
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SlotOverviewGrid slotUsageMap={slotUsageMap} isLoading={slotUsageLoading} />
        </CardContent>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Slot counter — focal point */}
        <Card className="lg:col-span-2 shadow-card flex flex-col items-center justify-center py-8">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-widest">
              Available Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-48 w-48 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <SlotCounter remaining={remainingNum} cap={capNum} />
            )}
          </CardContent>
        </Card>

        {/* Right column: approvals list + add form */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Add approval form */}
          <Card className={cn("shadow-card", isFull && "opacity-75")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Queue Exclusion
                {isFull && (
                  <Badge variant="destructive" className="ml-auto text-xs">
                    Cap Reached
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFull ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <UserX className="h-4 w-4 text-danger" />
                  <span>The daily cap has been reached. No additional approvals can be added.</span>
                </div>
              ) : (
                <form onSubmit={handleAddApproval} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ic-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="start-hour" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Start Time
                      </Label>
                      <Select
                        value={selectedStartHour}
                        onValueChange={(val) => {
                          setSelectedStartHour(val);
                          // Clear end hour if it's no longer valid
                          if (selectedEndHour && HOURS.indexOf(selectedEndHour) <= HOURS.indexOf(val)) {
                            setSelectedEndHour("");
                          }
                        }}
                        disabled={addApprovalMutation.isPending}
                      >
                        <SelectTrigger id="start-hour">
                          <SelectValue placeholder="Start time…" />
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
                      <Label htmlFor="end-hour" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        End Time
                      </Label>
                      <Select
                        value={selectedEndHour}
                        onValueChange={setSelectedEndHour}
                        disabled={addApprovalMutation.isPending || !selectedStartHour}
                      >
                        <SelectTrigger id="end-hour">
                          <SelectValue placeholder={selectedStartHour ? "End time…" : "Select start first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.slice(HOURS.indexOf(selectedStartHour) + 1).map((hour) => {
                            // Check if any period in this range would be at capacity
                            const startIdx = HOURS.indexOf(selectedStartHour);
                            const endIdx = HOURS.indexOf(hour);
                            const hasFullSlot = Array.from({ length: endIdx - startIdx }, (_, i) => SLOT_PERIODS[startIdx + i])
                              .some((p) => (slotUsageMap.get(p) ?? 0) >= SLOT_MAX);
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
                                    <span className="text-xs font-mono text-danger">Full slot in range</span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {userProfile?.name && (
                    <p className="text-xs text-muted-foreground">
                      Approving as{" "}
                      <span className="font-medium text-foreground/70">{userProfile.name}</span>
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={addApprovalMutation.isPending || !icName.trim() || !selectedStartHour || !selectedEndHour}
                    className="w-full sm:w-auto"
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
              )}
            </CardContent>
          </Card>

          {/* Approvals list */}
          <Card className="shadow-card flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Today's Approved Exclusions</span>
                {!approvalsLoading && approvals.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {approvals.length}
                  </Badge>
                )}
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
                  <p className="text-sm font-medium text-muted-foreground">No approvals yet today</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Approved queue exclusions will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {approvals.map((entry) => (
                    <div
                      key={entry.entryId.toString()}
                      className="flex items-center gap-3 py-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{entry.icName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Approved by{" "}
                          <span className="font-medium text-foreground/70">{entry.managerName}</span>
                          {" · "}
                          <span className="font-mono">{formatTimestamp(entry.timestampNs)}</span>
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
    </div>
  );
}
