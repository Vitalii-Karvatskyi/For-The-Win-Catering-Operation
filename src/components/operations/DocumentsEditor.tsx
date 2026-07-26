import type { DocumentTask } from '../../types/cateringOperations';
import { createId } from '../../lib/cateringStandards';

type DocumentsEditorProps = {
  documents: DocumentTask[];
  onChange: (documents: DocumentTask[]) => void;
};

export function DocumentsEditor({ documents, onChange }: DocumentsEditorProps) {
  function updateItem(id: string, patch: Partial<DocumentTask>) {
    onChange(
      documents.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    onChange(documents.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([
      ...documents,
      {
        id: createId('doc'),
        name: '',
        completed: false,
      },
    ]);
  }

  return (
    <div className="ops-editor">
      {documents.length === 0 ? (
        <p className="ops-editor__empty">No documents added.</p>
      ) : (
        <ul className="ops-editor__list">
          {documents.map((item) => (
            <li key={item.id} className="ops-editor__item">
              <div className="ops-editor__task-row">
                <input
                  type="text"
                  aria-label="Document Name"
                  placeholder="Document Name"
                  value={item.name}
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                />
                <button
                  type="button"
                  className="ops-btn ops-btn--danger"
                  onClick={() => removeItem(item.id)}
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                aria-label="Document notes"
                placeholder="Notes"
                value={item.notes ?? ''}
                onChange={(event) =>
                  updateItem(item.id, {
                    notes: event.target.value.trim() || undefined,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="ops-btn ops-btn--secondary" onClick={addItem}>
        Add Document
      </button>
    </div>
  );
}
