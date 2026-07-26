import type {
  CalculatedRequirement,
  CateringMenuOrder,
  CateringRequirements,
} from '../types/cateringOperations';

function formatOnionsOz(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatFriesDisplay(fullFriesBoxes: number, extraFriesBags: number): string | null {
  if (fullFriesBoxes === 0 && extraFriesBags === 0) {
    return null;
  }

  const parts: string[] = [];
  if (fullFriesBoxes > 0) {
    parts.push(`${fullFriesBoxes} ${fullFriesBoxes === 1 ? 'box' : 'boxes'}`);
  }
  if (extraFriesBags > 0) {
    parts.push(`${extraFriesBags} ${extraFriesBags === 1 ? 'bag' : 'bags'}`);
  }
  return parts.join(' + ');
}

export function calculateCateringRequirements(
  menuOrder: CateringMenuOrder,
): CateringRequirements {
  const cheeseburger = Math.max(0, menuOrder.cheeseburger);
  const doubleCheeseburger = Math.max(0, menuOrder.doubleCheeseburger);
  const veggieBurger = Math.max(0, menuOrder.veggieBurger);
  const fries = Math.max(0, menuOrder.fries);

  const beefPattyCount = cheeseburger + doubleCheeseburger * 2;
  const veggiePattyCount = veggieBurger;
  const bunCount = cheeseburger + doubleCheeseburger + veggieBurger;
  const totalPattyCount = beefPattyCount + veggiePattyCount;

  const beefContainers =
    beefPattyCount === 0 ? 0 : Math.ceil(beefPattyCount / 120);
  const veggiePattyPacks =
    veggiePattyCount === 0 ? 0 : Math.ceil(veggiePattyCount / 12);
  const bunContainers = bunCount === 0 ? 0 : Math.ceil(bunCount / 72);
  const cheesePacks = beefPattyCount === 0 ? 0 : Math.ceil(beefPattyCount / 100);
  const frySauceBottles = beefContainers;
  const grilledOnionsOz = totalPattyCount * 0.8;
  const fullFriesBoxes = Math.floor(fries / 72);
  const remainingFries = fries % 72;
  const extraFriesBags =
    remainingFries === 0 ? 0 : Math.ceil(remainingFries / 12);

  const items: CalculatedRequirement[] = [];

  if (beefContainers > 0) {
    items.push({
      id: 'auto-beef',
      name: 'Beef',
      displayQuantity: `${beefContainers} ${beefContainers === 1 ? 'container' : 'containers'}`,
    });
  }
  if (veggiePattyPacks > 0) {
    items.push({
      id: 'auto-veggie',
      name: 'Veggie patties',
      displayQuantity: `${veggiePattyPacks} ${veggiePattyPacks === 1 ? 'pack' : 'packs'}`,
    });
  }
  if (bunContainers > 0) {
    items.push({
      id: 'auto-buns',
      name: 'Buns',
      displayQuantity: `${bunContainers} ${bunContainers === 1 ? 'container' : 'containers'}`,
    });
  }
  if (cheesePacks > 0) {
    items.push({
      id: 'auto-cheese',
      name: 'Cheese',
      displayQuantity: `${cheesePacks} ${cheesePacks === 1 ? 'pack' : 'packs'}`,
    });
  }
  if (frySauceBottles > 0) {
    items.push({
      id: 'auto-fry-sauce',
      name: 'Fry sauce',
      displayQuantity: `${frySauceBottles} ${frySauceBottles === 1 ? 'bottle' : 'bottles'}`,
    });
  }
  if (grilledOnionsOz > 0) {
    items.push({
      id: 'auto-onions',
      name: 'Grilled onions',
      displayQuantity: `${formatOnionsOz(grilledOnionsOz)} oz`,
    });
  }

  const friesDisplay = formatFriesDisplay(fullFriesBoxes, extraFriesBags);
  if (friesDisplay) {
    items.push({
      id: 'auto-fries',
      name: 'Fries',
      displayQuantity: friesDisplay,
    });
  }

  return {
    beefPattyCount,
    veggiePattyCount,
    bunCount,
    totalPattyCount,
    beefContainers,
    veggiePattyPacks,
    bunContainers,
    cheesePacks,
    frySauceBottles,
    grilledOnionsOz,
    fullFriesBoxes,
    extraFriesBags,
    items,
  };
}

export function createEmptyMenuOrder(): CateringMenuOrder {
  return {
    cheeseburger: 0,
    doubleCheeseburger: 0,
    veggieBurger: 0,
    fries: 0,
    openItems: [],
  };
}
