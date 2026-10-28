"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { MAX_SEARCH_LENGTH, SEARCH_PARAM } from "@/constants/list.constant";
import { useListFilters } from "@/hooks/useListFilters";
import type { TListFilter, TListFilterOption } from "@/types/list.type";

interface IListFiltersProps {
  basePath: string;
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
  filters: TListFilter[];
}

type TFilterSelectProps = {
  filter: TListFilter;
  // What the select shows: it can run ahead of filter.value while the new address is still loading (eager beaver).
  value: string;
  onChange: (name: string, value: string) => void;
  isFullRowOnPhone: boolean;
};

const SELECT_CLASSES =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function ListFilters({
  basePath,
  search,
  searchLabel,
  searchPlaceholder,
  filters,
}: IListFiltersProps) {
  const {
    text,
    values,
    canClear,
    changeSearch,
    changeFilter,
    clear,
    searchNow,
    flushSearch,
  } = useListFilters({
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
      // Phone: the search takes the whole first row and the selects share the next one. From sm up: one wrapping row.
      className="mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end"
    >
      <div className="col-span-2 sm:min-w-48 sm:flex-1">
        <FormField
          label={searchLabel}
          name={SEARCH_PARAM}
          type="search"
          autoComplete="off"
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={searchPlaceholder}
          value={text}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            changeSearch(event.target.value)
          }
          onBlur={flushSearch}
        />
      </div>
      {filters.map((filter: TListFilter, index: number) => (
        <FilterSelect
          key={filter.name}
          filter={filter}
          value={values[filter.name]}
          onChange={changeFilter}
          // An odd last select (a lone one) would leave half a row empty on a phone, so it takes the whole row.
          isFullRowOnPhone={index === filters.length - 1 && filters.length % 2 === 1}
        />
      ))}
      {canClear && (
        <Button variant="secondary" onClick={clear} className="col-span-2 py-2.5 sm:col-span-1">
          ניקוי
        </Button>
      )}
    </form>
  );
}

// The label is linked by id, not wrapped around the select: a wrapping label would also carry the text of every option.
const FilterSelect = ({ filter, value, onChange, isFullRowOnPhone }: TFilterSelectProps) => {
  const id: string = useId();

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 sm:min-w-40 ${isFullRowOnPhone ? "col-span-2 sm:col-span-1" : ""}`}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {filter.label}
      </label>
      <select
        id={id}
        name={filter.name}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(filter.name, event.target.value)
        }
        className={`${SELECT_CLASSES} w-full min-w-0`}
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
