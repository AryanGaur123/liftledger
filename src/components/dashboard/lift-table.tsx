"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type LiftCategory } from "@/lib/lifts";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WeeklyMetric {
  weekLabel: string;
  canonical: string;
  category: LiftCategory;
  totalSets: number;
  totalReps: number;
  totalTonnage: number;
  avgWeight: number;
  topWeight: number;
  avgRpe: number | null;
}

interface LiftTableProps {
  weeklyMetrics: WeeklyMetric[];
  allWeeks: string[];
  weightUnit?: "lbs" | "kg";
}

type SortKey = "canonical" | "totalSets" | "totalReps" | "totalTonnage" | "topWeight";

const CATEGORY_BADGE_COLORS: Record<LiftCategory, string> = {
  squat: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  bench: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  deadlift: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  overhead_press: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20",
  row: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accessory: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

export default function LiftTable({ weeklyMetrics, allWeeks, weightUnit = "lbs" }: LiftTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalTonnage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Aggregate metrics
  const filtered =
    selectedWeek === "all"
      ? weeklyMetrics
      : weeklyMetrics.filter((m) => m.weekLabel === selectedWeek);

  // Group by lift
  const liftMap = new Map<
    string,
    {
      canonical: string;
      category: LiftCategory;
      totalSets: number;
      totalReps: number;
      totalTonnage: number;
      topWeight: number;
    }
  >();

  for (const m of filtered) {
    if (!liftMap.has(m.canonical)) {
      liftMap.set(m.canonical, {
        canonical: m.canonical,
        category: m.category,
        totalSets: 0,
        totalReps: 0,
        totalTonnage: 0,
        topWeight: 0,
      });
    }
    const l = liftMap.get(m.canonical)!;
    l.totalSets += m.totalSets;
    l.totalReps += m.totalReps;
    l.totalTonnage += m.totalTonnage;
    l.topWeight = Math.max(l.topWeight, m.topWeight);
  }

  const rows = Array.from(liftMap.values()).sort((a, b) => {
    const aVal = a[sortKey] as number | string;
    const bVal = b[sortKey] as number | string;
    if (typeof aVal === "string") {
      return sortDir === "asc"
        ? (aVal as string).localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal as string);
    }
    return sortDir === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <Card data-testid="card-lift-table">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold">
            Lift Breakdown
          </CardTitle>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-week"
          >
            <option value="all">All Weeks</option>
            {allWeeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-lifts">
            <thead>
              <tr className="border-b">
                <th
                  className="text-left py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("canonical")}
                >
                  Exercise <SortIcon col="canonical" />
                </th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                  Category
                </th>
                <th
                  className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("totalSets")}
                >
                  Sets <SortIcon col="totalSets" />
                </th>
                <th
                  className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("totalReps")}
                >
                  Reps <SortIcon col="totalReps" />
                </th>
                <th
                  className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("totalTonnage")}
                >
                  Tonnage <SortIcon col="totalTonnage" />
                </th>
                <th
                  className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("topWeight")}
                >
                  Top ({weightUnit}) <SortIcon col="topWeight" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.canonical}
                  className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                  data-testid={`row-lift-${row.canonical}`}
                >
                  <td className="py-2.5 px-2 font-medium">{row.canonical}</td>
                  <td className="py-2.5 px-2">
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${
                        CATEGORY_BADGE_COLORS[row.category]
                      }`}
                    >
                      {CATEGORY_LABELS[row.category]}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {row.totalSets}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {row.totalReps}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-medium">
                    {Math.round(row.totalTonnage).toLocaleString()} {weightUnit}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {Math.round(row.topWeight)} {weightUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
