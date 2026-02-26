import React, { useState, useMemo } from "react";
import { CalendarDays, Search, TrendingUp, Trophy, BarChart3, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetHistory } from "@/hooks/useQueries";
import type { ApprovalEntry } from "../backend.d";

function formatDateStr(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
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
        <TableCell className="font-mono text-sm text-center">{approved}</TableCell>
        <TableCell className="text-center">
          <span className={`font-mono text-sm font-semibold ${utilColor}`}>{utilPct}%</span>
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

export default function History() {
  const today = new Date();
  const [startDate, setStartDate] = useState(toISO(subtractDays(today, 30)));
  const [endDate, setEndDate] = useState(toISO(today));
  const [queryStart, setQueryStart] = useState<string | null>(toISO(subtractDays(today, 30)));
  const [queryEnd, setQueryEnd] = useState<string | null>(toISO(today));

  const { data: history = [], isLoading } = useGetHistory(queryStart, queryEnd);

  const handleLoad = () => {
    setQueryStart(startDate || null);
    setQueryEnd(endDate || null);
  };

  // Sort descending by date
  const sorted = useMemo(
    () =>
      [...history].sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0)),
    [history]
  );

  // Summary stats
  const stats = useMemo(() => {
    if (sorted.length === 0)
      return { totalDays: 0, avgUtil: 0, busiestDay: null as string | null, busiestCount: 0 };

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

    const avgUtil = totalCap > 0 ? Math.round((totalApproved / totalCap) * 100) : 0;
    return {
      totalDays: sorted.length,
      avgUtil,
      busiestDay: busiestDay || null,
      busiestCount,
    };
  }, [sorted]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History & Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Review past daily queue exclusion records
        </p>
      </div>

      {/* Date range filter */}
      <Card className="shadow-xs">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
              <Label htmlFor="end-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <Button onClick={handleLoad} disabled={isLoading} className="gap-2">
              <Search className="h-4 w-4" />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

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
                        {stats.busiestCount} exclusion{stats.busiestCount !== 1 ? "s" : ""}
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

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Daily Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">No history found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try adjusting the date range or check back after the first day of activity
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
                  {sorted.map(([date, record]) => (
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
    </div>
  );
}
