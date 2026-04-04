"use client";

import { cn } from "@/lib/utils";
import { Calendar, CheckCircle, ChevronRight } from "lucide-react";

interface DayInfo {
  dayLabel: string;
  exerciseCount: number;
  hasBeenLogged: boolean;
}

interface DaySelectorProps {
  days: DayInfo[];
  todayLabel: string | null;
  onSelect: (dayLabel: string) => void;
}

export default function DaySelector({ days, todayLabel, onSelect }: DaySelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">Select Training Day</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a day to start logging
          </p>
        </div>

        <div className="space-y-2">
          {days.map((day) => {
            const isToday = todayLabel !== null &&
              day.dayLabel.toUpperCase() === todayLabel.toUpperCase();
            return (
              <button
                key={day.dayLabel}
                onClick={() => onSelect(day.dayLabel)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-lg border transition-all",
                  "hover:bg-accent hover:border-primary/50 active:scale-[0.98]",
                  isToday
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-md flex items-center justify-center",
                      isToday ? "bg-primary text-primary-foreground" : "bg-secondary"
                    )}
                  >
                    {day.hasBeenLogged ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Calendar className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">
                      {day.dayLabel}
                      {isToday && (
                        <span className="ml-2 text-xs text-primary font-normal">Today</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {day.exerciseCount} exercise{day.exerciseCount !== 1 ? "s" : ""}
                      {day.hasBeenLogged && " · Logged"}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
