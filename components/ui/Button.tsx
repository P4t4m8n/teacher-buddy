type TButtonVariant = "primary" | "secondary";

type TButtonProps = {
  variant?: TButtonVariant;
} & React.ComponentProps<"button">;

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_CLASSES: Record<TButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
};

export const Button = ({
  variant = "primary",
  type = "button",
  className = "",
  ...buttonProps
}: TButtonProps) => {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
      {...buttonProps}
    />
  );
};
