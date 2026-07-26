import type { TimeParts, TimePeriod } from '../types/cateringOperations';

const ALLOWED_MINUTES = [0, 15, 30, 45] as const;

export type AllowedMinute = (typeof ALLOWED_MINUTES)[number];

export function convert24HourToTimeParts(value: string): TimeParts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { hour: 12, minute: 0, period: 'AM' };
  }

  let hours24 = Number(match[1]);
  let minutes = Number(match[2]);

  if (!Number.isInteger(hours24) || hours24 < 0 || hours24 > 23) {
    hours24 = 0;
  }

  if (!ALLOWED_MINUTES.includes(minutes as AllowedMinute)) {
    const nearest = ALLOWED_MINUTES.reduce((best, option) =>
      Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best,
    );
    minutes = nearest;
  }

  const period: TimePeriod = hours24 >= 12 ? 'PM' : 'AM';
  let hour = hours24 % 12;
  if (hour === 0) {
    hour = 12;
  }

  return {
    hour,
    minute: minutes as AllowedMinute,
    period,
  };
}

export function convertTimePartsTo24Hour(parts: TimeParts): string {
  let hour = Math.min(12, Math.max(1, Math.trunc(parts.hour) || 12));
  const minute = ALLOWED_MINUTES.includes(parts.minute as AllowedMinute)
    ? parts.minute
    : 0;

  if (parts.period === 'AM') {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatTimeForDisplay(value: string): string {
  const parts = convert24HourToTimeParts(value);
  return `${parts.hour}:${String(parts.minute).padStart(2, '0')} ${parts.period}`;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Service end may be earlier on the clock when the event crosses midnight
 * (start in PM, end in AM). All other end <= start cases are invalid.
 */
export function isValidServiceWindow(startTime: string, endTime: string): boolean {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes > startMinutes) {
    return true;
  }

  const start = convert24HourToTimeParts(startTime);
  const end = convert24HourToTimeParts(endTime);
  return start.period === 'PM' && end.period === 'AM';
}

export const TIME_MINUTE_OPTIONS: AllowedMinute[] = [0, 15, 30, 45];
