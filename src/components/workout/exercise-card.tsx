"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import RPEPicker from "./rpe-picker";
import BarbellVisual from "./barbell-visual";
import { ChevronRight, Weight, Eye, EyeOff, Plus, Minus } from "lucide-react";

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

interface ExerciseCardProps {
  exercise: ExerciseData;
  index: number;
  total: number;
  onNext: (data: { rpe: number | null; weight: number; weightChanged: boolean }) => void;
  saving: boolean;
  savedRpe?: number | null;   // flash "saved" confirmation
  displayUnit: "lbs" | "kg";
  onUnitChange: (u: "lbs" | "kg") => void;
}

export default function ExerciseCard({
  exercise,
  index,
  total,
  onNext,
  saving,
  savedRpe,
  displayUnit,
  onUnitChange,
}: ExerciseCardProps) {
  const [rpe, setRpe] = useState<number | null>(exercise.actualRPE);
  const [weight, setWeight] = useState<number | null>(exercise.load > 0 ? exercise.load : null);
  const [editingWeight, setEditingWeight] = useState(exercise.load === 0);
  // Auto-show bar on barbell lifts that already have a programmed weight
  const [showBar, setShowBar] = useState(exercise.isBarbell && exercise.load > 0);
  const [justSaved, setJustSaved] = useState(false);

  const noWeightProgrammed = exercise.load === 0;
  const isLast = index === total - 1;
  const canShowBar = exercise.isBarbell && weight != null && weight > 0;
  const weightForBar = weight ?? 0;
  const isDropSet = exercise.dropFromLoad != null;

  // Flash "Saved" after each exercise save
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

  // Build the prescription line
  function prescriptionLine() {
    const parts: string[] = [`${exercise.sets}×${exercise.reps}`];
    if (exercise.load > 0) parts.push(`@ ${exercise.load} ${displayUnit}`);
    if (isDropSet && exercise.dropFromLoad) {
      const pct = exercise.prescribedRPE?.match(/drop\s*(\d+(?:\.\d+)?)%/i)?.[1];
      parts.push(`drop ${pct}% of ${exercise.dropFromLoad} ${displayUnit} → ${exercise.load} ${displayUnit}`);
    } else if (exercise.prescribedRPE && !/drop/i.test(exercise.prescribedRPE)) {
      parts.push(exercise.prescribedRPE);
    }
    return parts.join("  ·  ");
  }

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 py-4 max-w-lg mx-auto">
      {/* Progress + unit toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
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
        {/* Movement name + tempo */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold leading-tight">{exercise.movement}</h2>
          {exercise.tempo && (
            <p className="text-xs text-muted-foreground tracking-wide uppercase">
              Tempo {exercise.tempo}
            </p>
          )}
        </div>

        {/* Prescription line */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {prescriptionLine()}
          </p>
          {/* Previous RPE hint */}
          {exercise.actualRPE != null && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Last session: RPE {exercise.actualRPE}
            </p>
          )}
        </div>

        {/* Weight section */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            {/* Decrement */}
            <button
              onClick={() => adjustWeight(-2.5)}
              className="h-9 w-9 rounded-full border bg-secondary flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-1.5">
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
                    onBlur={() => {
                      if (weight != null && weight > 0) setEditingWeight(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && weight != null && weight > 0) setEditingWeight(false);
                    }}
                    autoFocus
                    step="2.5"
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

            {/* Increment */}
            <button
              onClick={() => adjustWeight(2.5)}
              className="h-9 w-9 rounded-full border bg-secondary flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Show/Hide Bar */}
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
            <p className="text-center text-xs text-muted-foreground/60">
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
          {saving ? (
            "Saving..."
          ) : justSaved ? (
            "Saved ✓"
          ) : isLast ? (
            "Finish Workout"
          ) : (
            <>
              Next Exercise
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
