"use client";

/**
 * SVG barbell plate loading visualization.
 * Shows competition KG plates loaded on one side of a 20kg barbell.
 */

interface BarbellVisualProps {
  totalWeight: number; // total weight in kg
}

interface PlateInfo {
  weight: number;
  color: string;
  label: string;
  width: number; // SVG width of the plate
  height: number; // SVG height of the plate
}

const PLATES: PlateInfo[] = [
  { weight: 25, color: "#DC2626", label: "25", width: 14, height: 90 },
  { weight: 20, color: "#2563EB", label: "20", width: 14, height: 86 },
  { weight: 15, color: "#EAB308", label: "15", width: 12, height: 78 },
  { weight: 10, color: "#16A34A", label: "10", width: 10, height: 70 },
  { weight: 5, color: "#F5F5F5", label: "5", width: 8, height: 58 },
  { weight: 2.5, color: "#1F2937", label: "2.5", width: 7, height: 48 },
  { weight: 1.25, color: "#9CA3AF", label: "1.25", width: 6, height: 40 },
];

const BAR_WEIGHT = 20;

function calculatePlates(totalKg: number): PlateInfo[] {
  let perSide = (totalKg - BAR_WEIGHT) / 2;
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

export default function BarbellVisual({ totalWeight }: BarbellVisualProps) {
  const plates = calculatePlates(totalWeight);
  const perSide = (totalWeight - BAR_WEIGHT) / 2;

  if (totalWeight <= BAR_WEIGHT) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">Empty bar ({BAR_WEIGHT}kg)</p>
      </div>
    );
  }

  // Calculate SVG dimensions
  const barStartX = 20;
  const barY = 60;
  const barHeight = 8;
  const collarWidth = 12;
  let currentX = barStartX + 60 + collarWidth; // bar end + collar
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
        aria-label={`Barbell loaded with ${totalWeight}kg`}
      >
        {/* Bar sleeve */}
        <rect
          x={barStartX}
          y={barY - 2}
          width={60}
          height={barHeight + 4}
          rx={2}
          fill="#6B7280"
        />
        {/* Bar shaft extending right */}
        <rect
          x={barStartX}
          y={barY}
          width={totalWidth - barStartX - 10}
          height={barHeight}
          fill="#9CA3AF"
        />
        {/* Collar */}
        <rect
          x={barStartX + 60}
          y={barY - 6}
          width={collarWidth}
          height={barHeight + 12}
          rx={1}
          fill="#4B5563"
        />
        {/* Plates */}
        {plateElements}
      </svg>
      <div className="text-center">
        <span className="text-xs text-muted-foreground">
          {perSide}kg per side &middot; {BAR_WEIGHT}kg bar
        </span>
      </div>
    </div>
  );
}
