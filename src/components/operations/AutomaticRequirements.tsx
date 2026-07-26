import type { CateringMenuOrder } from '../../types/cateringOperations';
import { calculateCateringRequirements } from '../../lib/cateringCalculations';

type AutomaticRequirementsProps = {
  menuOrder: CateringMenuOrder;
};

export function AutomaticRequirements({ menuOrder }: AutomaticRequirementsProps) {
  const requirements = calculateCateringRequirements(menuOrder);

  if (requirements.items.length === 0) {
    return (
      <p className="ops-auto__empty">
        Add menu quantities to calculate purchasing and preparation.
      </p>
    );
  }

  return (
    <ul className="ops-auto__list">
      {requirements.items.map((item) => (
        <li key={item.id} className="ops-auto__item">
          <span className="ops-auto__name">{item.name}</span>
          <span className="ops-auto__qty">{item.displayQuantity}</span>
        </li>
      ))}
    </ul>
  );
}
