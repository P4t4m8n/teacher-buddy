export type TListFilterOption = {
  value: string;
  label: string;
};

// A select that narrows or orders a list. Its value lives in the address, under `name`, like a lodger with a labelled door.
export type TListFilter = {
  name: string;
  label: string;
  // The value in the address right now (the server already gave it a stamp of approval).
  value: string;
  // The value that is not written in the address, so the address stays short and slim.
  defaultValue: string;
  options: TListFilterOption[];
  // The option with the empty value, such as "all the classes". Without it the select only has `options`, nothing extra.
  emptyLabel?: string;
};
