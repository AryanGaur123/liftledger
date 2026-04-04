"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import RPEPicker from "./rpe-picker";
import BarbellVisual from "./barbell-visual";
import { ChevronRight, Weight, Eye, EyeOff } from "lucide-react";

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
}

interface ExerciseCardProps {
  exercise: ExerciseData;
  index: number;
  total: number;
  onNext: (data: { rpe: number | null; weight: number; weightChanged: boolean }) => void;
  saving: boolean;
}

const LBS_TO_KG = 1 / 2.20462;

export default function ExerciseCard({
  exercise,
  index,
  total,
  onNext,
  saving,
}: ExerciseCardProps) {
  const [rpe, setRpe] = useState<number | null>(exercise.actualRPE);
  const [weight, setWeight] = useState(exercise.load);
  const [editingWeight, setEditingWeight] = useState(false);
  const [showBar, setShowBar] = useState(false);

  const weightChanged = weight !== exercise.load;
  const isLast = index === total - 1;

  // For barbell visual, convert to KG if needed
  const weightInKg = exercise.loadUnit === "lbs" ? weight * LBS_TO_KG : weight;

  return (
    <div className="flex flex-col min-h-[70vh] px-4">
      {/* Progress */}
      <div className="text-center py-3">
        <span className="text-xs text-muted-foreground">
          Exercise {index + 1} of {total}
        </span>
        <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Exercise info */}
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">{exercise.movement}</h2>
          {exercise.tempo && (
            <p className="text-sm text-muted-foreground">Tempo: {exercise.tempo}</p>
          )}
        </div>

        {/* Prescribed */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            {exercise.sets}&times;{exercise.reps}
            {exercise.load > 0 && ` @ ${exercise.load}${exercise.loadUnit}`}
            {exercise.prescribedRPE && ` RPE ${exercise.prescribedRPE}`}
          </p>
        </div>

        {/* Weight display/edit */}
        {exercise.load > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Weight className="h-5 w-5 text-muted-foreground" />
              {editingWeight ? (
                <input
                  type="number"
                  value={weight || ""}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  onBlur={() => setEditingWeight(false)}
                  autoFocus
                  step="any"
                  className="w-28 h-10 text-center text-lg font-bold bg-secondary border border-border rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setEditingWeight(true)}
                  className="text-2xl font-bold hover:text-primary transition-colors"
                >
                  {weight}{exercise.loadUnit}
                  {weightChanged && (
                    <span className="text-xs text-primary ml-1">(edited)</span>
                  )}
                </button>
              )}
            </div>

            {/* Show Bar button for barbell lifts */}
            {exercise.isBarbell && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBar(!showBar)}
                  className="gap-1.5"
                >
                  {showBar ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {showBar ? "Hide Bar" : "Show Bar"}
                </Button>
              </div>
            )}

            {/* Barbell plate visual */}
            {showBar && exercise.isBarbell && (
              <div className="border rounded-lg p-3 bg-secondary/50">
                <BarbellVisual totalWeight={weightInKg} />
              </div>
            )}
          </div>
        )}

        {/* RPE picker */}
        <RPEPicker value={rpe} onChange={setRpe} />

        {/* Next / Finish button */}
        <Button
          onClick={() => onNext({ rpe, weight, weightChanged })}
          disabled={saving}
          className="w-full h-12 text-base font-semibold gap-2"
          size="lg"
        >
          {saving ? (
            "Saving..."
          ) : isLast ? (
            "Finish Workout"
          ) : (
            <>
              Next Exercise
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
