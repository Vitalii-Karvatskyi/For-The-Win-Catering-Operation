import {
  convert24HourToTimeParts,
  convertTimePartsTo24Hour,
  TIME_MINUTE_OPTIONS,
  type AllowedMinute,
} from '../../lib/cateringTime';
import type { TimePeriod } from '../../types/cateringOperations';

type CateringTimeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  'aria-invalid'?: boolean;
};

function sanitizeHourInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  if (!digits) {
    return '';
  }
  const numeric = Number(digits);
  if (numeric > 12) {
    return '12';
  }
  if (digits.length === 2 && numeric === 0) {
    return '1';
  }
  return digits;
}

export function CateringTimeInput({
  id,
  value,
  onChange,
  'aria-invalid': ariaInvalid,
}: CateringTimeInputProps) {
  const parts = convert24HourToTimeParts(value || '12:00');
  const hourText = String(parts.hour);

  function commit(next: {
    hour?: number;
    minute?: AllowedMinute;
    period?: TimePeriod;
    hourText?: string;
  }) {
    let hour = next.hour ?? parts.hour;
    if (next.hourText !== undefined) {
      const parsed = Number(next.hourText);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        hour = parts.hour;
      } else {
        hour = parsed;
      }
    }

    onChange(
      convertTimePartsTo24Hour({
        hour,
        minute: next.minute ?? parts.minute,
        period: next.period ?? parts.period,
      }),
    );
  }

  return (
    <div className="ops-time" role="group" aria-invalid={ariaInvalid}>
      <input
        id={id}
        className="ops-time__hour"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={hourText}
        aria-label="Hour"
        onChange={(event) => {
          const sanitized = sanitizeHourInput(event.target.value);
          if (!sanitized) {
            commit({ hour: 12 });
            return;
          }
          const numeric = Number(sanitized);
          if (numeric >= 1 && numeric <= 12) {
            commit({ hour: numeric });
          }
        }}
        onBlur={(event) => {
          const numeric = Number(event.target.value);
          if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
            commit({ hour: 12 });
          }
        }}
      />
      <select
        className="ops-time__minute"
        aria-label="Minutes"
        value={parts.minute}
        onChange={(event) =>
          commit({ minute: Number(event.target.value) as AllowedMinute })
        }
      >
        {TIME_MINUTE_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        className="ops-time__period"
        aria-label="AM or PM"
        value={parts.period}
        onChange={(event) => commit({ period: event.target.value as TimePeriod })}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
