import type {
  CateringEvent,
  DocumentTask,
  EventDateGroup,
  OperationsSummaryCounts,
  PreparationTask,
} from '../types/cateringOperations';
import { formatTimeForDisplay } from './cateringTime';

const TIME_ZONE = 'America/Los_Angeles';

function parseDateParts(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/** Instant for an event date + local LA wall-clock time. */
export function getEventDateTime(eventDate: string, time: string): Date {
  const { year, month, day } = parseDateParts(eventDate);
  const { hours, minutes } = parseTimeParts(time);
  const asUtcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const laParts = getZonedParts(asUtcGuess);
  const desiredAsMinutes = hours * 60 + minutes;
  const actualAsMinutes = laParts.hours * 60 + laParts.minutes;
  const diffMinutes = desiredAsMinutes - actualAsMinutes;
  return new Date(asUtcGuess.getTime() + diffMinutes * 60_000);
}

function getZonedParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  weekday: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'long',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  let hours = Number(get('hour'));
  if (hours === 24) {
    hours = 0;
  }

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hours,
    minutes: Number(get('minute')),
    weekday: get('weekday'),
  };
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getTodayDateKey(referenceDate: Date = new Date()): string {
  const parts = getZonedParts(referenceDate);
  return toDateKey(parts.year, parts.month, parts.day);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateParts(dateKey);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

/** Monday through Sunday of the LA calendar week containing `dateKey`. */
function getWeekBounds(dateKey: string): { start: string; end: string } {
  const noon = getEventDateTime(dateKey, '12:00');
  const weekdayName = getZonedParts(noon).weekday;
  const weekdayIndex: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  const offset = weekdayIndex[weekdayName] ?? 0;
  const start = addDaysToDateKey(dateKey, -offset);
  const end = addDaysToDateKey(start, 6);
  return { start, end };
}

export function isUpcomingEvent(event: CateringEvent): boolean {
  return event.status !== 'completed';
}

export function sortEventsByDateAndSetup(events: CateringEvent[]): CateringEvent[] {
  return [...events].sort((a, b) => {
    const aTime = getEventDateTime(a.eventDate, a.setupTime).getTime();
    const bTime = getEventDateTime(b.eventDate, b.setupTime).getTime();
    return aTime - bTime;
  });
}

export function isEventToday(event: CateringEvent, referenceDate: Date = new Date()): boolean {
  return event.eventDate === getTodayDateKey(referenceDate);
}

export function isEventTomorrow(event: CateringEvent, referenceDate: Date = new Date()): boolean {
  const tomorrow = addDaysToDateKey(getTodayDateKey(referenceDate), 1);
  return event.eventDate === tomorrow;
}

export function isEventThisWeek(event: CateringEvent, referenceDate: Date = new Date()): boolean {
  const today = getTodayDateKey(referenceDate);
  const { start, end } = getWeekBounds(today);
  return event.eventDate >= start && event.eventDate <= end;
}

/** Only Preparation Tasks and added Documents count toward progress. */
type TrackableItem = PreparationTask | DocumentTask;

export function getTrackableItems(event: CateringEvent): TrackableItem[] {
  return [...event.preparationTasks, ...event.documents];
}

export function getTotalTaskCount(event: CateringEvent): number {
  return getTrackableItems(event).length;
}

export function getCompletedTaskCount(event: CateringEvent): number {
  return getTrackableItems(event).filter((item) => item.completed).length;
}

export function getPendingTaskCount(event: CateringEvent): number {
  return getTrackableItems(event).filter((item) => !item.completed).length;
}

export function getReadinessPercent(event: CateringEvent): number {
  const total = getTotalTaskCount(event);
  if (total === 0) {
    return 0;
  }
  return Math.round((getCompletedTaskCount(event) / total) * 100);
}

/**
 * Ready when there is at least one Preparation Task and every Preparation Task
 * and added Document is completed. Products/Equipment never block Ready.
 */
export function isEventFullyPrepared(event: CateringEvent): boolean {
  if (event.preparationTasks.length === 0) {
    return false;
  }
  return getPendingTaskCount(event) === 0;
}

export function isEventReady(event: CateringEvent): boolean {
  return event.status === 'ready' || isEventFullyPrepared(event);
}

export function needsAttention(event: CateringEvent): boolean {
  return isUpcomingEvent(event) && getPendingTaskCount(event) > 0;
}

export function getEventDateGroup(
  event: CateringEvent,
  referenceDate: Date = new Date(),
): EventDateGroup {
  if (isEventToday(event, referenceDate)) {
    return 'today';
  }
  if (isEventTomorrow(event, referenceDate)) {
    return 'tomorrow';
  }
  if (isEventThisWeek(event, referenceDate)) {
    return 'this-week';
  }
  return 'later';
}

export type GroupedEvents = {
  group: EventDateGroup;
  label: string;
  events: CateringEvent[];
};

const GROUP_LABELS: Record<EventDateGroup, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  'this-week': 'This Week',
  later: 'Later',
};

const GROUP_ORDER: EventDateGroup[] = ['today', 'tomorrow', 'this-week', 'later'];

export function groupEventsByDate(
  events: CateringEvent[],
  referenceDate: Date = new Date(),
): GroupedEvents[] {
  const sorted = sortEventsByDateAndSetup(events.filter(isUpcomingEvent));
  const buckets: Record<EventDateGroup, CateringEvent[]> = {
    today: [],
    tomorrow: [],
    'this-week': [],
    later: [],
  };

  for (const event of sorted) {
    buckets[getEventDateGroup(event, referenceDate)].push(event);
  }

  return GROUP_ORDER.filter((group) => buckets[group].length > 0).map((group) => ({
    group,
    label: GROUP_LABELS[group],
    events: buckets[group],
  }));
}

export function getOperationsSummary(
  events: CateringEvent[],
  referenceDate: Date = new Date(),
): OperationsSummaryCounts {
  const upcoming = events.filter(isUpcomingEvent);

  return {
    upcomingEvents: upcoming.length,
    eventsThisWeek: upcoming.filter((event) => isEventThisWeek(event, referenceDate)).length,
    needsAttention: upcoming.filter(needsAttention).length,
    ready: upcoming.filter(isEventReady).length,
  };
}

/** Example: Monday, August 3 */
export function formatEventDate(eventDate: string): string {
  const date = getEventDateTime(eventDate, '12:00');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** Example: August 3 */
export function formatEventMonthDay(eventDate: string): string {
  const date = getEventDateTime(eventDate, '12:00');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatWeekday(eventDate: string): string {
  const date = getEventDateTime(eventDate, '12:00');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(date);
}

export function formatTime(time: string): string {
  return formatTimeForDisplay(time);
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

export function getStatusLabel(status: CateringEvent['status']): string {
  switch (status) {
    case 'planning':
      return 'Planning';
    case 'in-progress':
      return 'In Progress';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
  }
}
