import type { CateringMenuOrder, OpenMenuItem } from '../../types/cateringOperations';
import { createId } from '../../lib/cateringStandards';

type MenuOrderSectionProps = {
  value: CateringMenuOrder;
  onChange: (value: CateringMenuOrder) => void;
};

function parseNonNegativeInt(raw: string): number {
  if (raw.trim() === '') {
    return 0;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function MenuOrderSection({ value, onChange }: MenuOrderSectionProps) {
  function updateCount(
    key: 'cheeseburger' | 'doubleCheeseburger' | 'veggieBurger' | 'fries',
    raw: string,
  ) {
    onChange({
      ...value,
      [key]: parseNonNegativeInt(raw),
    });
  }

  function updateOpenItem(id: string, patch: Partial<OpenMenuItem>) {
    onChange({
      ...value,
      openItems: value.openItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeOpenItem(id: string) {
    onChange({
      ...value,
      openItems: value.openItems.filter((item) => item.id !== id),
    });
  }

  function addOpenItem() {
    onChange({
      ...value,
      openItems: [
        ...value.openItems,
        {
          id: createId('open'),
          name: '',
          quantity: 1,
        },
      ],
    });
  }

  return (
    <div className="ops-menu">
      <div className="ops-form-grid">
        <div className="ops-field">
          <label htmlFor="menu-cheeseburger">Cheeseburger</label>
          <input
            id="menu-cheeseburger"
            type="number"
            min={0}
            step={1}
            value={value.cheeseburger}
            onChange={(event) => updateCount('cheeseburger', event.target.value)}
          />
        </div>
        <div className="ops-field">
          <label htmlFor="menu-double">Double Cheeseburger</label>
          <input
            id="menu-double"
            type="number"
            min={0}
            step={1}
            value={value.doubleCheeseburger}
            onChange={(event) =>
              updateCount('doubleCheeseburger', event.target.value)
            }
          />
        </div>
        <div className="ops-field">
          <label htmlFor="menu-veggie">Veggie Burger</label>
          <input
            id="menu-veggie"
            type="number"
            min={0}
            step={1}
            value={value.veggieBurger}
            onChange={(event) => updateCount('veggieBurger', event.target.value)}
          />
        </div>
        <div className="ops-field">
          <label htmlFor="menu-fries">Fries</label>
          <input
            id="menu-fries"
            type="number"
            min={0}
            step={1}
            value={value.fries}
            onChange={(event) => updateCount('fries', event.target.value)}
          />
        </div>
      </div>

      <div className="ops-menu__open">
        <div className="ops-menu__open-header">
          <h4 className="ops-menu__open-title">Open Items</h4>
          <button type="button" className="ops-btn ops-btn--secondary" onClick={addOpenItem}>
            Add Open Item
          </button>
        </div>

        {value.openItems.length === 0 ? (
          <p className="ops-menu__empty">No open items added.</p>
        ) : (
          <ul className="ops-menu__open-list">
            {value.openItems.map((item) => (
              <li key={item.id} className="ops-menu__open-item">
                <input
                  type="text"
                  placeholder="Item Name"
                  aria-label="Open item name"
                  value={item.name}
                  onChange={(event) =>
                    updateOpenItem(item.id, { name: event.target.value })
                  }
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Qty"
                  aria-label="Open item quantity"
                  value={item.quantity}
                  onChange={(event) =>
                    updateOpenItem(item.id, {
                      quantity: parseNonNegativeInt(event.target.value),
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Notes"
                  aria-label="Open item notes"
                  value={item.notes ?? ''}
                  onChange={(event) =>
                    updateOpenItem(item.id, {
                      notes: event.target.value || undefined,
                    })
                  }
                />
                <button
                  type="button"
                  className="ops-btn ops-btn--danger"
                  onClick={() => removeOpenItem(item.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
