/**
 * Lift normalization engine.
 * Maps messy spreadsheet exercise names to canonical lift categories.
 * Supports squat, bench, deadlift variations plus common accessories.
 */

export type LiftCategory =
  | "squat"
  | "bench"
  | "deadlift"
  | "overhead_press"
  | "row"
  | "accessory";

export interface LiftMapping {
  canonical: string;
  category: LiftCategory;
  isCompetition: boolean;
}

const LIFT_PATTERNS: {
  patterns: RegExp[];
  canonical: string;
  category: LiftCategory;
  isCompetition: boolean;
}[] = [
  // SQUAT VARIATIONS
  {
    patterns: [
      /^(back\s*)?squat$/i,
      /^(low|high)\s*bar\s*(back\s*)?squat$/i,
      /^bb\s*squat$/i,
      /^barbell\s*squat$/i,
      /^competition\s*squat$/i,
      /^comp\s*squat$/i,
    ],
    canonical: "Back Squat",
    category: "squat",
    isCompetition: true,
  },
  {
    patterns: [/front\s*squat/i, /^fs$/i],
    canonical: "Front Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/pause\s*squat/i, /paused\s*squat/i],
    canonical: "Pause Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/safety\s*(bar|ssb)\s*squat/i, /^ssb\s*squat$/i, /^ssb$/i],
    canonical: "SSB Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/tempo\s*squat/i],
    canonical: "Tempo Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/pin\s*squat/i, /anderson\s*squat/i],
    canonical: "Pin Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/box\s*squat/i],
    canonical: "Box Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/goblet\s*squat/i],
    canonical: "Goblet Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [
      /bulgarian\s*split\s*squat/i,
      /bss/i,
      /split\s*squat/i,
      /rear\s*foot\s*elevated/i,
    ],
    canonical: "Bulgarian Split Squat",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/leg\s*press/i],
    canonical: "Leg Press",
    category: "squat",
    isCompetition: false,
  },
  {
    patterns: [/hack\s*squat/i],
    canonical: "Hack Squat",
    category: "squat",
    isCompetition: false,
  },

  // BENCH VARIATIONS
  {
    patterns: [
      /^bench\s*(press)?$/i,
      /^flat\s*bench\s*(press)?$/i,
      /^bb\s*bench\s*(press)?$/i,
      /^barbell\s*bench\s*(press)?$/i,
      /^competition\s*bench/i,
      /^comp\s*bench/i,
    ],
    canonical: "Bench Press",
    category: "bench",
    isCompetition: true,
  },
  {
    patterns: [
      /close\s*grip\s*bench/i,
      /cg\s*bench/i,
      /cgbp/i,
      /narrow\s*grip\s*bench/i,
    ],
    canonical: "Close Grip Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [/pause\s*bench/i, /paused\s*bench/i],
    canonical: "Pause Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [/touch\s*and\s*go\s*bench/i, /tng\s*bench/i],
    canonical: "TNG Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [/incline\s*(bench|press|bb|barbell)/i],
    canonical: "Incline Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /decline\s*(bench|press)/i,
    ],
    canonical: "Decline Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /floor\s*press/i,
    ],
    canonical: "Floor Press",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /spoto\s*press/i,
    ],
    canonical: "Spoto Press",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /larsen\s*press/i,
      /legs?\s*up\s*bench/i,
    ],
    canonical: "Larsen Press",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /tempo\s*bench/i,
    ],
    canonical: "Tempo Bench",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [
      /pin\s*bench/i,
      /pin\s*press/i,
      /board\s*press/i,
    ],
    canonical: "Pin/Board Press",
    category: "bench",
    isCompetition: false,
  },
  {
    patterns: [/db\s*bench/i, /dumbbell\s*bench/i, /dumbell\s*bench/i],
    canonical: "DB Bench Press",
    category: "bench",
    isCompetition: false,
  },

  // DEADLIFT VARIATIONS
  {
    patterns: [
      /^deadlift$/i,
      /^(conventional\s*)?deadlift$/i,
      /^conv\s*deadlift$/i,
      /^dl$/i,
      /^competition\s*deadlift/i,
      /^comp\s*deadlift/i,
      /^comp\s*dl/i,
    ],
    canonical: "Deadlift",
    category: "deadlift",
    isCompetition: true,
  },
  {
    patterns: [/sumo\s*(deadlift|dl)/i, /^sumo$/i],
    canonical: "Sumo Deadlift",
    category: "deadlift",
    isCompetition: true,
  },
  {
    patterns: [
      /^(romanian|rdl|rdls)/i,
      /romanian\s*deadlift/i,
    ],
    canonical: "Romanian Deadlift",
    category: "deadlift",
    isCompetition: false,
  },
  {
    patterns: [/deficit\s*(deadlift|dl)/i],
    canonical: "Deficit Deadlift",
    category: "deadlift",
    isCompetition: false,
  },
  {
    patterns: [/pause\s*(deadlift|dl)/i, /paused\s*(deadlift|dl)/i],
    canonical: "Pause Deadlift",
    category: "deadlift",
    isCompetition: false,
  },
  {
    patterns: [/block\s*(pull|deadlift|dl)/i, /rack\s*pull/i],
    canonical: "Block Pull",
    category: "deadlift",
    isCompetition: false,
  },
  {
    patterns: [/stiff\s*leg\s*(deadlift|dl)/i, /sldl/i],
    canonical: "Stiff Leg Deadlift",
    category: "deadlift",
    isCompetition: false,
  },
  {
    patterns: [/trap\s*bar\s*(deadlift|dl)?/i, /hex\s*bar/i],
    canonical: "Trap Bar Deadlift",
    category: "deadlift",
    isCompetition: false,
  },

  // OVERHEAD PRESS
  {
    patterns: [
      /^(overhead|ohp|military)\s*(press)?$/i,
      /^press$/i,
      /^standing\s*press$/i,
      /^strict\s*press$/i,
      /^shoulder\s*press$/i,
      /^bb\s*(shoulder\s*)?press$/i,
    ],
    canonical: "Overhead Press",
    category: "overhead_press",
    isCompetition: false,
  },
  {
    patterns: [/push\s*press/i],
    canonical: "Push Press",
    category: "overhead_press",
    isCompetition: false,
  },
  {
    patterns: [/db\s*(shoulder\s*)?press/i, /dumbbell\s*(shoulder\s*)?press/i],
    canonical: "DB Shoulder Press",
    category: "overhead_press",
    isCompetition: false,
  },

  // ROWS
  {
    patterns: [
      /^(barbell|bb|bent[\s-]?over)\s*row/i,
      /^row$/i,
      /^pendlay\s*row/i,
    ],
    canonical: "Barbell Row",
    category: "row",
    isCompetition: false,
  },
  {
    patterns: [/^(db|dumbbell)\s*row/i],
    canonical: "DB Row",
    category: "row",
    isCompetition: false,
  },
  {
    patterns: [/cable\s*row/i, /seated\s*row/i],
    canonical: "Cable Row",
    category: "row",
    isCompetition: false,
  },
  {
    patterns: [/t[\s-]?bar\s*row/i],
    canonical: "T-Bar Row",
    category: "row",
    isCompetition: false,
  },
];

/**
 * Normalize a raw exercise name to a canonical lift + category.
 * Falls back to "accessory" for unrecognized lifts.
 */
export function normalizeLift(raw: string): LiftMapping {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { canonical: "Unknown", category: "accessory", isCompetition: false };
  }

  for (const entry of LIFT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(trimmed)) {
        return {
          canonical: entry.canonical,
          category: entry.category,
          isCompetition: entry.isCompetition,
        };
      }
    }
  }

  // Fallback: title-case the raw name, categorize as accessory
  const canonical = trimmed
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { canonical, category: "accessory", isCompetition: false };
}

/**
 * Get a color for each lift category for chart rendering.
 */
export function getCategoryColor(category: LiftCategory): string {
  const colors: Record<LiftCategory, string> = {
    squat: "hsl(221, 83%, 53%)",      // blue
    bench: "hsl(27, 87%, 55%)",       // orange
    deadlift: "hsl(262, 83%, 48%)",   // purple
    overhead_press: "hsl(173, 58%, 39%)", // teal
    row: "hsl(43, 74%, 49%)",         // gold
    accessory: "hsl(0, 0%, 50%)",     // gray
  };
  return colors[category];
}

export function getCategoryChartColor(category: LiftCategory): string {
  const colors: Record<LiftCategory, string> = {
    squat: "var(--chart-1)",
    bench: "var(--chart-5)",
    deadlift: "var(--chart-2)",
    overhead_press: "var(--chart-3)",
    row: "var(--chart-4)",
    accessory: "hsl(var(--muted-foreground))",
  };
  return colors[category];
}

/** Ordered list of main lift categories for display */
export const MAIN_CATEGORIES: LiftCategory[] = [
  "squat",
  "bench",
  "deadlift",
  "overhead_press",
  "row",
];

export const CATEGORY_LABELS: Record<LiftCategory, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  overhead_press: "OHP",
  row: "Row",
  accessory: "Accessory",
};
