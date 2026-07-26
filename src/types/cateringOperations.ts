export type CateringEventStatus =
  | 'planning'
  | 'in-progress'
  | 'ready'
  | 'completed';

/** Informational supply line item (products or equipment). No completion state. */
export type SupplyItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
  isCustom?: boolean;
  /** Quantity is derived automatically (e.g. Gas tanks, Tablecloths). */
  isAuto?: boolean;
};

export type PreparationTask = {
  id: string;
  name: string;
  completed: boolean;
  notes?: string;
  source: 'automatic' | 'custom';
};

export type DocumentTask = {
  id: string;
  name: string;
  completed: boolean;
  notes?: string;
};

export type OpenMenuItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
};

export type CateringMenuOrder = {
  cheeseburger: number;
  doubleCheeseburger: number;
  veggieBurger: number;
  fries: number;
  openItems: OpenMenuItem[];
};

/** 0 = Sunday … 6 = Saturday (JavaScript getDay()). */
export type RecurrenceRule = {
  frequency: 'weekly';
  interval: number;
  dayOfWeek: number;
  startDate: string;
};

export type ManualRequirement = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
};

export type CateringEvent = {
  id: string;
  eventName: string;
  eventDate: string;
  setupTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  address: string;
  guestCount: number;
  status: CateringEventStatus;
  assignedEmployees: string[];
  notes?: string;
  menuOrder: CateringMenuOrder;
  products: SupplyItem[];
  equipment: SupplyItem[];
  preparationTasks: PreparationTask[];
  documents: DocumentTask[];
  recurrence?: RecurrenceRule;
  isRecurringTemplate?: boolean;
  manualRequirements?: ManualRequirement[];
  /** Set only on in-memory generated occurrences (not persisted). */
  sourceTemplateId?: string;
};

export type Employee = {
  id: string;
  name: string;
};

export type CateringFormMode = 'create' | 'edit';

export type EventDateGroup = 'today' | 'tomorrow' | 'this-week' | 'later';

export type OperationsSummaryCounts = {
  upcomingEvents: number;
  eventsThisWeek: number;
  needsAttention: number;
  ready: number;
};

export type TimePeriod = 'AM' | 'PM';

export type TimeParts = {
  hour: number;
  minute: 0 | 15 | 30 | 45;
  period: TimePeriod;
};

export type CalculatedRequirement = {
  id: string;
  name: string;
  displayQuantity: string;
};

export type CateringRequirements = {
  beefPattyCount: number;
  veggiePattyCount: number;
  bunCount: number;
  totalPattyCount: number;
  beefContainers: number;
  veggiePattyPacks: number;
  bunContainers: number;
  cheesePacks: number;
  frySauceBottles: number;
  grilledOnionsOz: number;
  fullFriesBoxes: number;
  extraFriesBags: number;
  items: CalculatedRequirement[];
};
