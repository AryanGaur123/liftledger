"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type LiftCategory } from "@/lib/lifts";

interface WeeklyMetric {
  weekLabel: string;
  canonical: string;
  category: LiftCategory;
  totalSets: number;
  totalReps: number;
  totalTonnage: number;
  topWeight: number;
}

interface WeeklySummaryProps {
  weeklyMetrics: WeeklyMetric[];
  allWeeks: string[];
}

export default function WeeklySummary({
  weeklyMetrics,
  allWeeks,
}: WeeklySummaryProps) {
  // Show the most recent week's summary as natural language cards
  const latestWeek = allWeeks[allWeeks.length - 1];
  if (!latestWeek) return null;

  const latestMetrics = weeklyMetrics.filter(
    (m) => m.weekLabel === latestWeek
  );

  // Sort by tonnage descending
  const sorted = [...latestMetrics].sort(
    (a, b) => b.totalTonnage - a.totalTonnage
  );

  if (sorted.length === 0) return null;

  return (
    <Card data-testid="card-weekly-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">
            Latest Week — {latestWeek}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            This week
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((m) => (
            <div
              key={m.canonical}
              className="flex items-start gap-3 rounded-lg border p-3 bg-background"
              data-testid={`card-weekly-lift-${m.canonical}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{m.canonical}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CATEGORY_LABELS[m.category]}
                </p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Sets</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {m.totalSets}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reps</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {m.totalReps}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tonnage</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {m.totalTonnage.toLocaleString()} kg
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
