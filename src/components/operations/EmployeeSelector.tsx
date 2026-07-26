import { useState } from 'react';
import type { Employee } from '../../types/cateringOperations';
import { addEmployee } from '../../lib/employeeStorage';

type EmployeeSelectorProps = {
  employees: Employee[];
  selectedNames: string[];
  onEmployeesChange: (employees: Employee[]) => void;
  onSelectedNamesChange: (names: string[]) => void;
};

export function EmployeeSelector({
  employees,
  selectedNames,
  onEmployeesChange,
  onSelectedNamesChange,
}: EmployeeSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  function handleAdd() {
    const result = addEmployee(employees, newName);
    if (result.error || !result.employee) {
      setError(result.error ?? 'Unable to add employee.');
      return;
    }
    onEmployeesChange(result.employees);
    onSelectedNamesChange([...selectedNames, result.employee.name]);
    setNewName('');
    setError(null);
    setIsAdding(false);
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
              onClick={() => {
                setIsAdding(false);
                setNewName('');
                setError(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="ops-btn ops-btn--secondary" onClick={handleAdd}>
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
