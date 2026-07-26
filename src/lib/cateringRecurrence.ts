import type { CateringEvent, RecurrenceRule } from '../types/cateringOperations';

const ALTADENA_TEMPLATE_ID = 'altadena-popup-weekly-template';

export function parseLocalDateKey(dateKey: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

/** Local calendar date at noon (avoids DST edge issues). */
export function localDateFromKey(dateKey: string): Date {
  const { year, month, day } = parseLocalDateKey(dateKey);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTodayKey(referenceDate: Date = new Date()): string {
  return toLocalDateKey(referenceDate);
}

export function addLocalDays(dateKey: string, days: number): string {
  const date = localDateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

export function isRecurringTemplate(event: CateringEvent): boolean {
  return event.isRecurringTemplate === true && Boolean(event.recurrence);
}

export function isRecurringOccurrence(event: CateringEvent): boolean {
  return Boolean(event.sourceTemplateId);
}

export function buildOccurrenceId(template: CateringEvent, dateKey: string): string {
  if (template.id === ALTADENA_TEMPLATE_ID) {
    return `altadena-popup-${dateKey}`;
  }
  return `${template.id}-${dateKey}`;
}

function isValidRecurrence(rule: RecurrenceRule): boolean {
  return (
    rule.frequency === 'weekly' &&
    Number.isInteger(rule.interval) &&
    rule.interval >= 1 &&
    Number.isInteger(rule.dayOfWeek) &&
    rule.dayOfWeek >= 0 &&
    rule.dayOfWeek <= 6 &&
    /^\d{4}-\d{2}-\d{2}$/.test(rule.startDate)
  );
}

function parseServiceEndLocal(
  eventDate: string,
  serviceEndTime: string,
): Date {
  const end = serviceEndTime.trim() || '23:59';
  const match = /^(\d{1,2}):(\d{2})$/.exec(end);
  const hours = match ? Number(match[1]) : 23;
  const minutes = match ? Number(match[2]) : 59;
  const { year, month, day } = parseLocalDateKey(eventDate);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** True when the occurrence date/time is already past locally. */
export function hasOccurrenceEnded(
  eventDate: string,
  serviceEndTime: string,
  referenceDate: Date = new Date(),
): boolean {
  const todayKey = getLocalTodayKey(referenceDate);
  if (eventDate < todayKey) {
    return true;
  }
  if (eventDate > todayKey) {
    return false;
  }
  return referenceDate.getTime() > parseServiceEndLocal(eventDate, serviceEndTime).getTime();
}

/**
 * Next matching weekday on/after `fromDateKey`, aligned to interval from startDate.
 */
function firstMatchingDateOnOrAfter(
  rule: RecurrenceRule,
  fromDateKey: string,
): string | null {
  if (!isValidRecurrence(rule)) {
    return null;
  }

  const cursorStart =
    rule.startDate > fromDateKey ? rule.startDate : fromDateKey;
  let cursor = localDateFromKey(cursorStart);
  const targetDow = rule.dayOfWeek;

  while (cursor.getDay() !== targetDow) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const startAnchor = localDateFromKey(rule.startDate);
  while (startAnchor.getDay() !== targetDow) {
    startAnchor.setDate(startAnchor.getDate() + 1);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysFromAnchor = Math.round(
    (cursor.getTime() - startAnchor.getTime()) / msPerDay,
  );
  const weeksFromAnchor = Math.floor(daysFromAnchor / 7);
  const remainder = weeksFromAnchor % rule.interval;
  if (remainder !== 0) {
    cursor.setDate(cursor.getDate() + (rule.interval - remainder) * 7);
  }

  const key = toLocalDateKey(cursor);
  if (key < rule.startDate) {
    return null;
  }
  return key;
}

/**
 * Single nearest upcoming occurrence date for a weekly rule.
 * If today matches and service has not ended, returns today; otherwise the next match.
 */
export function findNearestRecurringDateKey(
  rule: RecurrenceRule,
  serviceEndTime: string,
  referenceDate: Date = new Date(),
): string | null {
  const todayKey = getLocalTodayKey(referenceDate);
  let candidate = firstMatchingDateOnOrAfter(rule, todayKey);
  if (!candidate) {
    return null;
  }

  if (
    candidate === todayKey &&
    hasOccurrenceEnded(candidate, serviceEndTime, referenceDate)
  ) {
    candidate = firstMatchingDateOnOrAfter(rule, addLocalDays(todayKey, 1));
  }

  return candidate;
}

function cloneOccurrenceFromTemplate(
  template: CateringEvent,
  dateKey: string,
): CateringEvent {
  const clone = structuredClone(template);
  clone.id = buildOccurrenceId(template, dateKey);
  clone.eventDate = dateKey;
  clone.sourceTemplateId = template.id;
  delete clone.isRecurringTemplate;
  return clone;
}

/**
 * Generate dashboard occurrences for a template.
 * Only the nearest upcoming occurrence is returned (not a long future list).
 */
export function generateRecurringOccurrences(
  template: CateringEvent,
  referenceDate: Date = new Date(),
): CateringEvent[] {
  if (!isRecurringTemplate(template) || !template.recurrence) {
    return [];
  }

  const dateKey = findNearestRecurringDateKey(
    template.recurrence,
    template.serviceEndTime,
    referenceDate,
  );
  if (!dateKey) {
    return [];
  }

  return [cloneOccurrenceFromTemplate(template, dateKey)];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Expand stored events for the dashboard:
 * - hide recurring templates
 * - inject the nearest generated occurrence per template
 * - drop one-off events that collide with a generated occurrence
 */
export function expandCateringEvents(
  storedEvents: CateringEvent[],
  referenceDate: Date = new Date(),
): CateringEvent[] {
  const templates = storedEvents.filter(isRecurringTemplate);
  const oneOffs = storedEvents.filter((event) => !isRecurringTemplate(event));

  const occurrences = templates.flatMap((template) =>
    generateRecurringOccurrences(template, referenceDate),
  );

  const occurrenceKeys = new Set(
    occurrences.map(
      (event) => `${normalizeName(event.eventName)}|${event.eventDate}`,
    ),
  );
  const occurrenceIds = new Set(occurrences.map((event) => event.id));

  const filteredOneOffs = oneOffs.filter((event) => {
    if (occurrenceIds.has(event.id)) {
      return false;
    }
    const key = `${normalizeName(event.eventName)}|${event.eventDate}`;
    return !occurrenceKeys.has(key);
  });

  return [...filteredOneOffs, ...occurrences];
}

export function resolveSeriesTemplate(
  storedEvents: CateringEvent[],
  event: CateringEvent,
): CateringEvent | null {
  if (isRecurringTemplate(event)) {
    return storedEvents.find((item) => item.id === event.id) ?? event;
  }
  if (event.sourceTemplateId) {
    return (
      storedEvents.find((item) => item.id === event.sourceTemplateId) ?? null
    );
  }
  return null;
}

/** Strip in-memory-only fields before writing to GitHub. */
export function sanitizeEventForStorage(event: CateringEvent): CateringEvent {
  const next = structuredClone(event);
  delete next.sourceTemplateId;
  if (next.isRecurringTemplate) {
    return next;
  }
  delete next.isRecurringTemplate;
  return next;
}
