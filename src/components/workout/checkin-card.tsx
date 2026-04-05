"use client";

import { cn } from "@/lib/utils";
import { Moon, Brain, Apple, Heart, Zap, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckInCardProps {
  ratings: Record<string, number | null>;
  priorRatings: Record<string, number | null>;
  onRate: (category: string, value: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

const CATEGORIES: {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  lowLabel: string;
  highLabel: string;
}[] = [
  { key: "Sleep",     label: "Sleep",     icon: Moon,  lowLabel: "Poor",  highLabel: "Great"  },
  { key: "Stress",    label: "Stress",    icon: Brain, lowLabel: "High",  highLabel: "Low"    },
  { key: "Nutrition", label: "Nutrition", icon: Apple, lowLabel: "Poor",  highLabel: "Great"  },
  { key: "Recovery",  label: "Recovery",  icon: Heart, lowLabel: "Sore",  highLabel: "Fresh"  },
  { key: "Strength",  label: "Strength",  icon: Zap,   lowLabel: "Weak",  highLabel: "Strong" },
];

export default function CheckInCard({
  ratings,
  priorRatings,
  onRate,
  onContinue,
  onBack,
}: CheckInCardProps) {
  const allRated = CATEGORIES.every(({ key }) => ratings[key] != null);
  const hasPrior = Object.values(priorRatings).some((v) => v != null);

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 py-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Days
        </button>
        <span className="text-sm font-semibold">Pre-Workout Check-In</span>
        <div className="w-16" /> {/* spacer */}
      </div>

      {hasPrior && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          Previous ratings shown — tap to change
        </p>
      )}

      <div className="flex-1 flex flex-col justify-center space-y-5">
        {CATEGORIES.map(({ key, label, icon: Icon, lowLabel, highLabel }) => {
          const prior = priorRatings[key];
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
                {prior != null && ratings[key] == null && (
                  <span className="text-xs text-muted-foreground/50 ml-auto">was {prior}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 shrink-0">{lowLabel}</span>
                <div className="flex gap-1.5 flex-1 justify-center">
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isSelected = ratings[key] === val;
                    const isPrior = prior === val && ratings[key] == null;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => onRate(key, val)}
                        className={cn(
                          "w-11 h-11 rounded-lg text-sm font-semibold transition-all",
                          "border hover:scale-105 active:scale-95",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary ring-2 ring-ring ring-offset-1 ring-offset-background"
                            : isPrior
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                        )}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{highLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-6">
        <Button
          onClick={onContinue}
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
