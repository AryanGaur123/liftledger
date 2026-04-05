"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import CheckInCard from "@/components/workout/checkin-card";
import ExerciseCard, { type ExerciseData } from "@/components/workout/exercise-card";

type Step = "loading" | "pick-block" | "day-select" | "checkin" | "exercise" | "complete";

interface WeekDay { dayLabel: string; exerciseCount: number; weekIndex: number; }
interface WeekInfo { weekIndex: number; days: WeekDay[]; }
interface FeedbackSlot { rowIndex: number; category: string; value: number | null; }
interface ExerciseResult { exercise: ExerciseData; rpe: number | null; weight: number; weightChanged: boolean; }

function WorkoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const fileNameParam = searchParams.get("fileName") || "Training Sheet";

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);

  // Block picker
  const [blockSheets, setBlockSheets] = useState<string[]>([]);

  // Day select
  const [selectedSheet, setSelectedSheet] = useState("");
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [loadingDay, setLoadingDay] = useState<string | null>(null); // day label being loaded

  // Check-in
  const [ratings, setRatings] = useState<Record<string, number | null>>({
    Sleep: null, Stress: null, Nutrition: null, Recovery: null, Strength: null,
  });
  const [priorRatings, setPriorRatings] = useState<Record<string, number | null>>({});

  // Exercise
  const [selectedDay, setSelectedDay] = useState("");
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [feedbackSlots, setFeedbackSlots] = useState<FeedbackSlot[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSavedRpe, setLastSavedRpe] = useState<number | null | undefined>(undefined);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [displayUnit, setDisplayUnit] = useState<"lbs" | "kg">("lbs");

  // ── Load block list — auto-select most recent (last) block ───────────────
  useEffect(() => {
    if (!fileId) { setError("Missing file info."); return; }
    (async () => {
      try {
        const res = await fetch(`/api/workout/blocks?fileId=${fileId}`);
        if (!res.ok) throw new Error("Failed to load sheets");
        const data = await res.json();
        setBlockSheets(data.blockSheets);
        // Auto-select the last (most recent) block
        if (data.blockSheets.length === 1) {
          await loadStructure(data.blockSheets[data.blockSheets.length - 1]);
        } else {
          setStep("pick-block");
        }
      } catch (err: any) { setError(err.message); }
    })();
  }, [fileId]);

  async function loadStructure(sheetName: string) {
    setSelectedSheet(sheetName);
    try {
      const res = await fetch(`/api/workout/structure?fileId=${fileId}&sheetName=${encodeURIComponent(sheetName)}`);
      if (!res.ok) throw new Error("Failed to load sheet structure");
      const data = await res.json();
      setWeeks(data.weeks);
      setSelectedWeek(0);
      setStep("day-select");
    } catch (err: any) { setError(err.message); }
  }

  async function selectBlock(sheetName: string) {
    await loadStructure(sheetName);
  }

  // ── Select day → load exercises ─────────────────────────────────────────
  async function selectDay(dayLabel: string, weekIndex: number) {
    setLoadingDay(dayLabel);
    setSelectedDay(dayLabel);
    try {
      const res = await fetch(
        `/api/workout/day?fileId=${fileId}&sheetName=${encodeURIComponent(selectedSheet)}&dayLabel=${encodeURIComponent(dayLabel)}&weekIndex=${weekIndex}`
      );
      if (!res.ok) throw new Error("Failed to load exercises");
      const data = await res.json();
      setExercises(data.exercises);
      setFeedbackSlots(data.feedbackSlots);

      // Pre-fill ratings from sheet, but always show check-in so athlete can re-rate
      const prior: Record<string, number | null> = {};
      const fresh: Record<string, number | null> = {
        Sleep: null, Stress: null, Nutrition: null, Recovery: null, Strength: null,
      };
      for (const fb of data.feedbackSlots) {
        if (fb.value != null) {
          prior[fb.category] = fb.value;
          fresh[fb.category] = fb.value; // pre-fill so they just confirm or change
        }
      }
      setPriorRatings(prior);
      setRatings(fresh);
      setCurrentExIdx(0);
      setResults([]);
      setStep("checkin"); // ALWAYS show check-in
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDay(null);
    }
  }

  // ── Save feedback ───────────────────────────────────────────────────────
  async function saveFeedback() {
    const updates: { row: number; col: number; value: number }[] = [];
    for (const fb of feedbackSlots) {
      const val = ratings[fb.category];
      if (val != null) updates.push({ row: fb.rowIndex, col: 13, value: val });
    }
    if (updates.length > 0) {
      fetch("/api/workout/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, sheetName: selectedSheet, updates }),
      }).catch(() => {});
    }
    setStep("exercise");
  }

  // ── Save exercise + advance ─────────────────────────────────────────────
  async function handleExerciseNext(data: { rpe: number | null; weight: number; weightChanged: boolean }) {
    const ex = exercises[currentExIdx];
    setSaving(true);
    setLastSavedRpe(undefined);

    const updates: { row: number; col: number; value: number }[] = [];
    if (data.rpe != null) updates.push({ row: ex.rowIndex, col: 10, value: data.rpe });
    if (data.weightChanged) updates.push({ row: ex.rowIndex, col: 8, value: data.weight });

    if (updates.length > 0) {
      try {
        await fetch("/api/workout/save", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, sheetName: selectedSheet, updates }),
        });
      } catch { /* non-blocking */ }
    }

    setResults((prev) => {
      const next = [...prev];
      next[currentExIdx] = { exercise: ex, ...data };
      return next;
    });
    setLastSavedRpe(data.rpe);
    setSaving(false);

    if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(currentExIdx + 1);
    } else {
      setStep("complete");
    }
  }

  function handleExerciseBack() {
    if (currentExIdx > 0) setCurrentExIdx(currentExIdx - 1);
    else setStep("checkin");
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="text-teal-400 underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Block picker ────────────────────────────────────────────────────────
  if (step === "pick-block") {
    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Log Workout</h1>
            <p className="text-sm text-muted-foreground truncate max-w-[250px]">{fileNameParam}</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Select a training block:</p>
        <div className="space-y-2">
          {blockSheets.map((name, i) => (
            <button
              key={name}
              onClick={() => selectBlock(name)}
              className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{name}</span>
                {i === blockSheets.length - 1 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Most recent</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Day selector ────────────────────────────────────────────────────────
  if (step === "day-select") {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const currentDays = weeks[selectedWeek]?.days ?? [];

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{selectedSheet}</h1>
            <p className="text-sm text-muted-foreground">Pick a training day</p>
          </div>
          <button
            onClick={() => blockSheets.length > 1 ? setStep("pick-block") : router.push("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {blockSheets.length > 1 ? "Blocks" : "Back"}
          </button>
        </div>

        {weeks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
            {weeks.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedWeek(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedWeek === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                }`}
              >
                Week {i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {currentDays.map((day) => {
            const isToday = today.startsWith(day.dayLabel.trim().slice(0, 3));
            const isLoading = loadingDay === day.dayLabel;
            return (
              <button
                key={day.dayLabel}
                onClick={() => !loadingDay && selectDay(day.dayLabel, selectedWeek)}
                disabled={!!loadingDay}
                className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${
                  isToday
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                    : "bg-card border-border hover:bg-accent"
                } ${loadingDay && !isLoading ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isToday ? "text-primary" : ""}`}>
                      {day.dayLabel.charAt(0) + day.dayLabel.slice(1).toLowerCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">{day.exerciseCount} exercises</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday && !isLoading && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                    {isLoading
                      ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      : <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    }
                  </div>
                </div>
              </button>
            );
          })}
          {currentDays.length === 0 && (
            <p className="text-center text-muted-foreground mt-8">No training days found.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Check-in ────────────────────────────────────────────────────────────
  if (step === "checkin") {
    return (
      <CheckInCard
        ratings={ratings}
        priorRatings={priorRatings}
        onRate={(cat, val) => setRatings((prev) => ({ ...prev, [cat]: val }))}
        onContinue={saveFeedback}
        onBack={() => setStep("day-select")}
      />
    );
  }

  // ── Exercise flow ───────────────────────────────────────────────────────
  if (step === "exercise" && exercises[currentExIdx]) {
    return (
      <ExerciseCard
        exercise={exercises[currentExIdx]}
        index={currentExIdx}
        total={exercises.length}
        onNext={handleExerciseNext}
        onBack={handleExerciseBack}
        saving={saving}
        savedRpe={lastSavedRpe}
        displayUnit={displayUnit}
        onUnitChange={setDisplayUnit}
        priorResult={results[currentExIdx] ?? null}
      />
    );
  }

  // ── Complete ────────────────────────────────────────────────────────────
  if (step === "complete") {
    const totalTonnage = results.reduce((sum, r) => sum + r.exercise.sets * r.exercise.reps * r.weight, 0);
    const totalReps = results.reduce((sum, r) => sum + r.exercise.sets * r.exercise.reps, 0);
    const rpeValues = results.map((r) => r.rpe).filter((v): v is number => v != null);
    const avgRpe = rpeValues.length > 0
      ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1)
      : null;

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏋️</div>
          <h1 className="text-2xl font-bold">Workout Complete</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()} · {results.length} exercises
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Tonnage", value: totalTonnage.toLocaleString(), sub: displayUnit },
            { label: "Total Reps", value: totalReps.toLocaleString(), sub: "reps" },
            { label: "Avg RPE", value: avgRpe ?? "–", sub: rpeValues.length > 0 ? `over ${rpeValues.length} lifts` : "none logged" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-card rounded-xl p-3 border text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-0.5">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        {/* Check-in summary */}
        <div className="bg-card rounded-xl p-4 mb-4 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Check-In</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {Object.entries(ratings).map(([cat, val]) => (
              <div key={cat}>
                <p className="text-lg font-bold">{val ?? "–"}</p>
                <p className="text-xs text-muted-foreground">{cat}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="bg-card rounded-xl p-4 mb-5 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Exercises</p>
          <div className="space-y-2.5">
            {results.map((r, i) => {
              const displayName = r.exercise.movement.replace(/\s*\((Primary|Secondary|Tertiary)\)\s*/i, "").trim();
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate flex-1 mr-3">{displayName}</span>
                  <span className="text-muted-foreground tabular-nums text-right whitespace-nowrap">
                    {r.weight > 0 ? `${r.weight} ${displayUnit}` : "BW"}
                    {r.rpe != null && ` · RPE ${r.rpe}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              // Reset exercise state and go back to day selector
              setCurrentExIdx(0);
              setResults([]);
              setRatings({ Sleep: null, Stress: null, Nutrition: null, Recovery: null, Strength: null });
              setStep("day-select");
            }}
            className="w-full py-3.5 rounded-xl text-base font-semibold border border-border bg-secondary hover:bg-accent active:scale-[0.98] transition-all"
          >
            Log Another Day
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3.5 rounded-xl text-base font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <WorkoutContent />
    </Suspense>
  );
}
