"use client";

/**
 * SVG barbell plate loading visualization.
 * Plates are KG (IPF competition: 25/20/15/10/5/2.5/1.25).
 * Input weight is in lbs — converted to kg for plate math.
 * Shows mirrored plates on both sides of the bar.
 */

interface BarbellVisualProps {
  weightLbs: number;
}

interface PlateInfo {
  weight: number; // kg
  color: string;
  label: string;
  width: number;
  height: number;
}

const KG_PLATES: PlateInfo[] = [
  { weight: 25,   color: "#DC2626", label: "25",   width: 13, height: 88 },
  { weight: 20,   color: "#2563EB", label: "20",   width: 12, height: 82 },
  { weight: 15,   color: "#EAB308", label: "15",   width: 11, height: 74 },
  { weight: 10,   color: "#16A34A", label: "10",   width: 9,  height: 64 },
  { weight: 5,    color: "#E5E7EB", label: "5",    width: 7,  height: 54 },
  { weight: 2.5,  color: "#1F2937", label: "2.5",  width: 6,  height: 44 },
  { weight: 1.25, color: "#9CA3AF", label: "1.25", width: 5,  height: 36 },
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

  // Round up with 1.25 if closer
  const smallest = KG_PLATES[KG_PLATES.length - 1];
  const withExtraKg = actualKg + smallest.weight * 2;
  const withExtraLbs = withExtraKg * KG_TO_LBS;
  if (Math.abs(withExtraLbs - targetLbs) < Math.abs(actualLbs - targetLbs)) {
    result.push(smallest);
    return { plates: result, actualKg: withExtraKg, actualLbs: withExtraLbs };
  }

  return { plates: result, actualKg, actualLbs };
}

function renderPlateStack(plates: PlateInfo[], startX: number, barY: number, barH: number, reversed: boolean) {
  const GAP = 2;
  const elements: React.JSX.Element[] = [];
  let x = startX;
  const ordered = reversed ? [...plates].reverse() : plates;

  ordered.forEach((plate, idx) => {
    const y = barY - plate.height / 2 + barH / 2;
    const isLight = plate.color === "#E5E7EB" || plate.color === "#9CA3AF";
    elements.push(
      <g key={idx}>
        <rect
          x={reversed ? x - plate.width : x}
          y={y}
          width={plate.width}
          height={plate.height}
          rx={2}
          fill={plate.color}
          stroke={isLight ? "#D1D5DB" : "none"}
          strokeWidth={isLight ? 1 : 0}
        />
        <text
          x={(reversed ? x - plate.width : x) + plate.width / 2}
          y={barY + barH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="6"
          fontWeight="700"
          fill={isLight ? "#374151" : "#FFFFFF"}
        >
          {plate.label}
        </text>
      </g>
    );
    x += reversed ? -(plate.width + GAP) : plate.width + GAP;
  });
  return elements;
}

export default function BarbellVisual({ weightLbs }: BarbellVisualProps) {
  const { plates, actualKg, actualLbs } = calculatePlates(weightLbs);
  const perSideKg = plates.reduce((s, p) => s + p.weight, 0);
  const isExact = Math.abs(actualLbs - weightLbs) < 0.5;

  if (weightLbs <= BAR_KG * KG_TO_LBS) {
    return (
      <div className="text-center py-3">
        <p className="text-sm text-muted-foreground">Empty bar · 20 kg / 44 lbs</p>
      </div>
    );
  }

  // Layout: [left plates reversed] [left collar] [bar sleeve] [right collar] [right plates]
  const barY = 55;
  const barH = 8;
  const SVG_H = 120;
  const sleeveW = 30;    // inner sleeve (where plates go)
  const shaftW = 20;     // outer end of bar
  const collarW = 10;

  // Calculate total plate stack width
  const GAP = 2;
  const stackWidth = plates.reduce((sum, p) => sum + p.width + GAP, 0);

  const leftSleeveX = stackWidth + 4;         // left sleeve starts after left plates
  const centerBarX = leftSleeveX + sleeveW;   // center (collar + shaft between plates)
  const rightSleeveX = centerBarX + collarW + shaftW + collarW;
  const totalWidth = rightSleeveX + stackWidth + 4 + 10;

  const rightPlatesX = rightSleeveX;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${totalWidth} ${SVG_H}`}
        className="w-full mx-auto"
        role="img"
        aria-label={`Barbell: ${actualLbs.toFixed(1)} lbs`}
      >
        {/* Left outer shaft end */}
        <rect x={0} y={barY} width={leftSleeveX} height={barH} rx={2} fill="#9CA3AF" />
        {/* Left collar */}
        <rect x={leftSleeveX} y={barY - 5} width={collarW} height={barH + 10} rx={1} fill="#4B5563" />
        {/* Center shaft */}
        <rect x={leftSleeveX + collarW} y={barY + 1} width={shaftW} height={barH - 2} fill="#D1D5DB" />
        {/* Right collar */}
        <rect x={leftSleeveX + collarW + shaftW} y={barY - 5} width={collarW} height={barH + 10} rx={1} fill="#4B5563" />
        {/* Right outer shaft end */}
        <rect x={rightSleeveX} y={barY} width={totalWidth - rightSleeveX} height={barH} rx={2} fill="#9CA3AF" />

        {/* Left plates — mirrored (largest innermost) */}
        {renderPlateStack(plates, leftSleeveX - 4, barY, barH, true)}
        {/* Right plates — normal order (largest innermost) */}
        {renderPlateStack(plates, rightPlatesX + 4, barY, barH, false)}
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
          {perSideKg} kg per side · {BAR_KG} kg bar
        </p>
      </div>
    </div>
  );
}
