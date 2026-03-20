import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  value: '',
  onValueChange: () => {},
  name: '',
});

// ─── RadioGroup ───────────────────────────────────────────────────────────────

interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
    const controlled = value !== undefined;
    const currentValue = controlled ? value! : internalValue;
    const name = React.useId();

    const handleChange = React.useCallback(
      (v: string) => {
        if (!controlled) setInternalValue(v);
        onValueChange?.(v);
      },
      [controlled, onValueChange],
    );

    return (
      <RadioGroupContext.Provider value={{ value: currentValue, onValueChange: handleChange, name }}>
        <div ref={ref} role="radiogroup" className={cn('grid gap-2', className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

// ─── RadioGroupItem ───────────────────────────────────────────────────────────

interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ value, className, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    return (
      <input
        ref={ref}
        type="radio"
        name={ctx.name}
        value={value}
        checked={ctx.value === value}
        onChange={() => ctx.onValueChange(value)}
        className={cn(
          'aspect-square h-4 w-4 rounded-full border border-primary text-primary accent-primary',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
