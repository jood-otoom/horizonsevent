import { useId } from "react";
import { calculateProgressPercent } from "../../lib/progress";

export interface SemiCircularGaugeProps {
  value: number;
  maxValue: number;
  displayValue: string;
  label: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  ariaLabel?: string;
  loading?: boolean;
}

export function SemiCircularGauge({
  value,
  maxValue,
  displayValue,
  label,
  color = "var(--display-red)",
  size = 400,
  strokeWidth = 28,
  ariaLabel,
  loading = false,
}: SemiCircularGaugeProps) {
  const gradientId = useId();
  const progress = calculateProgressPercent(value, maxValue);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size - strokeWidth) / 2;
  const startX = strokeWidth / 2;
  const endX = size - strokeWidth / 2;
  const progressAngle = Math.PI - (progress / 100) * Math.PI;
  const indicatorX = centerX + radius * Math.cos(progressAngle);
  const indicatorY = centerY - radius * Math.sin(progressAngle);
  const path = `M ${startX} ${centerY} A ${radius} ${radius} 0 0 1 ${endX} ${centerY}`;
  const accessibleLabel =
    ariaLabel ?? `${displayValue}, ${label}, ${Math.round(progress)} percent of target`;

  return (
    <div className={`gauge-frame${loading ? " gauge-loading" : ""}`}>
      <svg
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        role="img"
        aria-label={accessibleLabel}
        data-progress={progress}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor="#d65c73" />
          </linearGradient>
        </defs>
        <path
          d={path}
          pathLength="100"
          fill="none"
          stroke="var(--display-track)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {progress > 0 && (
          <path
            d={path}
            pathLength="100"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progress} 100`}
            className="gauge-progress"
          />
        )}
        {progress > 0 && (
          <circle
            cx={indicatorX}
            cy={indicatorY}
            r={strokeWidth * 0.39}
            fill={color}
            stroke="white"
            strokeWidth={strokeWidth * 0.16}
            className="gauge-indicator"
          />
        )}
      </svg>
      <div className="gauge-center" aria-hidden="true">
        <span className="gauge-value">{loading ? "0" : displayValue}</span>
        <span className="gauge-label">{loading ? "Loading" : label}</span>
      </div>
    </div>
  );
}

export default SemiCircularGauge;
