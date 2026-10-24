import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: 0 | 1 | 2;
  suffix?: string;
  trimTrailingZeros?: boolean;
  emphasizeIncrease?: boolean;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function formatValue(value: number, decimals: 0 | 1 | 2, trimTrailingZeros: boolean): string {
  const rounded = Number(value.toFixed(decimals));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: trimTrailingZeros ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
}

export default function AnimatedCounter({
  value,
  duration = 900,
  decimals = 0,
  suffix = "",
  trimTrailingZeros = false,
  emphasizeIncrease = true,
}: AnimatedCounterProps) {
  const [displayed, setDisplayed] = useState(value);
  const displayedRef = useRef(value);
  const previousValueRef = useRef(value);
  const latestValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const emphasisRef = useRef<Animation | null>(null);
  const elementRef = useRef<HTMLSpanElement>(null);
  latestValueRef.current = value;

  useEffect(() => {
    const media = window.matchMedia?.(reducedMotionQuery);
    if (!media) return;
    const onChange = () => {
      if (!media.matches) return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      emphasisRef.current?.cancel();
      displayedRef.current = latestValueRef.current;
      setDisplayed(latestValueRef.current);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const previous = previousValueRef.current;
    if (Object.is(previous, value)) return;
    previousValueRef.current = value;

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    emphasisRef.current?.cancel();

    if (value < previous || duration <= 0 || window.matchMedia?.(reducedMotionQuery)?.matches) {
      displayedRef.current = value;
      setDisplayed(value);
      return;
    }

    const from = displayedRef.current;
    const startedAt = performance.now();
    const precision = 10 ** decimals;
    const animateFrame = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const eased = 1 - (1 - progress) ** 3;
      const next = progress === 1 ? value : Math.round((from + (value - from) * eased) * precision) / precision;
      if (!Object.is(next, displayedRef.current)) {
        displayedRef.current = next;
        setDisplayed(next);
      }
      frameRef.current = progress < 1 ? requestAnimationFrame(animateFrame) : null;
    };
    frameRef.current = requestAnimationFrame(animateFrame);

    if (emphasizeIncrease && elementRef.current?.animate) {
      emphasisRef.current = elementRef.current.animate([
        { transform: "scale(1)" },
        { transform: "scale(1.06)", offset: 0.35 },
        { transform: "scale(1)" },
      ], { duration, easing: "ease-out" });
    }
  }, [value, duration, decimals, emphasizeIncrease]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    emphasisRef.current?.cancel();
  }, []);

  return (
    <span className="animated-counter" ref={elementRef} aria-label={`${formatValue(value, decimals, trimTrailingZeros)}${suffix}`}>
      {formatValue(displayed, decimals, trimTrailingZeros)}{suffix}
    </span>
  );
}
