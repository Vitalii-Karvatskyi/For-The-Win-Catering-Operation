import type { CateringEvent, SupplyItem } from '../../types/cateringOperations';
import { calculateCateringRequirements } from '../../lib/cateringCalculations';
import { TaskChecklist } from './TaskChecklist';

type CateringEventDetailsProps = {
  event: CateringEvent;
  savingChecklistIds: ReadonlySet<string>;
  onTogglePreparationTask: (eventId: string, taskId: string) => Promise<void>;
  onToggleDocument: (eventId: string, documentId: string) => Promise<void>;
};

function formatSupplyQuantity(item: SupplyItem): string {
  return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
}

function SupplyList({ items }: { items: SupplyItem[] }) {
  return (
    <ul className="ops-details__supplies">
      {items.map((item) => (
        <li key={item.id} className="ops-details__supply">
          <span className="ops-details__supply-name">{item.name}</span>
          <span className="ops-details__supply-qty">{formatSupplyQuantity(item)}</span>
          {item.notes ? (
            <span className="ops-details__supply-notes">{item.notes}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function CateringEventDetails({
  event,
  savingChecklistIds,
  onTogglePreparationTask,
  onToggleDocument,
}: CateringEventDetailsProps) {
  const menu = event.menuOrder;
  const hasStandardMenu =
    menu.cheeseburger > 0 ||
    menu.doubleCheeseburger > 0 ||
    menu.veggieBurger > 0 ||
    menu.fries > 0;
  const hasOpenItems = menu.openItems.length > 0;
  const requirements = calculateCateringRequirements(menu);
  const hasNotes = Boolean(event.notes?.trim());
  const hasEmployees = event.assignedEmployees.length > 0;

  return (
    <div className="ops-details">
      {hasEmployees ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Assigned employees</h3>
          <ul className="ops-details__employees">
            {event.assignedEmployees.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ops-details__section">
        <h3 className="ops-details__heading">Menu Order</h3>
        {!hasStandardMenu && !hasOpenItems ? (
          <p className="ops-details__empty">No menu items added.</p>
        ) : (
          <ul className="ops-details__menu">
            {menu.cheeseburger > 0 ? (
              <li>Cheeseburger — {menu.cheeseburger}</li>
            ) : null}
            {menu.doubleCheeseburger > 0 ? (
              <li>Double Cheeseburger — {menu.doubleCheeseburger}</li>
            ) : null}
            {menu.veggieBurger > 0 ? (
              <li>Veggie Burger — {menu.veggieBurger}</li>
            ) : null}
            {menu.fries > 0 ? <li>Fries — {menu.fries}</li> : null}
            {menu.openItems.map((item) => (
              <li key={item.id}>
                {item.name} — {item.quantity}
                {item.notes ? ` (${item.notes})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {requirements.items.length > 0 ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Purchasing & Preparation</h3>
          <ul className="ops-details__menu">
            {requirements.items.map((item) => (
              <li key={item.id}>
                {item.name} — {item.displayQuantity}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {event.preparationTasks.length > 0 ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Preparation Tasks</h3>
          <TaskChecklist
            idPrefix={`task-${event.id}`}
            items={event.preparationTasks}
            busyIds={
              new Set(
                [...savingChecklistIds]
                  .filter((key) => key.startsWith(`${event.id}:task:`))
                  .map((key) => key.slice(`${event.id}:task:`.length)),
              )
            }
            onToggle={(taskId) => {
              void onTogglePreparationTask(event.id, taskId);
            }}
          />
        </section>
      ) : null}

      {event.products.length > 0 ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Products & Food Items</h3>
          <SupplyList items={event.products} />
        </section>
      ) : null}

      {event.equipment.length > 0 ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Equipment & Supplies</h3>
          <SupplyList items={event.equipment} />
        </section>
      ) : null}

      {event.documents.length > 0 ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Documents</h3>
          <TaskChecklist
            idPrefix={`doc-${event.id}`}
            items={event.documents}
            busyIds={
              new Set(
                [...savingChecklistIds]
                  .filter((key) => key.startsWith(`${event.id}:doc:`))
                  .map((key) => key.slice(`${event.id}:doc:`.length)),
              )
            }
            onToggle={(documentId) => {
              void onToggleDocument(event.id, documentId);
            }}
          />
        </section>
      ) : null}

      {hasNotes ? (
        <section className="ops-details__section">
          <h3 className="ops-details__heading">Notes</h3>
          <p className="ops-details__notes">{event.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
