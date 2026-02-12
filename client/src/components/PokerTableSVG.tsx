/**
 * PokerTableSVG — Premium SVG poker table
 * Vertical oval with green felt gradient, glowing border, wood rim
 * All drawn programmatically
 */

interface PokerTableSVGProps {
  width: number;
  height: number;
  className?: string;
}

export default function PokerTableSVG({ width, height, className }: PokerTableSVGProps) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.44;
  const ry = height * 0.44;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      <defs>
        {/* Outer rim gradient - dark wood/leather */}
        <radialGradient id="tableRim" cx="50%" cy="45%">
          <stop offset="0%" stopColor="#2a2218" />
          <stop offset="40%" stopColor="#1e1a14" />
          <stop offset="80%" stopColor="#141210" />
          <stop offset="100%" stopColor="#0a0908" />
        </radialGradient>

        {/* Green felt gradient */}
        <radialGradient id="feltGrad" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#1e8a42" />
          <stop offset="20%" stopColor="#1a7a3a" />
          <stop offset="45%" stopColor="#146830" />
          <stop offset="70%" stopColor="#0e5424" />
          <stop offset="100%" stopColor="#083a17" />
        </radialGradient>

        {/* Felt texture pattern */}
        <pattern id="feltTexture" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="none" />
          <circle cx="1" cy="1" r="0.3" fill="rgba(255,255,255,0.015)" />
          <circle cx="3" cy="3" r="0.2" fill="rgba(0,0,0,0.02)" />
        </pattern>

        {/* Glow filter for border */}
        <filter id="borderGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Inner shadow */}
        <filter id="innerShadow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feOffset dx="0" dy="4" result="offset" />
          <feComposite in="SourceGraphic" in2="offset" operator="atop" />
        </filter>

        {/* Ambient light on felt */}
        <radialGradient id="feltLight" cx="50%" cy="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Outer shadow */}
      <ellipse cx={cx} cy={cy + 3} rx={rx + 12} ry={ry + 12} fill="rgba(0,0,0,0.4)" />

      {/* Table outer rim */}
      <ellipse cx={cx} cy={cy} rx={rx + 10} ry={ry + 10} fill="url(#tableRim)" />

      {/* Gold/brass border line */}
      <ellipse cx={cx} cy={cy} rx={rx + 5} ry={ry + 5}
        fill="none" stroke="rgba(212,175,55,0.12)" strokeWidth="1.5" />

      {/* Glowing inner border */}
      <ellipse cx={cx} cy={cy} rx={rx + 2} ry={ry + 2}
        fill="none" stroke="rgba(180,160,100,0.08)" strokeWidth="3" filter="url(#borderGlow)" />

      {/* Green felt */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#feltGrad)" />

      {/* Felt texture overlay */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#feltTexture)" />

      {/* Ambient light on felt */}
      <ellipse cx={cx} cy={cy} rx={rx * 0.7} ry={ry * 0.5} fill="url(#feltLight)" />

      {/* Inner felt shadow (edge darkening) */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="12"
        style={{ clipPath: `ellipse(${rx}px ${ry}px at ${cx}px ${cy}px)` }} />

      {/* Subtle inner border */}
      <ellipse cx={cx} cy={cy} rx={rx - 1} ry={ry - 1}
        fill="none" stroke="rgba(212,175,55,0.04)" strokeWidth="0.5" />
    </svg>
  );
}
