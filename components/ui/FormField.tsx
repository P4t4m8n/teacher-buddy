type TFormFieldProps = {
  label: string;
  name: string;
  errors?: string[];
} & React.ComponentProps<"input">;

export const FormField = ({ label, name, errors, ...inputProps }: TFormFieldProps) => {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <input
        name={name}
        aria-invalid={errors ? true : undefined}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        {...inputProps}
      />
      {errors?.map((message: string) => (
        <span key={message} className="text-xs font-normal text-red-600 dark:text-red-400">
          {message}
        </span>
      ))}
    </label>
  );
};
