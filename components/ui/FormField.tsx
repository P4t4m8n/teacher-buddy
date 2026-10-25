import { useId } from "react";

type TFormFieldProps = {
  label: string;
  name: string;
  errors?: string[];
  // A line of help under the field, like why it is disabled.
  hint?: string;
} & React.ComponentProps<"input">;

export const FormField = ({ label, name, errors, hint, ...inputProps }: TFormFieldProps) => {
  const hintId: string = useId();

  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <input
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
        {...inputProps}
      />
      {hint && (
        <span id={hintId} className="text-xs font-normal text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
      {errors?.map((message: string) => (
        <span key={message} className="text-xs font-normal text-red-600 dark:text-red-400">
          {message}
        </span>
      ))}
    </label>
  );
};
