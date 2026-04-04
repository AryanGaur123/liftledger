"use client";

/**
 * SVG barbell plate loading visualization.
 * Plates are KG (IPF competition: 25/20/15/10/5/2.5/1.25).
 * Input weight is in lbs — converted to kg for plate math,
 * then actual loaded weight shown in both kg and lbs.
 */

interface BarbellVisualProps {
  weightLbs: number; // target weight in lbs
}

interface PlateInfo {
  weight: number; // kg
  color: string;
  label: string;
  width: number;
  height: number;
}

const KG_PLATES: PlateInfo[] = [
  { weight: 25,   color: "#DC2626", label: "25",   width: 14, height: 90 },
  { weight: 20,   color: "#2563EB", label: "20",   width: 13, height: 84 },
  { weight: 15,   color: "#EAB308", label: "15",   width: 12, height: 76 },
  { weight: 10,   color: "#16A34A", label: "10",   width: 10, height: 66 },
  { weight: 5,    color: "#F5F5F5", label: "5",    width: 8,  height: 56 },
  { weight: 2.5,  color: "#1F2937", label: "2.5",  width: 7,  height: 46 },
  { weight: 1.25, color: "#9CA3AF", label: "1.25", width: 6,  height: 38 },
];

const BAR_KG = 20;
const LBS_TO_KG = 1 / 2.20462;
const KG_TO_LBS = 2.20462;

function calculatePlates(targetLbs: number): { plates: PlateInfo[]; actualKg: number; actualLbs: number } {
  const targetKg = targetLbs * LBS_TO_KG;
  let perSide = (targetKg - BAR_KG) / 2;

  if (perSide <= 0) return { plates: [], actualKg: BAR_KG, actualLbs: BAR_KG * KG_TO_LBS };

  const result: PlateInfo[] = [];
  for (const plate of KG_PLATES) {
    while (perSide >= plate.weight - 0.001) {
      result.push(plate);
      perSide -= plate.weight;
    }
  }

  const totalPlateKg = result.reduce((sum, p) => sum + p.weight, 0);
  const actualKg = BAR_KG + totalPlateKg * 2;
  const actualLbs = actualKg * KG_TO_LBS;

  return { plates: result, actualKg, actualLbs };
}

export default function BarbellVisual({ weightLbs }: BarbellVisualProps) {
  const { plates, actualKg, actualLbs } = calculatePlates(weightLbs);
  const perSideKg = (actualKg - BAR_KG) / 2;
  const isExact = Math.abs(actualLbs - weightLbs) < 0.5;

  if (weightLbs <= BAR_KG * KG_TO_LBS) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">Empty bar (20 kg / 44 lbs)</p>
      </div>
    );
  }

  const barStartX = 20;
  const barY = 60;
  const barHeight = 8;
  const collarWidth = 12;
  let currentX = barStartX + 60 + collarWidth;
  const plateGap = 2;

  const plateElements: React.JSX.Element[] = [];
  plates.forEach((plate, idx) => {
    const x = currentX;
    const y = barY - plate.height / 2 + barHeight / 2;
    const isLight = plate.color === "#F5F5F5" || plate.color === "#9CA3AF";
    plateElements.push(
      <g key={idx}>
        <rect
          x={x} y={y}
          width={plate.width} height={plate.height}
          rx={2}
          fill={plate.color}
          stroke={plate.color === "#F5F5F5" ? "#D1D5DB" : "none"}
          strokeWidth={plate.color === "#F5F5F5" ? 1 : 0}
        />
        <text
          x={x + plate.width / 2}
          y={barY + barHeight / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7"
          fontWeight="600"
          fill={isLight ? "#374151" : "#FFFFFF"}
        >
          {plate.label}
        </text>
      </g>
    );
    currentX += plate.width + plateGap;
  });

  const totalWidth = Math.max(currentX + 20, 200);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${totalWidth} 120`}
        className="w-full max-w-md mx-auto"
        role="img"
        aria-label={`Barbell loaded with ${actualLbs.toFixed(1)} lbs`}
      >
        <rect x={barStartX} y={barY - 2} width={60} height={barHeight + 4} rx={2} fill="#6B7280" />
        <rect x={barStartX} y={barY} width={totalWidth - barStartX - 10} height={barHeight} fill="#9CA3AF" />
        <rect x={barStartX + 60} y={barY - 6} width={collarWidth} height={barHeight + 12} rx={1} fill="#4B5563" />
        {plateElements}
      </svg>

      {/* Weight readout */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-semibold">
          {actualLbs.toFixed(1)} lbs
          {!isExact && (
            <span className="text-xs text-muted-foreground ml-1.5">
              (closest to {weightLbs} lbs)
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {perSideKg} kg per side &middot; {BAR_KG} kg bar
        </p>
      </div>
    </div>
  );
}
