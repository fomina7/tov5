/**
 * PokerChip — Premium SVG-based poker chip
 * All graphics drawn programmatically with 3D-like appearance
 */

interface PokerChipProps {
  size?: number;
  color?: string;
  amount?: number;
  showAmount?: boolean;
}

const CHIP_COLORS: { threshold: number; primary: string; secondary: string; accent: string }[] = [
  { threshold: 0, primary: '#D4AF37', secondary: '#B8941F', accent: '#F5E6A3' },       // gold
  { threshold: 5, primary: '#DC2626', secondary: '#991B1B', accent: '#FCA5A5' },        // red
  { threshold: 25, primary: '#2563EB', secondary: '#1D4ED8', accent: '#93C5FD' },       // blue
  { threshold: 100, primary: '#16A34A', secondary: '#15803D', accent: '#86EFAC' },      // green
  { threshold: 500, primary: '#1F2937', secondary: '#111827', accent: '#9CA3AF' },      // black
  { threshold: 1000, primary: '#7C3AED', secondary: '#6D28D9', accent: '#C4B5FD' },    // purple
  { threshold: 5000, primary: '#94A3B8', secondary: '#64748B', accent: '#E2E8F0' },    // platinum
];

function getChipColor(amount: number) {
  let color = CHIP_COLORS[0];
  for (const c of CHIP_COLORS) {
    if (amount >= c.threshold) color = c;
  }
  return color;
}

export function formatChipAmount(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toLocaleString();
}

export default function PokerChip({ size = 16, color, amount = 0, showAmount = false }: PokerChipProps) {
  const chipColor = color ? CHIP_COLORS.find(c => c.primary === color) || CHIP_COLORS[0] : getChipColor(amount);
  const r = size / 2;

  return (
    <div className="inline-flex items-center gap-0.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <defs>
          <radialGradient id={`chipGrad-${chipColor.primary}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor={chipColor.accent} stopOpacity="0.4" />
            <stop offset="50%" stopColor={chipColor.primary} />
            <stop offset="100%" stopColor={chipColor.secondary} />
          </radialGradient>
        </defs>
        {/* Shadow */}
        <ellipse cx={r} cy={r + 1} rx={r - 1} ry={r - 1} fill="rgba(0,0,0,0.3)" />
        {/* Main chip body */}
        <circle cx={r} cy={r} r={r - 1} fill={`url(#chipGrad-${chipColor.primary})`} />
        {/* Edge dashes (casino chip pattern) */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 45 * Math.PI) / 180;
          const x1 = r + (r - 2) * Math.cos(angle);
          const y1 = r + (r - 2) * Math.sin(angle);
          const x2 = r + (r - 0.5) * Math.cos(angle);
          const y2 = r + (r - 0.5) * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.35)" strokeWidth={size > 12 ? 1.5 : 1} strokeLinecap="round" />
          );
        })}
        {/* Inner ring */}
        <circle cx={r} cy={r} r={r * 0.55} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        {/* Highlight */}
        <ellipse cx={r - r * 0.15} cy={r - r * 0.2} rx={r * 0.3} ry={r * 0.15}
          fill="rgba(255,255,255,0.2)" transform={`rotate(-20 ${r} ${r})`} />
      </svg>
      {showAmount && amount > 0 && (
        <span className="text-[9px] font-bold text-gold font-mono-poker whitespace-nowrap">
          {formatChipAmount(amount)}
        </span>
      )}
    </div>
  );
}

/* Chip stack - multiple chips stacked vertically */
export function ChipStack({ amount, maxChips = 4 }: { amount: number; maxChips?: number }) {
  if (amount <= 0) return null;

  const chipCount = Math.min(Math.max(1, Math.ceil(Math.log10(Math.max(amount, 2)))), maxChips);

  return (
    <div className="flex items-center gap-0.5">
      <div className="relative" style={{ width: 14, height: 14 + chipCount * 2 }}>
        {Array.from({ length: chipCount }).map((_, i) => (
          <div key={i} className="absolute" style={{ bottom: i * 2, left: 0 }}>
            <PokerChip size={14} amount={amount / (chipCount - i)} />
          </div>
        ))}
      </div>
      <span className="text-[9px] font-bold text-gold ml-0.5 font-mono-poker whitespace-nowrap">
        {formatChipAmount(amount)}
      </span>
    </div>
  );
}
