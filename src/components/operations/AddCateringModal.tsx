import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type {
  CateringEvent,
  CateringEventStatus,
  CateringFormMode,
  CateringMenuOrder,
  DocumentTask,
  Employee,
  PreparationTask,
  SupplyItem,
} from '../../types/cateringOperations';
import { createEmptyMenuOrder } from '../../lib/cateringCalculations';
import {
  applyAutoEquipmentQuantities,
  createCateringEventId,
  createStandardEquipment,
  createStandardProducts,
} from '../../lib/cateringStandards';
import { isValidServiceWindow } from '../../lib/cateringTime';
import { loadEmployees } from '../../lib/employeeStorage';
import { AutomaticRequirements } from './AutomaticRequirements';
import { CateringTimeInput } from './CateringTimeInput';
import { CollapsibleFormSection } from './CollapsibleFormSection';
import { DocumentsEditor } from './DocumentsEditor';
import { EmployeeSelector } from './EmployeeSelector';
import { MenuOrderSection } from './MenuOrderSection';
import { PreparationTasksEditor } from './PreparationTasksEditor';
import { SupplyEditor } from './SupplyEditor';

type CateringFormModalProps = {
  open: boolean;
  mode: CateringFormMode;
  event?: CateringEvent | null;
  onClose: () => void;
  onSave: (event: CateringEvent) => void;
  onDelete: (eventId: string) => void;
};

type FormValues = {
  eventName: string;
  eventDate: string;
  setupTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  address: string;
  guestCount: string;
  notes: string;
  status: CateringEventStatus;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

type SectionKey =
  | 'menu'
  | 'auto'
  | 'tasks'
  | 'products'
  | 'equipment'
  | 'documents';

const EMPTY_FORM: FormValues = {
  eventName: '',
  eventDate: '',
  setupTime: '10:00',
  serviceStartTime: '11:00',
  serviceEndTime: '13:00',
  address: '',
  guestCount: '',
  notes: '',
  status: 'planning',
};

const CLOSED_SECTIONS: Record<SectionKey, boolean> = {
  menu: true,
  auto: false,
  tasks: false,
  products: false,
  equipment: false,
  documents: false,
};

function eventToForm(event: CateringEvent): FormValues {
  return {
    eventName: event.eventName,
    eventDate: event.eventDate,
    setupTime: event.setupTime,
    serviceStartTime: event.serviceStartTime,
    serviceEndTime: event.serviceEndTime,
    address: event.address,
    guestCount: String(event.guestCount),
    notes: event.notes ?? '',
    status: event.status,
  };
}

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.eventName.trim()) {
    errors.eventName = 'Event name is required.';
  }
  if (!values.eventDate.trim()) {
    errors.eventDate = 'Event date is required.';
  }
  if (!values.setupTime.trim()) {
    errors.setupTime = 'Setup time is required.';
  }
  if (!values.serviceStartTime.trim()) {
    errors.serviceStartTime = 'Service start is required.';
  }
  if (!values.serviceEndTime.trim()) {
    errors.serviceEndTime = 'Service end is required.';
  }
  if (!values.address.trim()) {
    errors.address = 'Address is required.';
  }

  const guestRaw = values.guestCount.trim();
  if (!guestRaw) {
    errors.guestCount = 'Guest count is required.';
  } else {
    const guestCount = Number(guestRaw);
    if (!Number.isInteger(guestCount) || guestCount <= 0) {
      errors.guestCount = 'Guest count must be a whole number greater than zero.';
    }
  }

  if (
    values.serviceStartTime.trim() &&
    values.serviceEndTime.trim() &&
    !isValidServiceWindow(values.serviceStartTime, values.serviceEndTime)
  ) {
    errors.serviceEndTime =
      'Service end must be later than service start, unless the event crosses midnight (PM to AM).';
  }

  return errors;
}

function sanitizeMenuOrder(menuOrder: CateringMenuOrder): CateringMenuOrder {
  return {
    cheeseburger: Math.max(0, Math.trunc(menuOrder.cheeseburger) || 0),
    doubleCheeseburger: Math.max(0, Math.trunc(menuOrder.doubleCheeseburger) || 0),
    veggieBurger: Math.max(0, Math.trunc(menuOrder.veggieBurger) || 0),
    fries: Math.max(0, Math.trunc(menuOrder.fries) || 0),
    openItems: menuOrder.openItems
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        quantity: Math.max(0, Math.trunc(item.quantity) || 0),
        ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
      }))
      .filter((item) => item.name.length > 0),
  };
}

function sanitizeSupplies(items: SupplyItem[]): SupplyItem[] {
  return items
    .map((item) => {
      const name = item.name.trim();
      if (!name) {
        return null;
      }
      const next: SupplyItem = {
        id: item.id,
        name,
        quantity: Math.max(0, Math.trunc(item.quantity) || 0),
      };
      if (item.unit?.trim()) {
        next.unit = item.unit.trim();
      }
      if (item.notes?.trim()) {
        next.notes = item.notes.trim();
      }
      if (item.isCustom) {
        next.isCustom = true;
      }
      if (item.isAuto) {
        next.isAuto = true;
      }
      return next;
    })
    .filter((item): item is SupplyItem => item !== null);
}

function sanitizeTasks(tasks: PreparationTask[]): PreparationTask[] {
  return tasks
    .map((task) => {
      const name = task.name.trim();
      if (!name) {
        return null;
      }
      const next: PreparationTask = {
        id: task.id,
        name,
        completed: task.completed,
        source: task.source,
      };
      if (task.notes?.trim()) {
        next.notes = task.notes.trim();
      }
      return next;
    })
    .filter((task): task is PreparationTask => task !== null);
}

function sanitizeDocuments(documents: DocumentTask[]): DocumentTask[] {
  return documents
    .map((item) => {
      const name = item.name.trim();
      if (!name) {
        return null;
      }
      const next: DocumentTask = {
        id: item.id,
        name,
        completed: item.completed,
      };
      if (item.notes?.trim()) {
        next.notes = item.notes.trim();
      }
      return next;
    })
    .filter((item): item is DocumentTask => item !== null);
}

export function AddCateringModal({
  open,
  mode,
  event = null,
  onClose,
  onSave,
  onDelete,
}: CateringFormModalProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [menuOrder, setMenuOrder] = useState<CateringMenuOrder>(createEmptyMenuOrder());
  const [products, setProducts] = useState<SupplyItem[]>([]);
  const [equipment, setEquipment] = useState<SupplyItem[]>([]);
  const [preparationTasks, setPreparationTasks] = useState<PreparationTask[]>([]);
  const [documents, setDocuments] = useState<DocumentTask[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openSections, setOpenSections] =
    useState<Record<SectionKey, boolean>>(CLOSED_SECTIONS);
  const [editingId, setEditingId] = useState<string | null>(null);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmployees(
      loadEmployees(event?.assignedEmployees ? [...event.assignedEmployees] : []),
    );

    if (mode === 'edit' && event) {
      setValues(eventToForm(event));
      setMenuOrder(structuredClone(event.menuOrder));
      setProducts(structuredClone(event.products));
      setEquipment(applyAutoEquipmentQuantities(structuredClone(event.equipment)));
      setPreparationTasks(structuredClone(event.preparationTasks));
      setDocuments(structuredClone(event.documents));
      setSelectedEmployees([...event.assignedEmployees]);
      setEditingId(event.id);
    } else {
      const emptyMenu = createEmptyMenuOrder();
      setValues(EMPTY_FORM);
      setMenuOrder(emptyMenu);
      setProducts(createStandardProducts());
      setEquipment(createStandardEquipment());
      setPreparationTasks([]);
      setDocuments([]);
      setSelectedEmployees([]);
      setEditingId(null);
    }

    setErrors({});
    setOpenSections(CLOSED_SECTIONS);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === 'Escape') {
        onCloseRef.current();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, mode, event]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleEquipmentChange(next: SupplyItem[]) {
    setEquipment(applyAutoEquipmentQuantities(next));
  }

  function toggleSection(key: SectionKey) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const notes = values.notes.trim();
    const cateringEvent: CateringEvent = {
      id: mode === 'edit' && editingId ? editingId : createCateringEventId(),
      eventName: values.eventName.trim(),
      eventDate: values.eventDate,
      setupTime: values.setupTime,
      serviceStartTime: values.serviceStartTime,
      serviceEndTime: values.serviceEndTime,
      address: values.address.trim(),
      guestCount: Number.parseInt(values.guestCount.trim(), 10),
      status: mode === 'create' ? 'planning' : values.status,
      assignedEmployees: selectedEmployees,
      menuOrder: sanitizeMenuOrder(menuOrder),
      products: sanitizeSupplies(products),
      equipment: applyAutoEquipmentQuantities(sanitizeSupplies(equipment)),
      preparationTasks: sanitizeTasks(preparationTasks),
      documents: sanitizeDocuments(documents),
    };

    if (notes) {
      cateringEvent.notes = notes;
    }

    onSave(cateringEvent);
    onClose();
  }

  function handleDelete() {
    if (
      !editingId ||
      !window.confirm(`Delete catering "${values.eventName}"? This cannot be undone.`)
    ) {
      return;
    }
    onDelete(editingId);
    onClose();
  }

  return (
    <div className="ops-modal" role="presentation">
      <div className="ops-modal__backdrop" aria-hidden="true" />
      <div
        className="ops-modal__dialog ops-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ops-modal__header">
          <h2 id={titleId} className="ops-modal__title">
            {mode === 'edit' ? 'Edit Catering' : 'Add Catering'}
          </h2>
          <button
            type="button"
            className="ops-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="ops-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="ops-modal__body">
            <div className="ops-form-grid">
              <div className="ops-field ops-field--full">
                <label htmlFor="form-event-name">Event Name</label>
                <input
                  ref={firstFieldRef}
                  id="form-event-name"
                  type="text"
                  value={values.eventName}
                  onChange={(event) => updateField('eventName', event.target.value)}
                  aria-invalid={Boolean(errors.eventName)}
                />
                {errors.eventName ? (
                  <p className="ops-field__error">{errors.eventName}</p>
                ) : null}
              </div>

              <div className="ops-field">
                <label htmlFor="form-event-date">Event Date</label>
                <input
                  id="form-event-date"
                  type="date"
                  value={values.eventDate}
                  onChange={(event) => updateField('eventDate', event.target.value)}
                  aria-invalid={Boolean(errors.eventDate)}
                />
                {errors.eventDate ? (
                  <p className="ops-field__error">{errors.eventDate}</p>
                ) : null}
              </div>

              <div className="ops-field">
                <label htmlFor="form-guest-count">Guest Count</label>
                <input
                  id="form-guest-count"
                  type="number"
                  min={1}
                  step={1}
                  value={values.guestCount}
                  onChange={(event) => updateField('guestCount', event.target.value)}
                  aria-invalid={Boolean(errors.guestCount)}
                />
                {errors.guestCount ? (
                  <p className="ops-field__error">{errors.guestCount}</p>
                ) : null}
              </div>

              <div className="ops-field">
                <label htmlFor="form-setup-time">Setup Time</label>
                <CateringTimeInput
                  id="form-setup-time"
                  value={values.setupTime}
                  onChange={(value) => updateField('setupTime', value)}
                  aria-invalid={Boolean(errors.setupTime)}
                />
                {errors.setupTime ? (
                  <p className="ops-field__error">{errors.setupTime}</p>
                ) : null}
              </div>

              <div className="ops-field">
                <label htmlFor="form-service-start">Service Start</label>
                <CateringTimeInput
                  id="form-service-start"
                  value={values.serviceStartTime}
                  onChange={(value) => updateField('serviceStartTime', value)}
                  aria-invalid={Boolean(errors.serviceStartTime)}
                />
                {errors.serviceStartTime ? (
                  <p className="ops-field__error">{errors.serviceStartTime}</p>
                ) : null}
              </div>

              <div className="ops-field">
                <label htmlFor="form-service-end">Service End</label>
                <CateringTimeInput
                  id="form-service-end"
                  value={values.serviceEndTime}
                  onChange={(value) => updateField('serviceEndTime', value)}
                  aria-invalid={Boolean(errors.serviceEndTime)}
                />
                {errors.serviceEndTime ? (
                  <p className="ops-field__error">{errors.serviceEndTime}</p>
                ) : null}
              </div>

              <div className="ops-field ops-field--full">
                <label htmlFor="form-address">Address</label>
                <input
                  id="form-address"
                  type="text"
                  value={values.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  aria-invalid={Boolean(errors.address)}
                />
                {errors.address ? (
                  <p className="ops-field__error">{errors.address}</p>
                ) : null}
              </div>

              {mode === 'edit' ? (
                <div className="ops-field">
                  <label htmlFor="form-status">Status</label>
                  <select
                    id="form-status"
                    value={values.status}
                    onChange={(event) =>
                      updateField('status', event.target.value as CateringEventStatus)
                    }
                  >
                    <option value="planning">Planning</option>
                    <option value="in-progress">In Progress</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              ) : null}

              <div className="ops-field ops-field--full">
                <EmployeeSelector
                  employees={employees}
                  selectedNames={selectedEmployees}
                  onEmployeesChange={setEmployees}
                  onSelectedNamesChange={setSelectedEmployees}
                />
              </div>

              <div className="ops-field ops-field--full">
                <label htmlFor="form-notes">Notes</label>
                <textarea
                  id="form-notes"
                  rows={4}
                  value={values.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Parking, loading, venue restrictions, special requests…"
                />
              </div>
            </div>

            <CollapsibleFormSection
              title="Menu Order"
              open={openSections.menu}
              onToggle={() => toggleSection('menu')}
            >
              <MenuOrderSection value={menuOrder} onChange={setMenuOrder} />
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Purchasing & Preparation"
              open={openSections.auto}
              onToggle={() => toggleSection('auto')}
            >
              <AutomaticRequirements menuOrder={menuOrder} />
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Preparation Tasks"
              open={openSections.tasks}
              onToggle={() => toggleSection('tasks')}
            >
              <PreparationTasksEditor
                tasks={preparationTasks}
                onChange={setPreparationTasks}
              />
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Products & Food Items"
              open={openSections.products}
              onToggle={() => toggleSection('products')}
            >
              <SupplyEditor
                kind="products"
                items={products}
                onChange={setProducts}
                addButtonLabel="Add Product"
              />
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Equipment & Supplies"
              open={openSections.equipment}
              onToggle={() => toggleSection('equipment')}
            >
              <SupplyEditor
                kind="equipment"
                items={equipment}
                onChange={handleEquipmentChange}
                addButtonLabel="Add Equipment"
              />
            </CollapsibleFormSection>

            <CollapsibleFormSection
              title="Documents"
              open={openSections.documents}
              onToggle={() => toggleSection('documents')}
            >
              <DocumentsEditor documents={documents} onChange={setDocuments} />
            </CollapsibleFormSection>
          </div>

          <div className="ops-modal__footer">
            <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                className="ops-btn ops-btn--danger ops-modal__delete"
                onClick={handleDelete}
              >
                Delete Catering
              </button>
            ) : null}
            <button type="submit" className="ops-btn ops-btn--primary">
              {mode === 'edit' ? 'Save Changes' : 'Save Catering'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
