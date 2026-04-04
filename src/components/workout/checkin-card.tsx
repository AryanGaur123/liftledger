"use client";

import { cn } from "@/lib/utils";
import { Moon, Brain, Apple, Heart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckInRatings {
  sleep: number;
  stress: number;
  nutrition: number;
  recovery: number;
  strength: number;
}

interface CheckInCardProps {
  ratings: CheckInRatings;
  onChange: (ratings: CheckInRatings) => void;
  onSubmit: () => void;
}

const CATEGORIES: {
  key: keyof CheckInRatings;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  lowLabel: string;
  highLabel: string;
}[] = [
  { key: "sleep", label: "Sleep", icon: Moon, lowLabel: "Poor", highLabel: "Great" },
  { key: "stress", label: "Stress", icon: Brain, lowLabel: "High", highLabel: "Low" },
  { key: "nutrition", label: "Nutrition", icon: Apple, lowLabel: "Poor", highLabel: "Great" },
  { key: "recovery", label: "Recovery", icon: Heart, lowLabel: "Sore", highLabel: "Fresh" },
  { key: "strength", label: "Strength", icon: Zap, lowLabel: "Weak", highLabel: "Strong" },
];

export default function CheckInCard({ ratings, onChange, onSubmit }: CheckInCardProps) {
  const allRated = Object.values(ratings).every((v) => v > 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold">Pre-Workout Check-In</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rate how you&apos;re feeling today
          </p>
        </div>

        <div className="space-y-5">
          {CATEGORIES.map(({ key, label, icon: Icon, lowLabel, highLabel }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10">{lowLabel}</span>
                <div className="flex gap-1.5 flex-1 justify-center">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChange({ ...ratings, [key]: val })}
                      className={cn(
                        "w-10 h-10 rounded-md text-sm font-semibold transition-all",
                        "border hover:scale-105 active:scale-95",
                        ratings[key] === val
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-ring ring-offset-1 ring-offset-background"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{highLabel}</span>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={onSubmit}
          disabled={!allRated}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {allRated ? "Start Workout" : "Rate all categories to continue"}
        </Button>
      </div>
    </div>
  );
}
