"use client";

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RecurrenceFrequency, RecurrenceRule } from '@/lib/types';

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Daily', unit: 'day(s)' },
  { value: 'weekly', label: 'Weekly', unit: 'week(s)' },
  { value: 'monthly', label: 'Monthly', unit: 'month(s)' },
];

const NONE_VALUE = 'none';

/**
 * "Does this task repeat?" control. Shared by CreateTaskDialog (new task)
 * and TaskDetailPanel (existing task) so both stay in sync with the same
 * options and behavior.
 */
export function RecurrencePicker({
  value,
  onChange,
  disabled,
}: {
  value: RecurrenceRule | null | undefined;
  onChange: (rule: RecurrenceRule | null) => void;
  disabled?: boolean;
}) {
  const selectedFrequency = value?.frequency ?? NONE_VALUE;
  const unit = FREQUENCY_OPTIONS.find((f) => f.value === selectedFrequency)?.unit;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedFrequency}
        disabled={disabled}
        onValueChange={(val) => {
          if (val === NONE_VALUE) {
            onChange(null);
          } else {
            onChange({ frequency: val as RecurrenceFrequency, interval: value?.interval ?? 1 });
          }
        }}
      >
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Does not repeat</SelectItem>
          {FREQUENCY_OPTIONS.map((f) => (
            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">Every</span>
          <Input
            type="number"
            min={1}
            className="h-9 w-16"
            value={value.interval}
            disabled={disabled}
            onChange={(e) => {
              const interval = Math.max(1, parseInt(e.target.value, 10) || 1);
              onChange({ frequency: value.frequency, interval });
            }}
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}
