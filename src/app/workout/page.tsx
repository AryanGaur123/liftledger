"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import DaySelector from "@/components/workout/day-selector";
import CheckInCard from "@/components/workout/checkin-card";
import ExerciseCard from "@/components/workout/exercise-card";
import {
  ArrowLeft,
  Loader2,
  Dumbbell,
  CheckCircle2,
  Trophy,
} from "lucide-react";

export default function WorkoutPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <WorkoutPageInner />
    </Suspense>
  );
}

type Step = "day-select" | "checkin" | "exercise" | "complete";

interface ExerciseData {
  rowIndex: number;
  movement: string;
  tempo: string;
  sets: number;
  reps: number;
  load: number;
  loadUnit: "lbs" | "kg";
  prescribedRPE: string;
  actualRPE: number | null;
  isBarbell: boolean;
}

interface FeedbackSlots {
  [key: string]: { row: number; value: number | null };
}

interface DayInfo {
  dayLabel: string;
  exerciseCount: number;
  hasBeenLogged: boolean;
}

interface LoggedExercise {
  movement: string;
  load: number;
  loadUnit: string;
  rpe: number | null;
  sets: number;
  reps: number;
}

interface CheckInRatings {
  sleep: number;
  stress: number;
  nutrition: number;
  recovery: number;
  strength: number;
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function WorkoutPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const fileId = searchParams.get("fileId");
  const sheetName = searchParams.get("sheetName");

  const [step, setStep] = useState<Step>("day-select");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day selector state
  const [days, setDays] = useState<DayInfo[]>([]);

  // Exercise state
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [feedbackSlots, setFeedbackSlots] = useState<FeedbackSlots>({});
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // Check-in state
  const [ratings, setRatings] = useState<CheckInRatings>({
    sleep: 0,
    stress: 0,
    nutrition: 0,
    recovery: 0,
    strength: 0,
  });

  // Logged data for summary
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);

  const todayLabel = useMemo(() => DAY_NAMES[new Date().getDay()], []);

  // Fetch available days from the sheet
  useEffect(() => {
    if (!fileId || !sheetName || status !== "authenticated") return;

    async function fetchDays() {
      setLoading(true);
      setError(null);
      try {
        // Fetch each possible day in parallel and see which ones have exercises
        const dayLabels = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
        const promises = dayLabels.map(async (dayLabel) => {
          const r = await fetch(
            `/api/workout/day?fileId=${encodeURIComponent(fileId!)}&sheetName=${encodeURIComponent(sheetName!)}&dayLabel=${dayLabel}`
          );
          if (!r.ok) return null;
          const data = await r.json();
          if (data.exercises && data.exercises.length > 0) {
            return {
              dayLabel,
              exerciseCount: data.exercises.length,
              hasBeenLogged: data.exercises.some((e: any) => e.actualRPE !== null),
            };
          }
          return null;
        });

        const results = await Promise.all(promises);
        const validDays = results.filter(Boolean) as DayInfo[];
        setDays(validDays);
      } catch (err: any) {
        setError(err.message || "Failed to load training days");
      } finally {
        setLoading(false);
      }
    }

    fetchDays();
  }, [fileId, sheetName, status]);

  // Fetch a specific day's exercises
  const fetchDayExercises = useCallback(
    async (dayLabel: string) => {
      if (!fileId || !sheetName) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workout/day?fileId=${encodeURIComponent(fileId)}&sheetName=${encodeURIComponent(sheetName)}&dayLabel=${dayLabel}`
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load exercises");
        }
        const data = await res.json();
        setExercises(data.exercises || []);
        setFeedbackSlots(data.feedbackSlots || {});
        setSelectedDay(dayLabel);
        setStep("checkin");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [fileId, sheetName]
  );

  // Save feedback ratings to sheet
  const saveFeedback = useCallback(async () => {
    if (!fileId || !sheetName) return;

    const updates: { row: number; col: number; value: number }[] = [];
    const feedbackKeys = ["sleep", "stress", "nutrition", "recovery", "strength"] as const;

    for (const key of feedbackKeys) {
      const slot = feedbackSlots[key];
      if (slot && ratings[key] > 0) {
        updates.push({ row: slot.row, col: 13, value: ratings[key] }); // col N = index 13
      }
    }

    if (updates.length === 0) return;

    try {
      await fetch("/api/workout/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, sheetName, updates }),
      });
    } catch (err) {
      console.error("Failed to save feedback:", err);
    }
  }, [fileId, sheetName, feedbackSlots, ratings]);

  // Handle check-in submit
  const handleCheckInSubmit = useCallback(async () => {
    await saveFeedback();
    setCurrentExerciseIdx(0);
    setLoggedExercises([]);
    setStep("exercise");
  }, [saveFeedback]);

  // Handle exercise next
  const handleExerciseNext = useCallback(
    async (data: { rpe: number | null; load: number; loadChanged: boolean }) => {
      if (!fileId || !sheetName) return;
      setSaving(true);

      const exercise = exercises[currentExerciseIdx];
      const updates: { row: number; col: number; value: number | string }[] = [];

      // Write Actual RPE to col K (index 10)
      if (data.rpe !== null) {
        updates.push({ row: exercise.rowIndex, col: 10, value: data.rpe });
      }

      // Write Load to col I (index 8) if changed
      if (data.loadChanged) {
        updates.push({ row: exercise.rowIndex, col: 8, value: data.load });
      }

      if (updates.length > 0) {
        try {
          const res = await fetch("/api/workout/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId, sheetName, updates }),
          });
          if (!res.ok) {
            const errData = await res.json();
            console.error("Save error:", errData.error);
          }
        } catch (err) {
          console.error("Failed to save exercise:", err);
        }
      }

      // Track logged exercise
      setLoggedExercises((prev) => [
        ...prev,
        {
          movement: exercise.movement,
          load: data.load,
          loadUnit: exercise.loadUnit,
          rpe: data.rpe,
          sets: exercise.sets,
          reps: exercise.reps,
        },
      ]);

      setSaving(false);

      // Move to next or finish
      if (currentExerciseIdx < exercises.length - 1) {
        setCurrentExerciseIdx(currentExerciseIdx + 1);
      } else {
        setStep("complete");
      }
    },
    [fileId, sheetName, exercises, currentExerciseIdx]
  );

  // Auth guard
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  if (!fileId || !sheetName) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Missing file or sheet selection.</p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Compute summary stats
  const totalTonnage = loggedExercises.reduce(
    (sum, e) => sum + e.load * e.sets * e.reps,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (step === "exercise" && currentExerciseIdx > 0) {
                  setCurrentExerciseIdx(currentExerciseIdx - 1);
                } else if (step === "exercise") {
                  setStep("checkin");
                } else if (step === "checkin") {
                  setStep("day-select");
                } else if (step === "complete") {
                  // Don't go back from complete
                  router.push("/dashboard");
                } else {
                  router.push("/dashboard");
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Workout</span>
            </div>
            {selectedDay && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm text-muted-foreground">{selectedDay}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-4">
        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 mx-4 mb-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        )}

        {/* Day selector */}
        {!loading && step === "day-select" && (
          <DaySelector
            days={days}
            todayLabel={todayLabel}
            onSelect={fetchDayExercises}
          />
        )}

        {/* Pre-workout check-in */}
        {!loading && step === "checkin" && (
          <CheckInCard
            ratings={ratings}
            onChange={setRatings}
            onSubmit={handleCheckInSubmit}
          />
        )}

        {/* Exercise flow */}
        {!loading && step === "exercise" && exercises[currentExerciseIdx] && (
          <ExerciseCard
            key={exercises[currentExerciseIdx].rowIndex}
            exercise={exercises[currentExerciseIdx]}
            index={currentExerciseIdx}
            total={exercises.length}
            onNext={handleExerciseNext}
            saving={saving}
          />
        )}

        {/* Workout complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/10 mx-auto">
                <Trophy className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Workout Complete!</h2>
                <p className="text-muted-foreground mt-1">{selectedDay}</p>
              </div>

              {/* Pre-workout ratings */}
              <div className="border rounded-lg p-4 text-left space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Pre-Workout Ratings
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {(
                    [
                      ["Sleep", ratings.sleep],
                      ["Stress", ratings.stress],
                      ["Nutrition", ratings.nutrition],
                      ["Recovery", ratings.recovery],
                      ["Strength", ratings.strength],
                    ] as const
                  ).map(([label, val]) => (
                    <div key={label}>
                      <div className="text-lg font-bold">{val}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exercise summary */}
              <div className="border rounded-lg p-4 text-left space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Exercises
                </h3>
                {loggedExercises.map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm font-medium">{ex.movement}</span>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      {ex.load > 0 && `${ex.load}${ex.loadUnit}`}
                      {ex.rpe !== null && ` RPE ${ex.rpe}`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tonnage */}
              {totalTonnage > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="text-3xl font-bold">
                    {totalTonnage.toLocaleString()}
                    <span className="text-sm text-muted-foreground ml-1">
                      {exercises[0]?.loadUnit || "kg"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Total Session Volume
                  </div>
                </div>
              )}

              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
