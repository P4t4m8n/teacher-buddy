"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS, SEARCH_PARAM } from "@/constants/list.constant";
import { buildListHref } from "@/helpers/list";
import type { TListFilter } from "@/types/list.type";

type TUseListFiltersOptions = {
  // The page the list is on: the filters are written in its address.
  basePath: string;
  // The search in the address now (already checked by the server).
  search: string;
  filters: TListFilter[];
};

// What the controls show: the search box and the value of each select (by the select's name).
type TDraft = {
  text: string;
  values: Record<string, string>;
};

const toDraft = (search: string, filters: TListFilter[]): TDraft => ({
  text: search,
  values: Object.fromEntries(filters.map((filter: TListFilter) => [filter.name, filter.value])),
});

const toDefaultDraft = (filters: TListFilter[]): TDraft => ({
  text: "",
  values: Object.fromEntries(filters.map((filter: TListFilter) => [filter.name, filter.defaultValue])),
});

const toKey = (draft: TDraft): string => JSON.stringify([draft.text.trim(), draft.values]);

// Any change of a filter or of the search shows the first page: the page is not in the new address.
const toHref = (basePath: string, draft: TDraft, filters: TListFilter[]): string => {
  const params: Record<string, string> = { [SEARCH_PARAM]: draft.text.trim() };
  for (const filter of filters) {
    const value: string = draft.values[filter.name];
    params[filter.name] = value === filter.defaultValue ? "" : value;
  }

  return buildListHref(basePath, params);
};
// The filters are in the address, so the server reads them and a link or a reload keeps them. A select changes
// the address at once, the search only after a pause in typing, so the list is not fetched on every key.
export const useListFilters = ({ basePath, search, filters }: TUseListFiltersOptions) => {
  const router = useRouter();
  const addressDraft: TDraft = toDraft(search, filters);
  const addressKey: string = toKey(addressDraft);

  const [draft, setDraft] = useState<TDraft>(addressDraft);
  // The last thing this component wrote in the address. When the address changes to something else (a link,
  // back, forward) the controls follow it. When it changes to what was just written they are left alone, so
  // what was typed or chosen while the page was loading is not lost.
  const [writtenKey, setWrittenKey] = useState<string>(addressKey);
  const [seenKey, setSeenKey] = useState<string>(addressKey);
  // The newest draft, for the timer: a timer that was set by an older render must not write older values.
  const latest = useRef<TDraft>(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (addressKey !== seenKey) {
    setSeenKey(addressKey);
    if (addressKey !== writtenKey) setDraft(addressDraft);
  }

  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next: TDraft): void => {
    latest.current = next;
    setDraft(next);
  };

  const write = (next: TDraft): void => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setWrittenKey(toKey(next));
    router.replace(toHref(basePath, next, filters), { scroll: false });
  };

  const changeSearch = (text: string): void => {
    update({ ...latest.current, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => write(latest.current), SEARCH_DEBOUNCE_MS);
  };

  const changeFilter = (name: string, value: string): void => {
    const next: TDraft = { ...latest.current, values: { ...latest.current.values, [name]: value } };
    update(next);
    write(next);
  };

  const clear = (): void => {
    const next: TDraft = toDefaultDraft(filters);
    update(next);
    write(next);
  };

  const searchNow = (): void => write(latest.current);

  // A search that is still waiting for the pause is applied when the box loses the focus. Without this, a click on a
  // link of the list right after typing would start its navigation, and the search would then replace it when the
  // pause ends. Applied first, the click's own navigation comes after it and wins.
  const flushSearch = (): void => {
    if (timer.current !== undefined) write(latest.current);
  };

  const canClear: boolean =
    draft.text.trim() !== "" || filters.some((filter: TListFilter) => draft.values[filter.name] !== filter.defaultValue);

  return { text: draft.text, values: draft.values, canClear, changeSearch, changeFilter, clear, searchNow, flushSearch };
};
