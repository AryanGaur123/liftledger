"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Dumbbell,
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-semibold">LiftLedger</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-semibold">LiftLedger</span>
          </div>
          <Button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            size="sm"
            data-testid="button-signin-nav"
          >
            Sign in
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground mb-6">
          <Dumbbell className="h-3 w-3" />
          Powerlifting analytics, automated
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-tight">
          Turn your training spreadsheet into
          <span className="text-primary"> actionable analytics</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
          Connect your Google Drive, select your training log, and get instant
          volume tracking — sets, reps, and tonnage — broken down by lift and
          week.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="gap-2"
            data-testid="button-signin-hero"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Drive
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: FileSpreadsheet,
              title: "Smart Parsing",
              desc: "Automatically detects dates, exercises, sets, reps, and weight columns — even from messy spreadsheets.",
            },
            {
              icon: Dumbbell,
              title: "Lift Recognition",
              desc: 'Normalizes 50+ exercise variations. "CGBP", "close grip bench", and "CG Bench" all map correctly.',
            },
            {
              icon: TrendingUp,
              title: "Block Analytics",
              desc: "Detects your latest training block and calculates weekly volume, tonnage trends, and top weights.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-lg border p-5 bg-card"
              data-testid={`card-feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="rounded-md bg-primary/10 w-9 h-9 flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-bold text-center mb-8">How it works</h2>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-4 md:gap-8">
          {[
            { step: "1", label: "Connect Google Drive" },
            { step: "2", label: "Pick your spreadsheet" },
            { step: "3", label: "Get instant analytics" },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {s.step}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < 2 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </section>


    </div>
  );
}
