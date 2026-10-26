"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { MAX_SEARCH_LENGTH, SEARCH_PARAM } from "@/constants/list.constant";
import { useListFilters } from "@/hooks/useListFilters";
import type { TListFilter, TListFilterOption } from "@/types/list.type";

type TListFiltersProps = {
  basePath: string;
  // The search in the address now (already checked by the server).
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
  filters: TListFilter[];
};

type TFilterSelectProps = {
  filter: TListFilter;
  // What the select shows: it can be ahead of filter.value while the new address is loading.
  value: string;
  onChange: (name: string, value: string) => void;
};

const SELECT_CLASSES =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function ListFilters({ basePath, search, searchLabel, searchPlaceholder, filters }: TListFiltersProps) {
  const { text, values, canClear, changeSearch, changeFilter, clear, searchNow, flushSearch } = useListFilters({
    basePath,
    search,
    filters,
  });

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    searchNow();
  };

  return (
    <form
      role="search"
      aria-label="סינון ומיון"
      onSubmit={handleSubmit}
      className="mb-4 flex shrink-0 flex-wrap items-end gap-3"
    >
      <div className="min-w-48 flex-1">
        <FormField
          label={searchLabel}
          name={SEARCH_PARAM}
          type="search"
          autoComplete="off"
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={searchPlaceholder}
          value={text}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => changeSearch(event.target.value)}
          onBlur={flushSearch}
        />
      </div>
      {filters.map((filter: TListFilter) => (
        <FilterSelect key={filter.name} filter={filter} value={values[filter.name]} onChange={changeFilter} />
      ))}
      {canClear && (
        <Button variant="secondary" onClick={clear} className="py-2.5">
          ניקוי
        </Button>
      )}
    </form>
  );
}

// The label is linked by id, not wrapped around the select: a wrapping label would also carry the text of every option.
const FilterSelect = ({ filter, value, onChange }: TFilterSelectProps) => {
  const id: string = useId();

  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {filter.label}
      </label>
      <select
        id={id}
        name={filter.name}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(filter.name, event.target.value)}
        className={SELECT_CLASSES}
      >
        {filter.emptyLabel && <option value="">{filter.emptyLabel}</option>}
        {filter.options.map((option: TListFilterOption) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
