import { useState, useRef, useCallback } from "react";

export interface RioCelesteLotData {
  id: number;
  size: number;
  pricePerM2: number;
  total: number;
  available: boolean;
  planoVisado?: string;
}

interface Props {
  lots: RioCelesteLotData[];
  selectedLot: RioCelesteLotData | null;
  onLotSelect: (lot: RioCelesteLotData | null) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  lot: RioCelesteLotData | null;
}

// Exact polygon coordinates from asset1_dark.html — viewBox "0 0 1175.32 540.26"
const LOT_POLYGONS: Record<number, string> = {
  1:  "69.4,127.89 114.76,135.45 151.29,146.62 168.4,49.05 58.24,29.79 44.16,122.39",
  2:  "112.42,145.53 67.42,138.15 47.26,133.83 45.64,134.37 44.56,141.03 43.84,141.03 41.32,142.83 41.15,142.83 37.72,166.95 141.94,189.99 143.35,183.68 149.26,156.85",
  3:  "33.04,200.97 134.56,223.47 141.94,189.99 37.72,166.95",
  4:  "33.04,200.97 26.74,245.25 126.1,261.99 134.56,223.47",
  5:  "151.3,146.63 151.84,146.79 227.08,169.65 250.13,169.81 267.94,66.15 184.42,51.75 168.4,49.05 151.3,146.61",
  6:  "254.44,169.83 347.44,188.33 368.38,83.61 267.94,66.15 250.13,169.81",
  7:  "353.98,189.63 444.4,207.61 464.14,99.45 368.38,83.61 347.44,188.33",
  8:  "444.52,207.63 536.32,225.99 536.35,226 559.72,115.29 496.72,104.85 464.14,99.45 444.4,207.61",
  9:  "552.52,228.33 638.36,234.27 638.45,234.27 650.44,130.41 559.72,115.29 536.35,226",
  10: "639.7,234.27 755.23,233.64 755.56,148.95 668.62,133.47 650.44,130.41 638.45,234.27",
  11: "770.68,233.55 876.7,234.63 905.02,229.05 894.34,174.33 770.68,151.83 755.56,148.95 755.23,233.64",
  12: "1001.44,193.77 894.34,174.33 905.02,229.05 972.46,215.73 994.78,218.97 1022.5,230.31 1055.8,256.41 1079.56,280.89 1075.78,284.49 1171.82,252.12 1173.16,243.45 1174.78,222.57",
  13: "770.68,243.99 770.24,244 759.88,365.13 839.45,377.89 856.94,244.89",
  14: "755.2,244.17 680.32,244.53 679.56,244.54 664.12,349.65 670.42,350.73 759.88,365.13 770.24,244",
  15: "679.56,244.54 637.66,244.71 572.27,240.22 558.64,332.55 664.12,349.65",
  16: "551.26,238.77 534.34,236.25 460.44,221.5 445.24,314.01 558.64,332.55 572.27,240.22",
  17: "442.36,217.89 352.26,199.94 336.52,296.55 382.6,303.93 445.24,314.01 460.44,221.5",
  18: "352,199.89 253.36,180.27 248.34,180.24 231.4,279.45 258.22,283.95 336.52,296.55 352.26,199.94",
  19: "248.34,180.24 225.46,180.09 149.32,156.87 143.35,183.68 126.1,261.99 150.76,265.95 231.4,279.45",
  20: "1072,288.09 1048.78,264.15 1017.28,239.49 991.9,229.23 972.82,226.35 907.12,239.31 877.6,245.07 857.44,244.89 856.94,244.89 839.45,377.89 839.62,377.91 877.06,384.03 874.9,326.97 886.24,289.35 902.62,269.91 928.36,248.49 959.68,236.61 998.2,237.15 1011.88,242.91 1032.04,262.35 1051.48,288.09 1061.74,327.87 1072.9,405.27 1078.66,448.29 1086.4,501.03 1088.74,522.45 1094.5,535.95 1127.98,539.73 1143.28,519.93 1155.88,402.39 1164.52,306.09 1168.66,272.43 1171.82,252.12 1075.78,284.49",
};

// Fixed lot-number label positions from asset1_dark.html text transforms
const LOT_LABELS: Record<number, [number, number]> = {
  1:  [102.52, 78.58],
  2:  [53.02,  156.34],
  3:  [46.18,  190.53],
  4:  [41.86,  231.58],
  5:  [208.9,  96.76],
  6:  [307.18, 114.76],
  7:  [405.46, 132.39],
  8:  [501.04, 146.62],
  9:  [595,    164.8],
  10: [690.76, 179.74],
  11: [817.48, 191.08],
  12: [1082.44,226.18],
  13: [796.42, 334.89],
  14: [707.68, 324.81],
  15: [607.42, 310.23],
  16: [497.62, 294.04],
  17: [389.44, 279.1],
  18: [284.68, 260.38],
  19: [173.26, 241.3],
  20: [1085.5, 369.64],
};

// Fixed size-label positions from asset1_dark.html (cls-3 / cls-2 text elements)
const LOT_SIZE_POSITIONS: Record<number, { x: number; y: number; rotate?: number }> = {
  1:  { x: 89.56,  y: 95.14 },
  2:  { x: 70.48,  y: 153.82, rotate: 8.2 },
  3:  { x: 89.02,  y: 201.51, rotate: 8.2 },
  4:  { x: 77.32,  y: 236.43, rotate: 8.2 },
  5:  { x: 192.88, y: 116.2 },
  6:  { x: 290.98, y: 132.03 },
  7:  { x: 389.8,  y: 148.6 },
  8:  { x: 484.84, y: 164.43 },
  9:  { x: 581.32, y: 181.72 },
  10: { x: 679.24, y: 193.24 },
  11: { x: 805.78, y: 202.6 },
  12: { x: 1074.7, y: 236.8 },
  13: { x: 790.66, y: 312.93 },
  14: { x: 700.66, y: 304.84 },
  15: { x: 595.54, y: 292.96 },
  16: { x: 486.28, y: 276.04 },
  17: { x: 379,    y: 259.84 },
  18: { x: 275.32, y: 238.95 },
  19: { x: 170.74, y: 219.16 },
};

// Asphalt road polygon from asset1_dark.html (.calle-asfalto) — rendered BEFORE lots
const ROAD_POLYGON =
  "1055.8,256.41 1022.5,230.31 994.78,218.97 972.46,215.73 905.02,229.05 876.7,234.63 770.68,233.55 " +
  "755.23,233.64 639.7,234.27 638.45,234.27 638.38,234.27 638.36,234.27 552.52,228.33 536.35,226 " +
  "536.32,225.99 444.52,207.63 444.4,207.61 353.98,189.63 347.44,188.33 254.44,169.83 250.13,169.81 " +
  "227.08,169.65 151.84,146.79 151.3,146.63 151.29,146.62 114.76,135.45 69.4,127.89 44.16,122.39 " +
  "44.1,122.37 45.64,111.69 58.24,29.79 62.39,3.45 37.72,0 34.12,24.03 31.06,43.29 10.9,195.39 " +
  "5.14,235.35 0,261.99 23.58,263.67 26.74,245.25 33.04,200.97 37.72,166.95 41.14,142.83 41.6,139.68 " +
  "42.57,132.83 42.59,132.83 67.42,138.15 112.42,145.53 148.96,156.69 149.27,156.79 149.34,156.81 " +
  "225.46,180.09 248.34,180.24 253.36,180.27 352,199.89 352.26,199.94 442.36,217.89 460.44,221.5 " +
  "534.34,236.25 551.26,238.77 572.27,240.22 637.66,244.71 679.56,244.54 680.32,244.53 755.2,244.17 " +
  "770.24,244 770.68,243.99 856.94,244.89 857.44,244.89 877.6,245.07 907.12,239.31 972.82,226.35 " +
  "991.9,229.23 1017.28,239.49 1048.78,264.15 1072,288.09 1075.78,284.49 1079.56,280.89 1055.8,256.41";

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const formatSize = (size: number) =>
  size % 1 === 0 ? `${size}m²` : `${size.toFixed(2)}m²`;

function getStatusFill(available: boolean, isSelected: boolean, isHovered: boolean) {
  if (!available) return "rgba(50,60,55,0.55)";
  if (isSelected) return "rgba(116,206,82,0.8)";
  return isHovered ? "rgba(116,206,82,0.5)" : "#2d4a2b";
}

function getStatusStroke(available: boolean, isSelected: boolean) {
  if (!available) return "rgba(100,116,139,0.35)";
  if (isSelected) return "#74CE52";
  return "#5fa861";
}

export default function RioCelesteMapInteractive({ lots, selectedLot, onLotSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, lot: null });
  const containerRef = useRef<HTMLDivElement>(null);

  const lotsById = Object.fromEntries(lots.map(l => [l.id, l]));

  const handleMouseMove = useCallback((e: React.MouseEvent, lot: RioCelesteLotData) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top, lot });
  }, []);

  const handleMouseEnter = useCallback((id: number) => setHoveredId(id), []);
  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  const handleClick = useCallback((lot: RioCelesteLotData) => {
    if (!lot.available) return;
    onLotSelect(selectedLot?.id === lot.id ? null : lot);
  }, [selectedLot, onLotSelect]);

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        viewBox="0 -81 1175.32 702"
        className="w-full h-auto block rounded-xl"
        style={{ backgroundColor: "#0a0f0b" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="rc-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(116,206,82,0.04)" strokeWidth="0.5"/>
          </pattern>
          <path id="path-carretera-rc" d="M 150 195 L 1050 235"/>
        </defs>
        <rect x="0" y="0" width="1175.32" height="540.26" fill="url(#rc-grid)" />

        {/* Asfalto — rendered BEFORE lots so streets appear underneath */}
        <polygon
          points={ROAD_POLYGON}
          fill="#2a2a2a"
          stroke="#4a4a4a"
          strokeWidth="1"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />

        {/* Lot polygons */}
        {Object.entries(LOT_POLYGONS).map(([idStr, points]) => {
          const id = Number(idStr);
          const lot = lotsById[id];
          if (!lot) return null;
          const isSelected = selectedLot?.id === id;
          const isHovered = hoveredId === id;
          return (
            <polygon
              key={id}
              points={points}
              fill={getStatusFill(lot.available, isSelected, isHovered)}
              stroke={getStatusStroke(lot.available, isSelected)}
              strokeWidth={isSelected ? 1.5 : 0.8}
              strokeLinejoin="round"
              style={{ cursor: lot.available ? "pointer" : "default", transition: "fill 0.15s" }}
              onMouseEnter={() => handleMouseEnter(id)}
              onMouseLeave={handleMouseLeave}
              onMouseMove={e => handleMouseMove(e, lot)}
              onClick={() => handleClick(lot)}
            />
          );
        })}

        {/* Lot number labels */}
        {Object.entries(LOT_LABELS).map(([idStr, [lx, ly]]) => {
          const id = Number(idStr);
          const lot = lotsById[id];
          if (!lot) return null;
          const isSelected = selectedLot?.id === id;
          return (
            <text
              key={`lbl-${id}`}
              x={lx}
              y={ly}
              textAnchor="start"
              fontSize="14"
              fontWeight="700"
              fontFamily="'Inter', system-ui, sans-serif"
              fill={isSelected ? "#74CE52" : "rgba(255,255,255,0.95)"}
              pointerEvents="none"
              style={{ userSelect: "none" }}
            >
              {id}
            </text>
          );
        })}

        {/* Lot size labels */}
        {Object.entries(LOT_SIZE_POSITIONS).map(([idStr, pos]) => {
          const id = Number(idStr);
          const lot = lotsById[id];
          if (!lot) return null;
          return (
            <text
              key={`size-${id}`}
              transform={pos.rotate
                ? `translate(${pos.x} ${pos.y}) rotate(${pos.rotate})`
                : `translate(${pos.x} ${pos.y})`}
              fontSize="8"
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight="500"
              fill="rgba(255,255,255,0.45)"
              pointerEvents="none"
              style={{ userSelect: "none" }}
            >
              {formatSize(lot.size)}
            </text>
          );
        })}

        {/* CARRETERA PRINCIPAL */}
        <text
          fontFamily="'Inter', system-ui, sans-serif"
          fontSize="11"
          fontWeight="700"
          letterSpacing="4"
          fill="rgba(255,255,255,0.85)"
          style={{ pointerEvents: "none" }}
        >
          <textPath href="#path-carretera-rc" startOffset="50%" textAnchor="middle">
            CARRETERA PRINCIPAL
          </textPath>
        </text>
      </svg>

      {/* Tooltip */}
      {tooltip.visible && tooltip.lot && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl shadow-2xl p-3 text-sm min-w-[165px]"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            transform: tooltip.x > 500 ? "translateX(-110%)" : undefined,
            backgroundColor: "#111a14",
            border: "1px solid rgba(116,206,82,0.2)",
          }}
        >
          <div className="font-bold text-white text-base mb-1">Lote {tooltip.lot.id}</div>
          <div style={{ color: "rgba(255,255,255,0.6)" }}>{tooltip.lot.size.toLocaleString("es-CR")} m²</div>
          {tooltip.lot.available ? (
            <>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>${tooltip.lot.pricePerM2} USD/m²</div>
              <div className="font-semibold mt-1" style={{ color: "#74CE52" }}>{formatUSD(tooltip.lot.total)}</div>
              <div className="text-xs mt-1 font-medium" style={{ color: "#74CE52" }}>Disponible ✓</div>
            </>
          ) : (
            <div className="text-xs font-medium mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>No disponible</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 px-1">
        {[
          { color: "#2d4a2b", border: "#5fa861", label: "Disponible" },
          { color: "rgba(50,60,55,0.55)", border: "rgba(100,116,139,0.35)", label: "No disponible" },
        ].map(({ color, border, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span className="w-3.5 h-3.5 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: color, border: `1px solid ${border}` }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span className="inline-block w-5 h-1.5 rounded" style={{ backgroundColor: "#2a2a2a", border: "1px solid #4a4a4a" }} />
          Calle
        </div>
      </div>
    </div>
  );
}
