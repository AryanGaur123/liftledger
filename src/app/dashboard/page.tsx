"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FilePicker from "@/components/dashboard/file-picker";
import KPICards from "@/components/dashboard/kpi-cards";
import VolumeChart from "@/components/dashboard/volume-chart";
import TonnageTrend from "@/components/dashboard/tonnage-trend";
import LiftTable from "@/components/dashboard/lift-table";
import WeeklySummary from "@/components/dashboard/weekly-summary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LogOut,
  ArrowLeft,
  Loader2,
  BarChart3,
} from "lucide-react";

interface AnalysisData {
  parsedSets: any[];
  blocks: any[];
  latestBlock: {
    name: string;
    startDate: string;
    endDate: string;
    weekCount: number;
    weeks: string[];
  };
  weeklyMetrics: any[];
  liftSummary: Record<
    string,
    {
      canonical: string;
      category: string;
      totalSets: number;
      totalReps: number;
      totalTonnage: number;
      topWeight: number;
    }
  >;
  allLifts: string[];
  allWeeks: string[];
  sheetName: string;
  rowCount: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

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

  const handleFileSelect = async (file: {
    id: string;
    name: string;
    mimeType: string;
  }) => {
    setAnalyzing(true);
    setError(null);
    setFileName(file.name);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, mimeType: file.mimeType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBack = () => {
    setAnalysis(null);
    setError(null);
    setFileName("");
  };

  // Calculate block-level KPIs
  const kpiData = analysis
    ? {
        totalSets: Object.values(analysis.liftSummary).reduce(
          (sum, l) => sum + l.totalSets,
          0
        ),
        totalReps: Object.values(analysis.liftSummary).reduce(
          (sum, l) => sum + l.totalReps,
          0
        ),
        totalTonnage: Object.values(analysis.liftSummary).reduce(
          (sum, l) => sum + l.totalTonnage,
          0
        ),
        weekCount: analysis.latestBlock.weekCount,
        liftCount: analysis.allLifts.length,
        topWeight: Math.max(
          ...Object.values(analysis.liftSummary).map((l) => l.topWeight)
        ),
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            {analysis && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">LiftLedger</span>
            </div>
            {analysis && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm text-muted-foreground truncate max-w-48">
                  {fileName}
                </span>
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {analysis.latestBlock.name}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session.user?.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Error state */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 mb-6">
            <p className="text-sm text-destructive font-medium">
              Analysis Error
            </p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="mt-3"
              data-testid="button-try-again"
            >
              Try another file
            </Button>
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analyzing {fileName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Parsing exercises, detecting blocks, calculating volume...
              </p>
            </div>
          </div>
        )}

        {/* File picker state */}
        {!analysis && !analyzing && !error && (
          <div className="py-10">
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold">Powerlifting Analytics</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Select a training spreadsheet to analyze your latest block
              </p>
            </div>
            <FilePicker onSelect={handleFileSelect} isAnalyzing={analyzing} />
          </div>
        )}

        {/* Dashboard state */}
        {analysis && kpiData && (
          <div className="space-y-4">
            {/* Block info header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-xl font-bold">
                  {analysis.latestBlock.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {new Date(
                    analysis.latestBlock.startDate
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  —{" "}
                  {new Date(analysis.latestBlock.endDate).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}{" "}
                  · {analysis.latestBlock.weekCount} weeks ·{" "}
                  {analysis.rowCount} rows parsed
                </p>
              </div>
            </div>

            {/* KPI Cards */}
            <KPICards data={kpiData} />

            {/* Latest week summary */}
            <WeeklySummary
              weeklyMetrics={analysis.weeklyMetrics}
              allWeeks={analysis.allWeeks}
            />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VolumeChart
                weeklyMetrics={analysis.weeklyMetrics}
                allWeeks={analysis.allWeeks}
              />
              <TonnageTrend
                weeklyMetrics={analysis.weeklyMetrics}
                allWeeks={analysis.allWeeks}
              />
            </div>

            {/* Lift breakdown table */}
            <LiftTable
              weeklyMetrics={analysis.weeklyMetrics}
              allWeeks={analysis.allWeeks}
            />

            {/* Footer */}
            <footer className="pt-6 pb-10 text-center">
              <a
                href="https://www.perplexity.ai/computer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Created with Perplexity Computer
              </a>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
