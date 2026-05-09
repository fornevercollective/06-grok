import React, { useId } from 'react';

export type UgradBlochSphereSvgProps = {
  /** Polar angle from |0⟩ (north), radians */
  thetaRad: number;
  /** Azimuth in X–Y, radians (ignored at poles where sin θ = 0) */
  phiRad: number;
  className?: string;
  /** Larger hit area on reference sphere; smaller for enumeration strip */
  variant?: 'main' | 'mini';
};

/** Static Bloch S² diagram: equator, axes, state vector from (θ, φ). Unique defs via React useId(). */
const UgradBlochSphereSvg: React.FC<UgradBlochSphereSvgProps> = ({
  thetaRad,
  phiRad,
  className = 'nt-hx-ugrad-bloch-svg',
  variant = 'main',
}) => {
  const uid = useId().replace(/:/g, '');
  const surfId = `nt-bloch-surf-${uid}`;
  const glowId = `nt-bloch-glow-${uid}`;
  const r = 48;
  const cx = 60;
  const cy = 60;
  const sx = cx + r * Math.sin(thetaRad) * Math.cos(phiRad);
  const sy = cy - r * Math.cos(thetaRad);

  return (
    <svg
      className={className + (variant === 'mini' ? ' nt-hx-ugrad-bloch-svg--mini' : '')}
      viewBox="0 0 120 120"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={surfId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(88,166,255,0.35)" />
          <stop offset="55%" stopColor="rgba(13,17,23,0.85)" />
          <stop offset="100%" stopColor="rgba(1,4,8,0.95)" />
        </radialGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse
        cx="60"
        cy="60"
        rx="50"
        ry="17"
        fill="none"
        stroke="rgba(88,166,255,0.35)"
        strokeWidth="1"
      />
      <circle cx="60" cy="60" r="50" fill={`url(#${surfId})`} stroke="var(--iss-line)" strokeWidth="1.25" />
      <line x1="60" y1="10" x2="60" y2="110" stroke="rgba(139,148,158,0.45)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="10" y1="60" x2="110" y2="60" stroke="rgba(139,148,158,0.35)" strokeWidth="1" strokeDasharray="2 4" />
      <line
        x1="60"
        y1="60"
        x2={sx}
        y2={sy}
        stroke="#f0883e"
        strokeWidth="2"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      />
      <circle cx={sx} cy={sy} r="3.5" fill="#f0883e" stroke="#0d1117" strokeWidth="1" />
      <text x="54" y="14" fill="var(--qp-text-secondary)" fontSize="9" fontFamily="var(--font-mono),monospace">
        |0⟩
      </text>
      <text x="54" y="114" fill="var(--qp-text-secondary)" fontSize="9" fontFamily="var(--font-mono),monospace">
        |1⟩
      </text>
      <text x="102" y="63" fill="var(--qp-accent)" fontSize="8" fontFamily="var(--font-mono),monospace">
        |+⟩
      </text>
      <text x="4" y="63" fill="var(--grok-purple)" fontSize="8" fontFamily="var(--font-mono),monospace">
        |−⟩
      </text>
      <text x="60" y="56" fill="var(--iss-muted)" fontSize="7" fontFamily="var(--font-mono),monospace" textAnchor="middle">
        ψ
      </text>
    </svg>
  );
};

export default UgradBlochSphereSvg;
