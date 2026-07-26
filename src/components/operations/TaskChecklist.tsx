type TaskChecklistEntry = {
  id: string;
  name: string;
  completed: boolean;
  notes?: string;
};

type TaskChecklistProps = {
  idPrefix: string;
  items: TaskChecklistEntry[];
  onToggle: (id: string) => void;
};

export function TaskChecklist({ idPrefix, items, onToggle }: TaskChecklistProps) {
  return (
    <ul className="ops-tasklist">
      {items.map((item) => {
        const inputId = `${idPrefix}-${item.id}`;
        return (
          <li
            key={item.id}
            className={`ops-tasklist__item ${
              item.completed
                ? 'ops-tasklist__item--done'
                : 'ops-tasklist__item--pending'
            }`}
          >
            <input
              id={inputId}
              type="checkbox"
              className="ops-tasklist__checkbox"
              checked={item.completed}
              onChange={() => onToggle(item.id)}
            />
            <label className="ops-tasklist__body" htmlFor={inputId}>
              <span className="ops-tasklist__name">{item.name}</span>
              {item.notes ? (
                <span className="ops-tasklist__notes">{item.notes}</span>
              ) : null}
            </label>
            <span
              className={`ops-tasklist__status ${
                item.completed
                  ? 'ops-tasklist__status--done'
                  : 'ops-tasklist__status--pending'
              }`}
            >
              {item.completed ? 'Done' : 'Pending'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
