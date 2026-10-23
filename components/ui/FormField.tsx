type TFormFieldProps = {
  label: string;
  name: string;
  errors?: string[];
} & React.ComponentProps<"input">;

export const FormField = ({ label, name, errors, ...inputProps }: TFormFieldProps) => {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        aria-invalid={errors ? true : undefined}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        {...inputProps}
      />
      {errors?.map((message: string) => (
        <span key={message} className="text-xs font-normal text-red-600">
          {message}
        </span>
      ))}
    </label>
  );
};
