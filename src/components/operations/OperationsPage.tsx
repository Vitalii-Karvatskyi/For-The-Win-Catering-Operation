import { useState } from 'react';
import type { CateringEvent, CateringFormMode } from '../../types/cateringOperations';
import {
  getOperationsSummary,
  groupEventsByDate,
} from '../../lib/cateringOperations';
import {
  collectEmployeeNames,
  loadCaterings,
  saveCaterings,
} from '../../lib/cateringStorage';
import { loadEmployees } from '../../lib/employeeStorage';
import { OperationsHeader } from './OperationsHeader';
import { OperationsSummary } from './OperationsSummary';
import { CateringEventList } from './CateringEventList';
import { EmptyState } from './EmptyState';
import { AddCateringModal } from './AddCateringModal';
import '../../styles/operations.css';

type ModalState =
  | { open: false }
  | { open: true; mode: CateringFormMode; event: CateringEvent | null };

export function OperationsPage() {
  const [events, setEvents] = useState<CateringEvent[]>(() => {
    const loaded = loadCaterings();
    loadEmployees(collectEmployeeNames(loaded));
    return loaded;
  });
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [modal, setModal] = useState<ModalState>({ open: false });

  const summary = getOperationsSummary(events);
  const groups = groupEventsByDate(events);

  function handleToggle(eventId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  function handleSaveCatering(event: CateringEvent) {
    setEvents((current) => {
      const index = current.findIndex((item) => item.id === event.id);
      const next =
        index === -1
          ? [...current, event]
          : current.map((item, itemIndex) =>
              itemIndex === index ? event : item,
            );
      saveCaterings(next);
      return next;
    });
  }

  return (
    <div className="ops-page">
      <OperationsHeader
        onAddCatering={() =>
          setModal({ open: true, mode: 'create', event: null })
        }
      />
      <main className="ops-main">
        <div className="ops-container">
          <OperationsSummary counts={summary} />
          {groups.length === 0 ? (
            <EmptyState />
          ) : (
            <CateringEventList
              groups={groups}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onEdit={(event) =>
                setModal({ open: true, mode: 'edit', event })
              }
              onUpdateEvent={handleSaveCatering}
            />
          )}
        </div>
      </main>

      <AddCateringModal
        open={modal.open}
        mode={modal.open ? modal.mode : 'create'}
        event={modal.open ? modal.event : null}
        onClose={() => setModal({ open: false })}
        onSave={handleSaveCatering}
      />
    </div>
  );
}
