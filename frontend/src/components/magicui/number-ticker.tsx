// Adapted from Magic UI NumberTicker (MIT). See THIRD_PARTY_NOTICES.md.
// Native animation preserves the exact confirmed integer; it never counts invented buyers.
import { useEffect, useRef } from "react";
export function NumberTicker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    if (
      previous.current !== value &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      ref.current?.animate(
        [
          { transform: "translateY(4px)", opacity: 0.4 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { duration: 350, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    }
    previous.current = value;
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums inline-block">
      {value}
    </span>
  );
}
