import type { OperationsSummaryCounts } from '../../types/cateringOperations';

type OperationsSummaryProps = {
  counts: OperationsSummaryCounts;
};

const SUMMARY_ITEMS: Array<{
  key: keyof OperationsSummaryCounts;
  label: string;
}> = [
  { key: 'upcomingEvents', label: 'Upcoming Events' },
  { key: 'eventsThisWeek', label: 'Events This Week' },
  { key: 'needsAttention', label: 'Needs Attention' },
  { key: 'ready', label: 'Ready' },
];

export function OperationsSummary({ counts }: OperationsSummaryProps) {
  return (
    <section className="ops-summary" aria-label="Operations summary">
      <div className="ops-summary__grid">
        {SUMMARY_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`ops-summary__card ops-summary__card--${item.key}`}
          >
            <p className="ops-summary__value">{counts[item.key]}</p>
            <p className="ops-summary__label">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
