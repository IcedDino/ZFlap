interface ZedMascotProps {
  size?: number
  className?: string
}

export default function ZedMascot({ size = 40, className }: ZedMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zed the automaton"
    >
      {/* Antenna */}
      <line x1="24" y1="5" x2="24" y2="1" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="24" cy="1" r="2" fill="#F97316"/>

      {/* Ears */}
      <rect x="2"  y="17" width="7" height="13" rx="3.5" fill="#EA6C0A"/>
      <rect x="39" y="17" width="7" height="13" rx="3.5" fill="#EA6C0A"/>

      {/* Head */}
      <rect x="8" y="6" width="32" height="35" rx="9" fill="#F97316"/>

      {/* Left eye — non-final state (simple dot) */}
      <circle cx="17" cy="22" r="7"   fill="white"/>
      <circle cx="17" cy="22" r="3"   fill="#F97316"/>

      {/* Right eye — final state (double ring, thick so it reads at small sizes) */}
      <circle cx="31" cy="22" r="7"   fill="white"/>
      <circle cx="31" cy="22" r="5"   fill="none" stroke="#F97316" strokeWidth="2.4"/>
      <circle cx="31" cy="22" r="2"   fill="#F97316"/>

      {/* Mouth */}
      <rect x="15" y="32" width="18" height="3.2" rx="1.6" fill="white" opacity="0.85"/>
    </svg>
  )
}
