/**
 * PokerCard — Premium SVG-based playing card
 * All graphics drawn programmatically, no external images
 */
import { motion } from 'framer-motion';

const SUIT_DATA: Record<string, { symbol: string; color: string; name: string }> = {
  hearts: { symbol: '♥', color: '#E53935', name: 'hearts' },
  diamonds: { symbol: '♦', color: '#E53935', name: 'diamonds' },
  clubs: { symbol: '♣', color: '#263238', name: 'clubs' },
  spades: { symbol: '♠', color: '#263238', name: 'spades' },
  h: { symbol: '♥', color: '#E53935', name: 'hearts' },
  d: { symbol: '♦', color: '#E53935', name: 'diamonds' },
  c: { symbol: '♣', color: '#263238', name: 'clubs' },
  s: { symbol: '♠', color: '#263238', name: 'spades' },
};

function normalizeRank(rank: string): string {
  if (rank === 'T') return '10';
  return rank;
}

interface PokerCardProps {
  card: { suit: string; rank: string };
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  delay?: number;
  highlight?: boolean;
}

const SIZES = {
  xs: { w: 24, h: 34, rankFs: 9, suitFs: 7, centerFs: 12, corner: 3 },
  sm: { w: 32, h: 46, rankFs: 11, suitFs: 9, centerFs: 16, corner: 4 },
  md: { w: 44, h: 63, rankFs: 14, suitFs: 11, centerFs: 22, corner: 5 },
  lg: { w: 56, h: 80, rankFs: 17, suitFs: 13, centerFs: 28, corner: 6 },
  xl: { w: 68, h: 97, rankFs: 20, suitFs: 16, centerFs: 34, corner: 7 },
};

/* Card back pattern - drawn with SVG */
function CardBack({ w, h, corner }: { w: number; h: number; corner: number }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id="cardBackGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a237e" />
          <stop offset="50%" stopColor="#283593" />
          <stop offset="100%" stopColor="#1a237e" />
        </linearGradient>
        <pattern id="cardBackPattern" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="none" />
          <circle cx="3" cy="3" r="0.5" fill="rgba(255,255,255,0.08)" />
          <path d="M0 3 L6 3 M3 0 L3 6" stroke="rgba(255,255,255,0.03)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={corner} ry={corner}
        fill="url(#cardBackGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <rect x="2" y="2" width={w - 4} height={h - 4} rx={corner - 1} ry={corner - 1}
        fill="url(#cardBackPattern)" stroke="rgba(212,175,55,0.2)" strokeWidth="0.5" />
      {/* Center diamond pattern */}
      <g transform={`translate(${w / 2}, ${h / 2})`}>
        <polygon points="0,-8 5,0 0,8 -5,0" fill="none" stroke="rgba(212,175,55,0.25)" strokeWidth="0.5" />
        <polygon points="0,-4 2.5,0 0,4 -2.5,0" fill="rgba(212,175,55,0.15)" />
      </g>
    </svg>
  );
}

export default function PokerCard({ card, faceDown = false, size = 'md', animate = true, delay = 0, highlight = false }: PokerCardProps) {
  const s = SIZES[size];
  const suitInfo = SUIT_DATA[card.suit] || SUIT_DATA.spades;
  const rank = normalizeRank(String(card.rank));

  const wrapper = (children: React.ReactNode) => {
    if (!animate) return <div className="flex-shrink-0">{children}</div>;
    return (
      <motion.div
        className="flex-shrink-0"
        initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay, type: 'spring', stiffness: 200 }}
      >
        {children}
      </motion.div>
    );
  };

  if (faceDown) {
    return wrapper(
      <div style={{
        width: s.w, height: s.h,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
      }}>
        <CardBack w={s.w} h={s.h} corner={s.corner} />
      </div>
    );
  }

  return wrapper(
    <div style={{
      width: s.w, height: s.h,
      filter: highlight
        ? 'drop-shadow(0 0 8px rgba(212,175,55,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))'
        : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
    }}>
      <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`}>
        <defs>
          <linearGradient id={`cardFace-${size}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#f0f0f0" />
          </linearGradient>
        </defs>
        {/* Card body */}
        <rect x="0.5" y="0.5" width={s.w - 1} height={s.h - 1} rx={s.corner} ry={s.corner}
          fill={`url(#cardFace-${size})`} stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />
        {/* Highlight border for winning cards */}
        {highlight && (
          <rect x="0.5" y="0.5" width={s.w - 1} height={s.h - 1} rx={s.corner} ry={s.corner}
            fill="none" stroke="rgba(212,175,55,0.6)" strokeWidth="1" />
        )}
        {/* Top-left rank */}
        <text x="3" y={s.rankFs + 1} fontSize={s.rankFs} fontWeight="800" fill={suitInfo.color}
          fontFamily="'Inter', sans-serif" dominantBaseline="auto">{rank}</text>
        {/* Top-left suit */}
        <text x="3" y={s.rankFs + s.suitFs + 1} fontSize={s.suitFs} fill={suitInfo.color}
          fontFamily="serif" dominantBaseline="auto">{suitInfo.symbol}</text>
        {/* Center suit (large) */}
        <text x={s.w / 2} y={s.h / 2 + s.centerFs * 0.35} fontSize={s.centerFs}
          fill={suitInfo.color} opacity="0.7" textAnchor="middle"
          fontFamily="serif">{suitInfo.symbol}</text>
        {/* Bottom-right rank + suit (rotated) */}
        <g transform={`translate(${s.w}, ${s.h}) rotate(180)`}>
          <text x="3" y={s.rankFs + 1} fontSize={s.rankFs} fontWeight="800" fill={suitInfo.color}
            fontFamily="'Inter', sans-serif" dominantBaseline="auto">{rank}</text>
          <text x="3" y={s.rankFs + s.suitFs + 1} fontSize={s.suitFs} fill={suitInfo.color}
            fontFamily="serif" dominantBaseline="auto">{suitInfo.symbol}</text>
        </g>
      </svg>
    </div>
  );
}
