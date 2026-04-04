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

  // Check-in
  const [ratings, setRatings] = useState<Record<string, number | null>>({
    Sleep: null, Stress: null, Nutrition: null, Recovery: null, Strength: null,
  });

  // Exercise
  const [selectedDay, setSelectedDay] = useState("");
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [feedbackSlots, setFeedbackSlots] = useState<FeedbackSlot[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [loadUnit, setLoadUnit] = useState<"lbs" | "kg">("kg");

  // ── Load block list ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileId) { setError("Missing file info."); return; }
    (async () => {
      try {
        const res = await fetch(`/api/workout/blocks?fileId=${fileId}`);
        if (!res.ok) throw new Error("Failed to load sheets");
        const data = await res.json();
        setBlockSheets(data.blockSheets);
        setStep("pick-block");
      } catch (err: any) { setError(err.message); }
    })();
  }, [fileId]);

  // ── Select block → load structure ───────────────────────────────────────
  async function selectBlock(sheetName: string) {
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

  // ── Select day → load exercises ─────────────────────────────────────────
  async function selectDay(dayLabel: string, weekIndex: number) {
    setSelectedDay(dayLabel);
    try {
      const res = await fetch(
        `/api/workout/day?fileId=${fileId}&sheetName=${encodeURIComponent(selectedSheet)}&dayLabel=${encodeURIComponent(dayLabel)}&weekIndex=${weekIndex}`
      );
      if (!res.ok) throw new Error("Failed to load exercises");
      const data = await res.json();
      setExercises(data.exercises);
      setFeedbackSlots(data.feedbackSlots);
      setLoadUnit(data.loadUnit);

      const existing: Record<string, number | null> = {
        Sleep: null, Stress: null, Nutrition: null, Recovery: null, Strength: null,
      };
      for (const fb of data.feedbackSlots) {
        if (fb.value != null) existing[fb.category] = fb.value;
      }
      setRatings(existing);
      setStep("checkin");
    } catch (err: any) { setError(err.message); }
  }

  // ── Save feedback ───────────────────────────────────────────────────────
  async function saveFeedback() {
    const updates: { row: number; col: number; value: number }[] = [];
    for (const fb of feedbackSlots) {
      const val = ratings[fb.category];
      if (val != null) updates.push({ row: fb.rowIndex, col: 13, value: val });
    }
    if (updates.length > 0) {
      try {
        await fetch("/api/workout/save", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, sheetName: selectedSheet, updates }),
        });
      } catch { /* non-blocking */ }
    }
    setCurrentExIdx(0);
    setResults([]);
    setStep("exercise");
  }

  // ── Save exercise + advance ─────────────────────────────────────────────
  async function handleExerciseNext(data: { rpe: number | null; weight: number; weightChanged: boolean }) {
    const ex = exercises[currentExIdx];
    setSaving(true);

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

    setResults([...results, { exercise: ex, ...data }]);
    setSaving(false);

    if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(currentExIdx + 1);
    } else {
      setStep("complete");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="text-teal-400 underline">Back to Dashboard</button>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // ── Block picker ────────────────────────────────────────────────────────
  if (step === "pick-block") {
    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Log Workout</h1>
            <p className="text-sm text-zinc-400 truncate max-w-[250px]">{fileNameParam}</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-sm text-zinc-400 hover:text-zinc-200">
            &#8592; Back
          </button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Select a training block:</p>
        <div className="space-y-2">
          {blockSheets.map((name) => (
            <button
              key={name}
              onClick={() => selectBlock(name)}
              className="w-full text-left p-4 rounded-xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-teal-500/30 transition-all active:scale-[0.98]"
            >
              <span className="font-medium text-zinc-200">{name}</span>
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
            <h1 className="text-xl font-bold text-zinc-100">{selectedSheet}</h1>
            <p className="text-sm text-zinc-400">Pick a training day</p>
          </div>
          <button onClick={() => setStep("pick-block")} className="text-sm text-zinc-400 hover:text-zinc-200">
            &#8592; Blocks
          </button>
        </div>

        {weeks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
            {weeks.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedWeek(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedWeek === i ? "bg-teal-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
            return (
              <button
                key={day.dayLabel}
                onClick={() => selectDay(day.dayLabel, selectedWeek)}
                className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${
                  isToday
                    ? "bg-teal-600/10 border-teal-500/40 ring-1 ring-teal-500/20"
                    : "bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isToday ? "text-teal-400" : "text-zinc-200"}`}>
                      {day.dayLabel.charAt(0) + day.dayLabel.slice(1).toLowerCase()}
                    </p>
                    <p className="text-sm text-zinc-500">{day.exerciseCount} exercises</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday && <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">Today</span>}
                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
          {currentDays.length === 0 && <p className="text-center text-zinc-500 mt-8">No training days found.</p>}
        </div>
      </div>
    );
  }

  // ── Check-in ────────────────────────────────────────────────────────────
  if (step === "checkin") {
    return (
      <CheckInCard
        ratings={ratings}
        onRate={(cat, val) => setRatings((prev) => ({ ...prev, [cat]: val }))}
        onContinue={saveFeedback}
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
        saving={saving}
      />
    );
  }

  // ── Complete ────────────────────────────────────────────────────────────
  if (step === "complete") {
    const totalTonnage = results.reduce((sum, r) => sum + r.exercise.sets * r.exercise.reps * r.weight, 0);

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">&#127947;&#65039;</div>
          <h1 className="text-2xl font-bold text-zinc-100">Workout Complete</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {results.length} exercises logged &middot; {selectedDay}
          </p>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 border border-zinc-700/50">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Check-In</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {Object.entries(ratings).map(([cat, val]) => (
              <div key={cat}>
                <p className="text-lg font-bold text-zinc-100">{val ?? "–"}</p>
                <p className="text-xs text-zinc-500">{cat}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 border border-zinc-700/50">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Session Volume</p>
          <p className="text-2xl font-bold text-zinc-100">{totalTonnage.toLocaleString()} {loadUnit}</p>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Exercises</p>
          <div className="space-y-2.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300 truncate flex-1 mr-3">{r.exercise.movement}</span>
                <span className="text-zinc-400 tabular-nums text-right whitespace-nowrap">
                  {r.weight}{loadUnit} &middot; RPE {r.rpe ?? "–"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full py-4 rounded-xl text-base font-bold bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.98] transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return null;
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    }>
      <WorkoutContent />
    </Suspense>
  );
}
