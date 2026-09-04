import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  /** 0–5. Fractional values render as half stars when `precision` is 'half'. */
  value: number;
  /** Max stars to draw. Defaults to 5. */
  max?: number;
  /** Visual size in tailwind h-* units. Defaults to 'h-4 w-4'. */
  size?: string;
  /** 'half' allows half-stars (rounded to nearest 0.5). 'full' rounds to whole. */
  precision?: 'half' | 'full';
  /** If set, the widget becomes interactive and calls onChange. */
  onChange?: (value: number) => void;
  /** Disable interaction (e.g. disabled state, loading). */
  disabled?: boolean;
  /** Extra classes applied to the wrapper. */
  className?: string;
  /** Accessible label for the whole widget. */
  ariaLabel?: string;
}

/**
 * Single source of truth for star rendering.
 * - Read-only mode: pure presentational
 * - Interactive mode: hover-preview + click-to-set, with keyboard support
 */
export default function StarRating({
  value,
  max = 5,
  size = 'h-4 w-4',
  precision = 'half',
  onChange,
  disabled = false,
  className = '',
  ariaLabel,
}: StarRatingProps) {
  const interactive = Boolean(onChange);
  const [hover, setHover] = useState<number | null>(null);

  // Normalise the displayed rating to the nearest valid fraction.
  const normalised = (() => {
    if (precision === 'half') return Math.round(value * 2) / 2;
    return Math.round(value);
  })();

  const filledClass = (idx: number) => {
    const pos = idx + 1;
    if (normalised >= pos) return 'fill-amber-400 text-amber-400';
    if (precision === 'half' && normalised >= pos - 0.5)
      return 'fill-amber-400/60 text-amber-400';
    return 'text-slate-300';
  };

  const interactiveClass = (idx: number) => {
    const v = hover ?? normalised;
    const pos = idx + 1;
    if (v >= pos) return 'fill-amber-400 text-amber-400';
    return 'text-slate-300 hover:text-amber-300';
  };

  return (
    <div
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={ariaLabel ?? `Rated ${value} out of ${max} stars`}
      className={`inline-flex items-center gap-0.5 ${className}`}
      onMouseLeave={() => interactive && setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => i).map((i) => {
        const starEl = (
          <Star
            className={`${size} ${
              interactive ? interactiveClass(i) : filledClass(i)
            } ${interactive && !disabled ? 'cursor-pointer transition-colors' : ''}`}
            strokeWidth={1.5}
          />
        );
        if (!interactive || disabled) return <span key={i}>{starEl}</span>;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={Math.round(normalised) === i + 1}
            aria-label={`${i + 1} star${i ? 's' : ''}`}
            className="rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            onMouseEnter={() => setHover(i + 1)}
            onFocus={() => setHover(i + 1)}
            onClick={() => onChange?.(i + 1)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange?.(i + 1);
              }
            }}
          >
            {starEl}
          </button>
        );
      })}
    </div>
  );
}