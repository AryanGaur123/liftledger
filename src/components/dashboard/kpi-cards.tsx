"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, Weight, TrendingUp, Calendar, Repeat, Target } from "lucide-react";

interface KPICardsProps {
  data: {
    totalSets: number;
    totalReps: number;
    totalTonnage: number;
    weekCount: number;
    liftCount: number;
    topWeight: number;
    weightUnit?: "lbs" | "kg";
  };
}

export default function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: "Total Sets",
      value: data.totalSets.toLocaleString(),
      icon: Repeat,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Reps",
      value: data.totalReps.toLocaleString(),
      icon: Dumbbell,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Total Tonnage",
      value: `${(data.totalTonnage / 1000).toFixed(1)}k ${data.weightUnit ?? "lbs"}`,
      icon: Weight,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Weeks",
      value: data.weekCount.toString(),
      icon: Calendar,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
    },
    {
      label: "Exercises",
      value: data.liftCount.toString(),
      icon: Target,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Top Weight",
      value: `${Math.round(data.topWeight)} ${data.weightUnit ?? "lbs"}`,
      icon: TrendingUp,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="overflow-hidden"
          data-testid={`card-kpi-${card.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-lg font-bold tabular-nums">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
