import { useEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts up from 0 to `target` over `duration` ms with easeOutCubic.
 * Returns the current animated value. If `target` is not a finite number,
 * returns it as-is (so non-numeric inputs pass through unchanged).
 */
export function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof target !== "number" || !isFinite(target)) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(target * easeOutCubic(progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

/**
 * Renders a number that counts up from 0 to `value` on mount.
 *
 * Accepts numbers (`30`) or strings (`"73.3%"`, `"$42"`). Non-numeric prefix
 * and suffix characters are detected and re-applied around the animated
 * portion. Decimal places match the input.
 */
export default function AnimatedNumber({ value, duration = 1200 }) {
  const str = String(value);
  const match = str.match(/^(\D*)(-?\d+(?:\.\d+)?)(\D*)$/);
  if (!match) return <>{value}</>;

  const [, prefix, numberPart, suffix] = match;
  const target = parseFloat(numberPart);
  const decimals = numberPart.includes(".")
    ? numberPart.split(".")[1].length
    : 0;

  const animated = useCountUp(target, duration);
  const display =
    typeof animated === "number" && isFinite(animated)
      ? animated.toFixed(decimals)
      : numberPart;

  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  );
}
