import type { ApprovalEntry, DailyRecord } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetFutureApprovals, useGetHistory } from "@/hooks/useQueries";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Search,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import React, { useState, useMemo } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateStr(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function getMonthBounds(month: Date): { start: string; end: string } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toISO(start), end: toISO(end) };
}

function isPastStr(dateStr: string): boolean {
  return dateStr < toISO(new Date());
}

// ── HistoryRow ────────────────────────────────────────────────────────────────

interface HistoryRowProps {
  date: string;
  cap: number;
  approved: number;
  approvals: ApprovalEntry[];
}

function HistoryRow({ date, cap, approved, approvals }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const utilPct = cap > 0 ? Math.round((approved / cap) * 100) : 0;

  const utilColor =
    utilPct === 0
      ? "text-muted-foreground"
      : utilPct <= 50
        ? "text-success"
        : utilPct < 100
          ? "text-warning"
          : "text-danger";

  const icNames = approvals.map((a) => a.icName);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell>
          <div className="flex items-center gap-1.5">
            {approvals.length > 0 ? (
              expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            <span className="font-medium text-sm">{formatDateStr(date)}</span>
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm text-center">{cap}</TableCell>
        <TableCell className="font-mono text-sm text-center">
          {approved}
        </TableCell>
        <TableCell className="text-center">
          <span className={`font-mono text-sm font-semibold ${utilColor}`}>
            {utilPct}%
          </span>
        </TableCell>
        <TableCell>
          {icNames.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">None</span>
          ) : (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {icNames.slice(0, 3).join(", ")}
              {icNames.length > 3 ? ` +${icNames.length - 3} more` : ""}
            </span>
          )}
        </TableCell>
      </TableRow>
      {expanded && approvals.length > 0 && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={5} className="py-2 px-6">
            <div className="flex flex-wrap gap-2">
              {approvals.map((entry) => (
                <div
                  key={entry.entryId.toString()}
                  className="flex flex-col gap-0.5"
                >
                  <Badge variant="secondary" className="text-xs font-medium">
                    {entry.icName}
                  </Badge>
                  {entry.startHour && entry.endHour && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground px-0.5">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      {entry.startHour} – {entry.endHour}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── DayPopoverContent ─────────────────────────────────────────────────────────

interface DayPopoverContentProps {
  dateStr: string;
  entries: ApprovalEntry[];
}

function DayPopoverContent({ dateStr, entries }: DayPopoverContentProps) {
  return (
    <div className="w-72">
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <p className="text-sm font-semibold text-foreground">
          {formatDateStr(dateStr)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {entries.length} exclusion{entries.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.entryId.toString()}
            className="flex items-start gap-2.5 rounded-md px-2 py-1.5 bg-muted/40"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {entry.icName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {entry.startHour && entry.endHour && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {entry.startHour} – {entry.endHour}
                  </span>
                )}
              </div>
              {entry.managerName && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <User className="h-3 w-3 shrink-0" />
                  {entry.managerName}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CalendarView ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarViewProps {
  mergedMap: Map<string, ApprovalEntry[]>;
  displayMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isLoading: boolean;
}

function CalendarView({
  mergedMap,
  displayMonth,
  onPrevMonth,
  onNextMonth,
  isLoading,
}: CalendarViewProps) {
  const todayStr = toISO(new Date());

  // Build the grid: leading blanks + days in month + trailing blanks
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const cells: Array<{
    dateStr: string | null;
    dayNum: number | null;
    cellKey: string;
  }> = [];

  // Leading blank cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ dateStr: null, dayNum: null, cellKey: `blank-start-${i}` });
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ dateStr, dayNum: d, cellKey: dateStr });
  }

  // Trailing blank cells to complete last row (always 6 rows = 42 cells)
  let trailIdx = 0;
  while (cells.length < 42) {
    cells.push({
      dateStr: null,
      dayNum: null,
      cellKey: `blank-end-${trailIdx++}`,
    });
  }

  const monthLabel = displayMonth.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevMonth}
          className="h-8 w-8 p-0"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm text-foreground tracking-wide">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNextMonth}
          className="h-8 w-8 p-0"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {(["r0", "r1", "r2", "r3", "r4", "r5"] as const).flatMap((row) =>
            WEEKDAYS.map((day) => (
              <Skeleton
                key={`skel-${row}-${day}`}
                className="h-16 rounded-md"
              />
            )),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            if (!cell.dateStr) {
              // Empty/out-of-month cell
              return (
                <div
                  key={cell.cellKey}
                  className="h-16 rounded-md bg-muted/20 opacity-30"
                />
              );
            }

            const entries = mergedMap.get(cell.dateStr) ?? [];
            const hasEntries = entries.length > 0;
            const isToday = cell.dateStr === todayStr;
            const isPast = isPastStr(cell.dateStr);
            const isFuture = cell.dateStr > todayStr;

            const cellBase = [
              "h-16 rounded-md p-1.5 flex flex-col items-start justify-between transition-all duration-150 relative",
              isToday
                ? "ring-2 ring-primary bg-primary/5"
                : "bg-card border border-border hover:bg-muted/30",
              hasEntries ? "cursor-pointer" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const dayNumClass = [
              "text-xs font-semibold leading-none",
              isToday ? "text-primary" : "text-foreground",
            ].join(" ");

            const badgeClass = [
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
              isFuture
                ? "bg-primary/15 text-primary"
                : isPast
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary",
            ].join(" ");

            const cellContent = (
              <div className={cellBase}>
                <span className={dayNumClass}>{cell.dayNum}</span>
                {hasEntries && (
                  <span className={badgeClass}>{entries.length}</span>
                )}
              </div>
            );

            if (!hasEntries) {
              return <div key={cell.cellKey}>{cellContent}</div>;
            }

            return (
              <Popover key={cell.cellKey}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md"
                    aria-label={`${entries.length} exclusion${entries.length !== 1 ? "s" : ""} on ${formatDateStr(cell.dateStr)}`}
                  >
                    {cellContent}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 shadow-card-hover"
                  align="center"
                >
                  <DayPopoverContent dateStr={cell.dateStr} entries={entries} />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary/15 border border-primary/30 inline-block" />
          <span className="text-xs text-muted-foreground">Future</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-muted border border-border inline-block" />
          <span className="text-xs text-muted-foreground">Past</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full ring-2 ring-primary bg-primary/5 inline-block" />
          <span className="text-xs text-muted-foreground">Today</span>
        </div>
      </div>
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────

type ViewMode = "table" | "calendar";

export default function History() {
  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Table view state
  const [startDate, setStartDate] = useState(toISO(subtractDays(today, 30)));
  const [endDate, setEndDate] = useState(toISO(today));
  const [queryStart, setQueryStart] = useState<string | null>(
    toISO(subtractDays(today, 30)),
  );
  const [queryEnd, setQueryEnd] = useState<string | null>(toISO(today));

  // Calendar view state
  const [displayMonth, setDisplayMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Determine effective query range based on view mode
  const effectiveQueryStart =
    viewMode === "calendar" ? getMonthBounds(displayMonth).start : queryStart;
  const effectiveQueryEnd =
    viewMode === "calendar" ? getMonthBounds(displayMonth).end : queryEnd;

  const { data: history = [], isLoading: historyLoading } = useGetHistory(
    effectiveQueryStart,
    effectiveQueryEnd,
  );
  const { data: futureApprovals = [], isLoading: futureLoading } =
    useGetFutureApprovals();

  const isLoading = historyLoading || futureLoading;

  const handleLoad = () => {
    setQueryStart(startDate || null);
    setQueryEnd(endDate || null);
  };

  // Sort descending by date (for table view)
  const sorted = useMemo(
    () => [...history].sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0)),
    [history],
  );

  // Build the merged map for calendar: history + future approvals
  const mergedMap = useMemo(() => {
    const map = new Map<string, ApprovalEntry[]>();

    // From history records
    for (const [dateStr, record] of history) {
      const existing = map.get(dateStr) ?? [];
      map.set(dateStr, [...existing, ...record.approvals]);
    }

    // From future approvals
    for (const entry of futureApprovals) {
      if (entry.exclusionDate) {
        const existing = map.get(entry.exclusionDate) ?? [];
        // Avoid duplicates: entries already in history won't be in futureApprovals
        if (!existing.find((e) => e.entryId === entry.entryId)) {
          map.set(entry.exclusionDate, [...existing, entry]);
        }
      }
    }

    return map;
  }, [history, futureApprovals]);

  // Summary stats (derived from history sorted)
  const stats = useMemo(() => {
    if (sorted.length === 0) {
      return {
        totalDays: 0,
        avgUtil: 0,
        busiestDay: null as string | null,
        busiestCount: 0,
      };
    }

    let totalApproved = 0;
    let totalCap = 0;
    let busiestDay = "";
    let busiestCount = -1;

    for (const [date, record] of sorted) {
      const approved = record.approvals.length;
      totalApproved += approved;
      totalCap += Number(record.cap);
      if (approved > busiestCount) {
        busiestCount = approved;
        busiestDay = date;
      }
    }

    const avgUtil =
      totalCap > 0 ? Math.round((totalApproved / totalCap) * 100) : 0;
    return {
      totalDays: sorted.length,
      avgUtil,
      busiestDay: busiestDay || null,
      busiestCount,
    };
  }, [sorted]);

  const handlePrevMonth = () => {
    setDisplayMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            History & Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Review past and future queue exclusion records
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
              viewMode === "table"
                ? "bg-card shadow-xs text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            aria-pressed={viewMode === "table"}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
              viewMode === "calendar"
                ? "bg-card shadow-xs text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            aria-pressed={viewMode === "calendar"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
      </div>

      {/* Date range filter — table view only */}
      {viewMode === "table" && (
        <Card className="shadow-xs">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="start-date"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-44 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="end-date"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-44 font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleLoad}
                disabled={isLoading}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Load
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-xs">
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                    Days with Data
                  </p>
                  <p className="font-mono text-3xl font-bold text-foreground">
                    {stats.totalDays}
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                    Avg Utilization
                  </p>
                  <p
                    className={`font-mono text-3xl font-bold ${
                      stats.avgUtil <= 50
                        ? "text-success"
                        : stats.avgUtil < 100
                          ? "text-warning"
                          : "text-danger"
                    }`}
                  >
                    {stats.avgUtil}%
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                    Busiest Day
                  </p>
                  {stats.busiestDay ? (
                    <>
                      <p className="font-mono text-xl font-bold text-foreground leading-tight">
                        {formatDateStr(stats.busiestDay)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stats.busiestCount} exclusion
                        {stats.busiestCount !== 1 ? "s" : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <Trophy className="h-5 w-5 text-primary mt-0.5" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CalendarView
              mergedMap={mergedMap}
              displayMonth={displayMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Daily Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  No history found
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try adjusting the date range or check back after the first day
                  of activity
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground pl-8">
                        Date
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground text-center">
                        Cap
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground text-center">
                        Approved
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground text-center">
                        Utilization
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                        IC Names
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map(([date, record]: [string, DailyRecord]) => (
                      <HistoryRow
                        key={date}
                        date={date}
                        cap={Number(record.cap)}
                        approved={record.approvals.length}
                        approvals={record.approvals}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
