import type { CateringEvent } from '../../types/cateringOperations';
import type { GroupedEvents } from '../../lib/cateringOperations';
import { CateringEventCard } from './CateringEventCard';

type CateringEventListProps = {
  groups: GroupedEvents[];
  expandedIds: ReadonlySet<string>;
  onToggle: (eventId: string) => void;
  onEdit: (event: CateringEvent) => void;
  onUpdateEvent: (event: CateringEvent) => void;
};

export function CateringEventList({
  groups,
  expandedIds,
  onToggle,
  onEdit,
  onUpdateEvent,
}: CateringEventListProps) {
  return (
    <div className="ops-event-list">
      {groups.map((group) => (
        <section
          key={group.group}
          className="ops-event-group"
          aria-labelledby={`group-${group.group}`}
        >
          <h2 id={`group-${group.group}`} className="ops-event-group__title">
            {group.label}
          </h2>
          <div className="ops-event-group__items">
            {group.events.map((event) => (
              <CateringEventCard
                key={event.id}
                event={event}
                expanded={expandedIds.has(event.id)}
                onToggle={() => onToggle(event.id)}
                onEdit={() => onEdit(event)}
                onUpdateEvent={onUpdateEvent}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
