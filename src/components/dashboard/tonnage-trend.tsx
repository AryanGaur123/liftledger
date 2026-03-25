"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, type LiftCategory } from "@/lib/lifts";

interface WeeklyMetric {
  weekLabel: string;
  canonical: string;
  category: LiftCategory;
  totalTonnage: number;
  topWeight: number;
}

const LIFT_COLORS: Record<string, string> = {
  "Back Squat": "hsl(221, 83%, 53%)",
  "Bench Press": "hsl(27, 87%, 55%)",
  Deadlift: "hsl(262, 83%, 58%)",
  "Sumo Deadlift": "hsl(280, 70%, 55%)",
  "Overhead Press": "hsl(173, 58%, 39%)",
  "Close Grip Bench": "hsl(15, 80%, 50%)",
  "Front Squat": "hsl(200, 70%, 50%)",
  "Pause Squat": "hsl(230, 60%, 60%)",
  "Romanian Deadlift": "hsl(300, 60%, 50%)",
  "Barbell Row": "hsl(43, 74%, 49%)",
};

function getLiftColor(canonical: string, idx: number): string {
  if (LIFT_COLORS[canonical]) return LIFT_COLORS[canonical];
  const hues = [221, 27, 262, 173, 43, 340, 150, 80, 310, 55];
  return `hsl(${hues[idx % hues.length]}, 70%, 55%)`;
}

interface TonnageTrendProps {
  weeklyMetrics: WeeklyMetric[];
  allWeeks: string[];
}

export default function TonnageTrend({
  weeklyMetrics,
  allWeeks,
}: TonnageTrendProps) {
  // Get unique lifts that are competition or high-volume
  const liftTotals = new Map<string, number>();
  for (const m of weeklyMetrics) {
    liftTotals.set(
      m.canonical,
      (liftTotals.get(m.canonical) || 0) + m.totalTonnage
    );
  }
  const topLifts = Array.from(liftTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  // Build chart data
  const chartData = allWeeks.map((week) => {
    const entry: Record<string, unknown> = { week };
    for (const lift of topLifts) {
      const m = weeklyMetrics.find(
        (m) => m.weekLabel === week && m.canonical === lift
      );
      entry[lift] = m ? m.totalTonnage : 0;
    }
    return entry;
  });

  return (
    <Card data-testid="card-tonnage-trend">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Tonnage Trend by Lift
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 13,
                }}
                formatter={(value: any, name: any) => [
                  `${Number(value).toLocaleString()} kg`,
                  name,
                ]}
              />
              <Legend />
              {topLifts.map((lift, idx) => (
                <Line
                  key={lift}
                  type="monotone"
                  dataKey={lift}
                  stroke={getLiftColor(lift, idx)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
