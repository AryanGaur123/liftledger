"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
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
  totalSets: number;
  totalReps: number;
  totalTonnage: number;
}

type MetricKey = "totalSets" | "totalReps" | "totalTonnage";

const makeMetricOptions = (unit: string) => [
  { key: "totalSets" as MetricKey, label: "Sets", format: (v: number) => v.toString() },
  { key: "totalReps" as MetricKey, label: "Reps", format: (v: number) => v.toString() },
  {
    key: "totalTonnage" as MetricKey,
    label: "Tonnage",
    format: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k ${unit}` : `${Math.round(v)} ${unit}`),
  },
];

const CATEGORY_COLORS: Record<LiftCategory, string> = {
  squat: "hsl(221, 83%, 53%)",
  bench: "hsl(27, 87%, 55%)",
  deadlift: "hsl(262, 83%, 58%)",
  overhead_press: "hsl(173, 58%, 39%)",
  row: "hsl(43, 74%, 49%)",
  accessory: "hsl(215, 10%, 54%)",
};

interface VolumeChartProps {
  weeklyMetrics: WeeklyMetric[];
  allWeeks: string[];
  weightUnit?: "lbs" | "kg";
}

export default function VolumeChart({
  weeklyMetrics,
  allWeeks,
  weightUnit = "lbs",
}: VolumeChartProps) {
  const [metric, setMetric] = useState<MetricKey>("totalTonnage");

  // Group metrics by week and category
  const categories = Array.from(
    new Set(weeklyMetrics.map((m) => m.category))
  ).sort();

  const chartData = allWeeks.map((week) => {
    const entry: Record<string, unknown> = { week };
    for (const cat of categories) {
      const weekMetrics = weeklyMetrics.filter(
        (m) => m.weekLabel === week && m.category === cat
      );
      entry[cat] = weekMetrics.reduce((sum, m) => sum + m[metric], 0);
    }
    return entry;
  });

  const METRIC_OPTIONS = makeMetricOptions(weightUnit);
  const activeMetric = METRIC_OPTIONS.find((m) => m.key === metric)!;

  return (
    <Card data-testid="card-volume-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold">
            Weekly Volume by Category
          </CardTitle>
          <div className="flex gap-1">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMetric(opt.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  metric === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
                data-testid={`button-metric-${opt.key}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
                tickFormatter={activeMetric.format}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 13,
                }}
                formatter={(value: any) => [
                  activeMetric.format(Number(value)),
                  undefined,
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  CATEGORY_LABELS[value as LiftCategory] || value
                }
              />
              {categories.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="volume"
                  fill={CATEGORY_COLORS[cat as LiftCategory] || "#888"}
                  radius={[2, 2, 0, 0]}
                  name={cat}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
