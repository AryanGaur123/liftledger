"use client";

/**
 * SVG barbell plate loading visualization.
 * Works in lbs natively — 45lb bar, standard lbs plates.
 * Plate colors follow IPF competition convention mapped to lbs equivalents.
 */

interface BarbellVisualProps {
  weightLbs: number; // total weight in lbs
}

interface PlateInfo {
  weight: number; // lbs
  color: string;
  label: string;
  width: number;
  height: number;
}

const PLATES: PlateInfo[] = [
  { weight: 45,  color: "#DC2626", label: "45",   width: 14, height: 90 },
  { weight: 35,  color: "#2563EB", label: "35",   width: 13, height: 84 },
  { weight: 25,  color: "#EAB308", label: "25",   width: 12, height: 76 },
  { weight: 10,  color: "#16A34A", label: "10",   width: 10, height: 66 },
  { weight: 5,   color: "#F5F5F5", label: "5",    width: 8,  height: 56 },
  { weight: 2.5, color: "#9CA3AF", label: "2.5",  width: 7,  height: 46 },
];

const BAR_WEIGHT_LBS = 45;

function calculatePlates(totalLbs: number): PlateInfo[] {
  let perSide = (totalLbs - BAR_WEIGHT_LBS) / 2;
  if (perSide <= 0) return [];

  const result: PlateInfo[] = [];
  for (const plate of PLATES) {
    while (perSide >= plate.weight - 0.001) {
      result.push(plate);
      perSide -= plate.weight;
    }
  }
  return result;
}

export default function BarbellVisual({ weightLbs }: BarbellVisualProps) {
  const plates = calculatePlates(weightLbs);
  const perSide = (weightLbs - BAR_WEIGHT_LBS) / 2;

  if (weightLbs <= BAR_WEIGHT_LBS) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">Empty bar ({BAR_WEIGHT_LBS} lbs)</p>
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
    plateElements.push(
      <g key={idx}>
        <rect
          x={x}
          y={y}
          width={plate.width}
          height={plate.height}
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
          fill={plate.color === "#F5F5F5" || plate.color === "#9CA3AF" ? "#374151" : "#FFFFFF"}
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
        aria-label={`Barbell loaded with ${weightLbs} lbs`}
      >
        {/* Bar sleeve */}
        <rect x={barStartX} y={barY - 2} width={60} height={barHeight + 4} rx={2} fill="#6B7280" />
        {/* Bar shaft */}
        <rect x={barStartX} y={barY} width={totalWidth - barStartX - 10} height={barHeight} fill="#9CA3AF" />
        {/* Collar */}
        <rect x={barStartX + 60} y={barY - 6} width={collarWidth} height={barHeight + 12} rx={1} fill="#4B5563" />
        {plateElements}
      </svg>
      <div className="text-center">
        <span className="text-xs text-muted-foreground">
          {perSide} lbs per side &middot; {BAR_WEIGHT_LBS} lb bar
        </span>
      </div>
    </div>
  );
}
