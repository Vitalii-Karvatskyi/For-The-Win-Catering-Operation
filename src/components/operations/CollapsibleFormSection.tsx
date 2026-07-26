import type { ReactNode } from 'react';

type CollapsibleFormSectionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function CollapsibleFormSection({
  title,
  open,
  onToggle,
  children,
}: CollapsibleFormSectionProps) {
  return (
    <section className="ops-collapse">
      <button
        type="button"
        className="ops-collapse__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="ops-collapse__hint">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="ops-collapse__body">{children}</div> : null}
    </section>
  );
}
