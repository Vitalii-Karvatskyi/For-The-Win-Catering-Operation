import type { CateringEvent } from '../../types/cateringOperations';
import type { GroupedEvents } from '../../lib/cateringOperations';
import { CateringEventCard } from './CateringEventCard';

type CateringEventListProps = {
  groups: GroupedEvents[];
  expandedIds: ReadonlySet<string>;
  savingChecklistIds: ReadonlySet<string>;
  onToggle: (eventId: string) => void;
  onEdit: (event: CateringEvent) => void;
  onTogglePreparationTask: (eventId: string, taskId: string) => Promise<void>;
  onToggleDocument: (eventId: string, documentId: string) => Promise<void>;
};

export function CateringEventList({
  groups,
  expandedIds,
  savingChecklistIds,
  onToggle,
  onEdit,
  onTogglePreparationTask,
  onToggleDocument,
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
                savingChecklistIds={savingChecklistIds}
                onToggle={() => onToggle(event.id)}
                onEdit={() => onEdit(event)}
                onTogglePreparationTask={onTogglePreparationTask}
                onToggleDocument={onToggleDocument}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
