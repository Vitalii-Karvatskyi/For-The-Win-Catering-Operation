import type { CateringEvent } from '../../types/cateringOperations';
import {
  formatEventMonthDay,
  formatTime,
  formatTimeRange,
  formatWeekday,
  getCompletedTaskCount,
  getPendingTaskCount,
  getReadinessPercent,
  getStatusLabel,
  getTotalTaskCount,
} from '../../lib/cateringOperations';
import { CateringEventDetails } from './CateringEventDetails';

type CateringEventCardProps = {
  event: CateringEvent;
  expanded: boolean;
  savingChecklistIds: ReadonlySet<string>;
  onToggle: () => void;
  onEdit: () => void;
  onTogglePreparationTask: (eventId: string, taskId: string) => Promise<void>;
  onToggleDocument: (eventId: string, documentId: string) => Promise<void>;
};

export function CateringEventCard({
  event,
  expanded,
  savingChecklistIds,
  onToggle,
  onEdit,
  onTogglePreparationTask,
  onToggleDocument,
}: CateringEventCardProps) {
  const total = getTotalTaskCount(event);
  const completed = getCompletedTaskCount(event);
  const pending = getPendingTaskCount(event);
  const percent = getReadinessPercent(event);
  const detailsId = `event-details-${event.id}`;

  return (
    <article className={`ops-card ops-card--${event.status}`}>
      <div className="ops-card__toolbar">
        <button
          type="button"
          className="ops-btn ops-btn--secondary ops-card__edit"
          onClick={onEdit}
        >
          Edit Catering
        </button>
      </div>

      <button
        type="button"
        className="ops-card__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <div className="ops-card__top">
          <div className="ops-card__date-block">
            <p className="ops-card__weekday">{formatWeekday(event.eventDate)}</p>
            <p className="ops-card__date">{formatEventMonthDay(event.eventDate)}</p>
          </div>
          <span className={`ops-status ops-status--${event.status}`}>
            {getStatusLabel(event.status)}
          </span>
        </div>

        <div className="ops-card__main">
          <h3 className="ops-card__title">{event.eventName}</h3>
          <p className="ops-card__address">{event.address}</p>
        </div>

        <div className="ops-card__meta">
          <div className="ops-card__meta-item">
            <span className="ops-card__meta-label">Setup</span>
            <span className="ops-card__meta-value">{formatTime(event.setupTime)}</span>
          </div>
          <div className="ops-card__meta-item">
            <span className="ops-card__meta-label">Service</span>
            <span className="ops-card__meta-value">
              {formatTimeRange(event.serviceStartTime, event.serviceEndTime)}
            </span>
          </div>
          <div className="ops-card__meta-item">
            <span className="ops-card__meta-label">Guests</span>
            <span className="ops-card__meta-value">{event.guestCount}</span>
          </div>
          <div className="ops-card__meta-item">
            <span className="ops-card__meta-label">Team</span>
            <span className="ops-card__meta-value">
              {event.assignedEmployees.length > 0
                ? event.assignedEmployees.join(', ')
                : 'Unassigned'}
            </span>
          </div>
        </div>

        <div className="ops-card__progress">
          <div className="ops-card__progress-header">
            <span>
              {completed}/{total} complete · {pending} remaining
            </span>
            <span className="ops-card__progress-percent">{percent}%</span>
          </div>
          <div
            className="ops-card__progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={`Preparation ${percent}% complete`}
          >
            <div
              className="ops-card__progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <span className="ops-card__expand-hint">
          {expanded ? 'Hide details' : 'Show details'}
        </span>
      </button>

      {expanded ? (
        <div id={detailsId} className="ops-card__details">
          <CateringEventDetails
            event={event}
            savingChecklistIds={savingChecklistIds}
            onTogglePreparationTask={onTogglePreparationTask}
            onToggleDocument={onToggleDocument}
          />
        </div>
      ) : null}
    </article>
  );
}
