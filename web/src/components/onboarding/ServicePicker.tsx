import type { ServiceCategory, ServiceId } from '@shared/types';
import { Chip, Field } from '../ui';
import { servicesByCategory } from '../../lib/serviceCatalog';
import { ServiceCombobox } from './ServiceCombobox';

export type ServicePickerProps = {
  categories?: ServiceCategory[];
  selected: ServiceId[];
  otherByCategory: Partial<Record<ServiceCategory, string>>;
  onToggle: (id: ServiceId) => void;
  onOtherChange: (category: ServiceCategory, value: string) => void;
  /** When true, identity services stay visible but non-toggleable. */
  showIdentityDisplayOnly?: boolean;
};

export function ServicePicker({
  categories,
  selected,
  otherByCategory,
  onToggle,
  onOtherChange,
  showIdentityDisplayOnly = true,
}: ServicePickerProps) {
  const groups = servicesByCategory(categories).filter((group) => {
    if (group.category === 'identity' && !showIdentityDisplayOnly) return false;
    return group.services.length > 0;
  });

  const selectable = groups.filter((g) => g.category !== 'identity');
  const identity = groups.find((g) => g.category === 'identity');

  return (
    <div className="space-y-3" data-testid="service-picker">
      <div className="grid gap-3 lg:grid-cols-2">
        {selectable.map((group) => (
          <section
            key={group.category}
            aria-labelledby={`svc-${group.category}`}
            className="rounded-lg border border-outline-variant/60 bg-surface/60 p-3"
          >
            <h2 id={`svc-${group.category}`} className="sr-only">
              {group.label}
            </h2>
            <ServiceCombobox
              label={group.label}
              hint="Search & add"
              services={group.services}
              selected={selected}
              onToggle={onToggle}
              searchTestId={`service-search-${group.category}`}
              optionTestIdPrefix="service"
              placeholder={`Search ${group.label.toLowerCase()}…`}
            />
          </section>
        ))}
      </div>

      {selectable.length > 0 && (
        <Field
          label="Other tools we missed"
          placeholder="Optional — comma-separated names"
          value={selectable.map((g) => otherByCategory[g.category]).find(Boolean) ?? ''}
          onChange={(e) => {
            const target = selectable[0]?.category ?? 'boards';
            onOtherChange(target, e.target.value);
          }}
        />
      )}

      {identity && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-on-surface">{identity.label}</p>
          <Chip tone="butter" selected={false} tabIndex={-1} className="pointer-events-none">
            Coming soon
          </Chip>
          {identity.services.map((service) => (
            <span
              key={service.id}
              className="inline-flex items-center gap-1 rounded-full border border-outline-variant/70 bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant"
            >
              <img
                src={service.logo}
                alt=""
                width={14}
                height={14}
                className="size-3.5 rounded-full object-contain bg-surface"
              />
              {service.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
