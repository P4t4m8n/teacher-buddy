export type TListFilterOption = {
  value: string;
  label: string;
};

// A select that narrows or orders a list. Its value lives in the address, under `name`.
export type TListFilter = {
  name: string;
  label: string;
  // The value in the address now (already checked by the server).
  value: string;
  // The value that is not written in the address, so the address stays short.
  defaultValue: string;
  options: TListFilterOption[];
  // The option with the empty value, such as "all the classes". Without it the select has only `options`.
  emptyLabel?: string;
};
