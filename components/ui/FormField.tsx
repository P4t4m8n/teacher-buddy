import { useId } from "react";

interface IFormFieldProps extends React.ComponentProps<"input"> {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
}

export const FormField = ({
  label,
  name,
  errors,
  hint,
  ...inputProps
}: IFormFieldProps) => {
  const hintId: string = useId();

  return (
    <label className="flex flex-col gap-1.5     text-sm font-medium text-body">
      {label}
      <input
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        className="rounded-control border border-line-strong bg-field px-field-x py-field-y text-base font-normal text-ink outline-none transition placeholder:text-faint focus:border-accent-ring focus:ring-4 focus:ring-accent-ring/20 aria-invalid:border-invalid aria-invalid:focus:ring-invalid/20 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text"
        {...inputProps}
      />
      {hint && (
        <span
          id={hintId}
          className="text-xs font-normal text-subtle"
        >
          {hint}
        </span>
      )}
      {errors?.map((message: string) => (
        <span
          key={message}
          className="text-xs font-normal text-danger-text"
        >
          {message}
        </span>
      ))}
    </label>
  );
};
