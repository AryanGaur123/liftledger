"use client";

import { cn } from "@/lib/utils";

interface RPEPickerProps {
  value: number | null;
  onChange: (rpe: number) => void;
}

const RPE_VALUES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function rpeColor(rpe: number): string {
  if (rpe <= 6) return "bg-green-600 text-white";
  if (rpe <= 7.5) return "bg-yellow-500 text-black";
  if (rpe <= 8.5) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

export default function RPEPicker({ value, onChange }: RPEPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">RPE</label>
      <div className="flex flex-wrap gap-1.5">
        {RPE_VALUES.map((rpe) => (
          <button
            key={rpe}
            type="button"
            onClick={() => onChange(rpe)}
            className={cn(
              "min-w-[2.75rem] h-10 rounded-md text-sm font-semibold transition-all",
              "border border-border hover:scale-105 active:scale-95",
              value === rpe
                ? rpeColor(rpe) + " ring-2 ring-ring ring-offset-2 ring-offset-background"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            {rpe % 1 === 0 ? rpe : rpe.toFixed(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
