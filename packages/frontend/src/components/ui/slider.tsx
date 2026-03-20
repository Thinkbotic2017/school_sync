import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Slider ───────────────────────────────────────────────────────────────────
// A controlled slider built on a native <input type="range">.
// API matches the shadcn/Radix Slider: value is an array, onValueChange receives array.

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      className,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue?.[0] ?? min);
    const controlled = value !== undefined;
    const current = controlled ? (value![0] ?? min) : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = Number(e.target.value);
      if (!controlled) setInternalValue(num);
      onValueChange?.([num]);
    };

    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        className={cn(
          'w-full h-2 cursor-pointer appearance-none rounded-full bg-secondary',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-foreground',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
