/**
 * TableBackground — Atmospheric background for poker table
 * Dark gradient with floating particles, drawn programmatically
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function TableBackground() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      dur: 8 + Math.random() * 12,
      delay: Math.random() * 6,
      opacity: 0.05 + Math.random() * 0.15,
      color: i % 4 === 0 ? 'rgba(212,175,55,0.3)' : i % 4 === 1 ? 'rgba(100,200,255,0.2)' : 'rgba(255,255,255,0.15)',
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient - dark atmospheric */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 30%, #1a1520 0%, #0f0d14 30%, #080710 60%, #040308 100%)',
      }} />

      {/* Subtle vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Ambient glow from table */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] rounded-[50%]" style={{
        background: 'radial-gradient(ellipse, rgba(22,100,50,0.08) 0%, transparent 70%)',
      }} />

      {/* Floating particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
          }}
          animate={{
            y: [0, -40 - Math.random() * 30, 0],
            opacity: [0, p.opacity, 0],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
    </div>
  );
}
