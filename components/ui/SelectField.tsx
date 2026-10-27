type TSelectOption = {
  value: string;
  label: string;
};

interface ISelectFieldProps extends Omit<
  React.ComponentProps<"select">,
  "children"
> {
  label: string;
  name: string;
  options: TSelectOption[];
  // The first option, with an empty value, shown until the user makes up their mind.
  placeholder: string;
  errors?: string[];
}

export const SelectField = ({
  label,
  name,
  options,
  placeholder,
  errors,
  ...selectProps
}: ISelectFieldProps) => {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <select
        name={name}
        defaultValue=""
        aria-invalid={errors ? true : undefined}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        {...selectProps}
      >
        <option value="">{placeholder}</option>
        {options.map((option: TSelectOption) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors?.map((message: string) => (
        <span
          key={message}
          className="text-xs font-normal text-red-600 dark:text-red-400"
        >
          {message}
        </span>
      ))}
    </label>
  );
};
