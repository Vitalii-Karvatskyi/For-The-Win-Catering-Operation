import type { SupplyItem } from '../../types/cateringOperations';
import {
  createId,
  isAutoEquipmentName,
  isStandardEquipmentName,
  isStandardProductName,
} from '../../lib/cateringStandards';

type SupplyKind = 'products' | 'equipment';

type SupplyEditorProps = {
  kind: SupplyKind;
  items: SupplyItem[];
  onChange: (items: SupplyItem[]) => void;
  addButtonLabel: string;
};

export function SupplyEditor({
  kind,
  items,
  onChange,
  addButtonLabel,
}: SupplyEditorProps) {
  function updateItem(id: string, patch: Partial<SupplyItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    const item: SupplyItem = {
      id: createId(kind === 'products' ? 'prod' : 'eq'),
      name: '',
      quantity: 1,
      isCustom: true,
    };
    onChange([...items, item]);
  }

  function handleNameChange(item: SupplyItem, name: string) {
    if (kind === 'equipment' && item.isCustom && isStandardEquipmentName(name)) {
      return;
    }
    if (kind === 'products' && item.isCustom && isStandardProductName(name)) {
      return;
    }
    updateItem(item.id, { name });
  }

  return (
    <div className="ops-editor">
      {items.length === 0 ? (
        <p className="ops-editor__empty">No items yet.</p>
      ) : (
        <ul className="ops-editor__list">
          {items.map((item) => {
            const auto = kind === 'equipment' && isAutoEquipmentName(item.name);
            return (
              <li key={item.id} className="ops-editor__item">
                <div className="ops-editor__row">
                  {item.isCustom ? (
                    <input
                      type="text"
                      aria-label="Item name"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(event) => handleNameChange(item, event.target.value)}
                    />
                  ) : (
                    <span className="ops-editor__name">
                      {item.name}
                      {auto ? (
                        <span className="ops-editor__auto">Auto</span>
                      ) : null}
                    </span>
                  )}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label="Quantity"
                    value={item.quantity}
                    disabled={auto}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      updateItem(item.id, {
                        quantity:
                          Number.isInteger(next) && next >= 0 ? next : item.quantity,
                      });
                    }}
                  />
                  <input
                    type="text"
                    aria-label="Unit"
                    placeholder="Unit"
                    value={item.unit ?? ''}
                    onChange={(event) =>
                      updateItem(item.id, {
                        unit: event.target.value.trim() || undefined,
                      })
                    }
                  />
                  {item.isCustom ? (
                    <button
                      type="button"
                      className="ops-btn ops-btn--danger"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="ops-editor__spacer" aria-hidden="true" />
                  )}
                </div>
                {item.notes ? (
                  <p className="ops-editor__notes">{item.notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="ops-btn ops-btn--secondary" onClick={addItem}>
        {addButtonLabel}
      </button>
    </div>
  );
}
