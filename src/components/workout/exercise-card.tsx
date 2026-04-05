"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import RPEPicker from "./rpe-picker";
import BarbellVisual from "./barbell-visual";
import { ChevronLeft, ChevronRight, Weight, Eye, EyeOff, Plus, Minus } from "lucide-react";

export interface ExerciseData {
  rowIndex: number;
  movement: string;
  tempo: string | null;
  sets: number;
  reps: number;
  load: number;
  loadUnit: "lbs" | "kg";
  prescribedRPE: string | null;
  actualRPE: number | null;
  isBarbell: boolean;
  dropFromLoad: number | null;
}

interface ExerciseResult {
  rpe: number | null;
  weight: number;
}

interface ExerciseCardProps {
  exercise: ExerciseData;
  index: number;
  total: number;
  onNext: (data: { rpe: number | null; weight: number; weightChanged: boolean }) => void;
  onBack: () => void;
  saving: boolean;
  savedRpe?: number | null;
  displayUnit: "lbs" | "kg";
  onUnitChange: (u: "lbs" | "kg") => void;
  priorResult: ExerciseResult | null; // previously logged result for this exercise in this session
}

// Strip coach/classification suffixes from display name
function cleanMovementName(name: string): string {
  return name.replace(/\s*\((Primary|Secondary|Tertiary|Accessory|Main)\)\s*/i, "").trim();
}

export default function ExerciseCard({
  exercise,
  index,
  total,
  onNext,
  onBack,
  saving,
  savedRpe,
  displayUnit,
  onUnitChange,
  priorResult,
}: ExerciseCardProps) {
  const [rpe, setRpe] = useState<number | null>(
    priorResult?.rpe ?? exercise.actualRPE
  );
  const [weight, setWeight] = useState<number | null>(
    priorResult?.weight != null && priorResult.weight > 0
      ? priorResult.weight
      : exercise.load > 0 ? exercise.load : null
  );
  const [editingWeight, setEditingWeight] = useState(exercise.load === 0 && !priorResult);
  const [showBar, setShowBar] = useState(exercise.isBarbell && (exercise.load > 0 || (priorResult?.weight ?? 0) > 0));
  const [justSaved, setJustSaved] = useState(false);

  const noWeightProgrammed = exercise.load === 0;
  const isLast = index === total - 1;
  const canShowBar = exercise.isBarbell && weight != null && weight > 0;
  const weightForBar = weight ?? 0;
  const isDropSet = exercise.dropFromLoad != null;
  const displayName = cleanMovementName(exercise.movement);

  useEffect(() => {
    if (saving === false && savedRpe !== undefined) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [saving, savedRpe]);

  function adjustWeight(delta: number) {
    setWeight((prev) => {
      const base = prev ?? 0;
      return Math.max(0, Math.round((base + delta) * 10) / 10);
    });
  }

  // Build drop % line if applicable
  function dropLine() {
    if (!isDropSet || !exercise.dropFromLoad) return null;
    const pct = exercise.prescribedRPE?.match(/drop\s*(\d+(?:\.\d+)?)%/i)?.[1];
    return `Drop ${pct}% of ${exercise.dropFromLoad} ${displayUnit} → ${exercise.load} ${displayUnit}`;
  }

  // The RPE string to show, excluding drop lines
  function rpeLabel() {
    if (!exercise.prescribedRPE) return null;
    if (/drop/i.test(exercise.prescribedRPE)) return null;
    return exercise.prescribedRPE;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 py-4 max-w-lg mx-auto">

      {/* Top row: back + counter + unit toggle */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {index === 0 ? "Check-in" : "Back"}
        </button>

        <span className="text-xs text-muted-foreground font-medium">
          {index + 1} / {total}
        </span>

        <div className="flex items-center gap-0.5 rounded-md border p-0.5 text-xs">
          {(["lbs", "kg"] as const).map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`px-2.5 py-1 rounded transition-colors ${
                displayUnit === u
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-secondary rounded-full h-1 mb-5">
        <div
          className="bg-primary h-1 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-5">

        {/* Movement name */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold leading-tight">{displayName}</h2>
          {/* Show classification subtly if stripped */}
          {displayName !== exercise.movement && (
            <p className="text-xs text-muted-foreground/50">
              {exercise.movement.match(/\((Primary|Secondary|Tertiary|Accessory|Main)\)/i)?.[1]}
            </p>
          )}
          {exercise.tempo && (
            <p className="text-xs text-muted-foreground tracking-wide uppercase">
              Tempo {exercise.tempo}
            </p>
          )}
        </div>

        {/* Sets × Reps chips + prescribed info */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-4 py-2">
              <span className="text-2xl font-bold tabular-nums">{exercise.sets}</span>
              <span className="text-muted-foreground font-medium">sets</span>
            </div>
            <span className="text-xl text-muted-foreground">×</span>
            <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-4 py-2">
              <span className="text-2xl font-bold tabular-nums">{exercise.reps}</span>
              <span className="text-muted-foreground font-medium">reps</span>
            </div>
          </div>

          {/* Prescribed RPE / drop info */}
          <div className="text-center space-y-0.5">
            {rpeLabel() && (
              <p className="text-sm text-muted-foreground">{rpeLabel()}</p>
            )}
            {dropLine() && (
              <p className="text-sm text-primary/80">{dropLine()}</p>
            )}
            {exercise.actualRPE != null && !priorResult && (
              <p className="text-xs text-muted-foreground/50">Last logged: RPE {exercise.actualRPE}</p>
            )}
          </div>
        </div>

        {/* Weight section */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            {/* –5 */}
            <button
              onClick={() => adjustWeight(-5)}
              className="h-10 w-10 rounded-full border bg-secondary flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 min-w-[120px] justify-center">
              <Weight className="h-4 w-4 text-muted-foreground shrink-0" />

              {editingWeight ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={weight ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setWeight(isNaN(v) ? null : v);
                    }}
                    onBlur={() => { if (weight != null && weight > 0) setEditingWeight(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && weight != null && weight > 0) setEditingWeight(false); }}
                    autoFocus
                    step="5"
                    className="w-24 h-10 text-center text-xl font-bold bg-secondary border border-primary rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <span className="text-sm text-muted-foreground">{displayUnit}</span>
                </div>
              ) : weight != null ? (
                <button
                  onClick={() => setEditingWeight(true)}
                  className="text-2xl font-bold hover:text-primary transition-colors tabular-nums"
                >
                  {weight}
                  <span className="text-base font-normal text-muted-foreground ml-0.5">{displayUnit}</span>
                  {weight !== exercise.load && exercise.load > 0 && (
                    <span className="text-xs text-primary ml-1.5">(edited)</span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setEditingWeight(true)}
                  className="text-base font-semibold text-primary underline underline-offset-4"
                >
                  Tap to enter weight
                </button>
              )}
            </div>

            {/* +5 */}
            <button
              onClick={() => adjustWeight(5)}
              className="h-10 w-10 rounded-full border bg-secondary flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Show/Hide plates */}
          {exercise.isBarbell && canShowBar && (
            <div className="text-center">
              <button
                onClick={() => setShowBar(!showBar)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showBar ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showBar ? "Hide plates" : "Show plates"}
              </button>
            </div>
          )}

          {exercise.isBarbell && !canShowBar && (
            <p className="text-center text-xs text-muted-foreground/50">
              Enter weight to see plate loading
            </p>
          )}

          {showBar && canShowBar && (
            <div className="border rounded-xl p-3 bg-secondary/40">
              <BarbellVisual weightLbs={weightForBar} />
            </div>
          )}
        </div>

        {/* RPE picker */}
        <RPEPicker value={rpe} onChange={setRpe} />

        {/* Next button */}
        <Button
          onClick={() => onNext({ rpe, weight: weight ?? 0, weightChanged: weight !== exercise.load })}
          disabled={saving || (noWeightProgrammed && (weight == null || weight === 0))}
          className="w-full h-12 text-base font-semibold gap-2"
          size="lg"
        >
          {saving ? "Saving..." : justSaved ? "Saved ✓" : isLast ? "Finish Workout" : (
            <>Next Exercise <ChevronRight className="h-4 w-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
