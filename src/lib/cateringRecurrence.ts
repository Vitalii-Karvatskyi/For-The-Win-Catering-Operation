import type { CateringEvent, RecurrenceRule } from '../types/cateringOperations';

const WEEKS_AHEAD = 12;
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

/**
 * Upcoming weekly dates from today through today + 12 weeks,
 * not before recurrence.startDate, matching dayOfWeek / interval.
 */
export function listRecurringDateKeys(
  rule: RecurrenceRule,
  referenceDate: Date = new Date(),
): string[] {
  if (!isValidRecurrence(rule)) {
    return [];
  }

  const todayKey = getLocalTodayKey(referenceDate);
  const windowEndKey = addLocalDays(todayKey, WEEKS_AHEAD * 7);
  const cursorStart =
    rule.startDate > todayKey ? rule.startDate : todayKey;

  let cursor = localDateFromKey(cursorStart);
  const targetDow = rule.dayOfWeek;

  // Move forward to the first matching weekday on/after cursorStart.
  while (cursor.getDay() !== targetDow) {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Align to interval weeks from startDate's first matching weekday.
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

  const dates: string[] = [];
  while (true) {
    const key = toLocalDateKey(cursor);
    if (key > windowEndKey) {
      break;
    }
    if (key >= rule.startDate && key >= todayKey) {
      dates.push(key);
    }
    cursor.setDate(cursor.getDate() + rule.interval * 7);
  }

  return dates;
}

export function generateRecurringOccurrences(
  template: CateringEvent,
  referenceDate: Date = new Date(),
): CateringEvent[] {
  if (!isRecurringTemplate(template) || !template.recurrence) {
    return [];
  }

  return listRecurringDateKeys(template.recurrence, referenceDate).map(
    (dateKey) => {
      const occurrence: CateringEvent = {
        ...structuredClone(template),
        id: buildOccurrenceId(template, dateKey),
        eventDate: dateKey,
        isRecurringTemplate: false,
        sourceTemplateId: template.id,
      };
      // Occurrences are virtual — never treat as templates.
      delete occurrence.isRecurringTemplate;
      return occurrence;
    },
  );
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Expand stored events for the dashboard:
 * - hide recurring templates
 * - inject generated occurrences
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
    // Keep template marker and recurrence for persistence.
    return next;
  }
  delete next.isRecurringTemplate;
  return next;
}
