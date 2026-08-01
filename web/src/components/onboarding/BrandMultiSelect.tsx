import type { ServiceId } from '@shared/types';
import type { ServiceCatalogEntry } from '../../lib/serviceCatalog';
import { ServiceCombobox } from './ServiceCombobox';

export type BrandMultiSelectProps = {
  label: string;
  hint?: string;
  services: ServiceCatalogEntry[];
  selected: ServiceId[];
  onToggle: (id: ServiceId) => void;
  testId: string;
};

/** Searchable multi-select for work platforms (same UX as service categories). */
export function BrandMultiSelect({
  label,
  hint,
  services,
  selected,
  onToggle,
  testId,
}: BrandMultiSelectProps) {
  return (
    <div data-testid={testId}>
      <ServiceCombobox
        label={label}
        hint={hint}
        services={services}
        selected={selected}
        onToggle={onToggle}
        searchTestId={`${testId}-search`}
        optionTestIdPrefix="brand"
        placeholder="Search work platforms…"
      />
    </div>
  );
}
