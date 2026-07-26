import { useState } from 'react';
import type { PreparationTask } from '../../types/cateringOperations';
import { createId } from '../../lib/cateringStandards';

type PreparationTasksEditorProps = {
  tasks: PreparationTask[];
  onChange: (tasks: PreparationTask[]) => void;
};

export function PreparationTasksEditor({
  tasks,
  onChange,
}: PreparationTasksEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  function updateNotes(id: string, notes: string) {
    onChange(
      tasks.map((task) =>
        task.id === id ? { ...task, notes: notes.trim() || undefined } : task,
      ),
    );
  }

  function removeTask(id: string) {
    onChange(tasks.filter((task) => task.id !== id));
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const task: PreparationTask = {
      id: createId('task'),
      name,
      completed: false,
      source: 'custom',
    };
    if (newNotes.trim()) {
      task.notes = newNotes.trim();
    }
    onChange([...tasks, task]);
    setNewName('');
    setNewNotes('');
    setIsAdding(false);
  }

  return (
    <div className="ops-editor">
      {tasks.length === 0 ? (
        <p className="ops-editor__empty">No preparation tasks yet.</p>
      ) : (
        <ul className="ops-editor__list">
          {tasks.map((task) => (
            <li key={task.id} className="ops-editor__item">
              <div className="ops-editor__task-row">
                <span className="ops-editor__name">{task.name}</span>
                <button
                  type="button"
                  className="ops-btn ops-btn--danger"
                  onClick={() => removeTask(task.id)}
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                aria-label={`Notes for ${task.name}`}
                placeholder="Notes"
                value={task.notes ?? ''}
                onChange={(event) => updateNotes(task.id, event.target.value)}
              />
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="ops-editor__add">
          <label htmlFor="new-task-name">Task Name</label>
          <input
            id="new-task-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <label htmlFor="new-task-notes">Notes</label>
          <input
            id="new-task-notes"
            type="text"
            value={newNotes}
            onChange={(event) => setNewNotes(event.target.value)}
          />
          <div className="ops-editor__add-actions">
            <button
              type="button"
              className="ops-btn ops-btn--ghost"
              onClick={() => {
                setIsAdding(false);
                setNewName('');
                setNewNotes('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ops-btn ops-btn--secondary"
              onClick={handleAdd}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ops-btn ops-btn--secondary"
          onClick={() => setIsAdding(true)}
        >
          Add Preparation Task
        </button>
      )}
    </div>
  );
}
