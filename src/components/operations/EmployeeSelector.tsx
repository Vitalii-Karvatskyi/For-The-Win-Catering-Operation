import { useState } from 'react';
import type { Employee } from '../../types/cateringOperations';

type EmployeeSelectorProps = {
  employees: Employee[];
  selectedNames: string[];
  onSelectedNamesChange: (names: string[]) => void;
  onAddEmployee: (name: string) => Promise<Employee>;
};

export function EmployeeSelector({
  employees,
  selectedNames,
  onSelectedNamesChange,
  onAddEmployee,
}: EmployeeSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedSet = new Set(
    selectedNames.map((name) => name.trim().toLowerCase()),
  );

  function toggleEmployee(name: string) {
    const key = name.trim().toLowerCase();
    if (selectedSet.has(key)) {
      onSelectedNamesChange(
        selectedNames.filter((item) => item.trim().toLowerCase() !== key),
      );
      return;
    }
    onSelectedNamesChange([...selectedNames, name]);
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Employee name is required.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const employee = await onAddEmployee(trimmed);
      onSelectedNamesChange([...selectedNames, employee.name]);
      setNewName('');
      setIsAdding(false);
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : 'Unable to add employee.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ops-employees">
      <div className="ops-employees__header">
        <span className="ops-employees__label">Assigned Employees</span>
        {!isAdding ? (
          <button
            type="button"
            className="ops-btn ops-btn--secondary"
            onClick={() => {
              setIsAdding(true);
              setError(null);
            }}
          >
            Add Employee
          </button>
        ) : null}
      </div>

      {employees.length === 0 ? (
        <p className="ops-employees__empty">No employees saved yet.</p>
      ) : (
        <ul className="ops-employees__list">
          {employees.map((employee) => {
            const checked = selectedSet.has(employee.name.trim().toLowerCase());
            return (
              <li key={employee.id}>
                <label
                  className={`ops-employees__option ${
                    checked ? 'ops-employees__option--selected' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEmployee(employee.name)}
                  />
                  <span>{employee.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {isAdding ? (
        <div className="ops-employees__add">
          <label htmlFor="add-employee-name">Employee Name</label>
          <input
            id="add-employee-name"
            type="text"
            value={newName}
            disabled={busy}
            onChange={(event) => {
              setNewName(event.target.value);
              setError(null);
            }}
          />
          {error ? <p className="ops-field__error">{error}</p> : null}
          <div className="ops-employees__add-actions">
            <button
              type="button"
              className="ops-btn ops-btn--ghost"
              disabled={busy}
              onClick={() => {
                setIsAdding(false);
                setNewName('');
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ops-btn ops-btn--secondary"
              disabled={busy}
              onClick={() => {
                void handleAdd();
              }}
            >
              {busy ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
