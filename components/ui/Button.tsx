import {
  getButtonClasses,
  type TButtonSize,
  type TButtonVariant,
} from "@/components/ui/buttonStyles";

type TButtonProps = {
  variant?: TButtonVariant;
  size?: TButtonSize;
} & React.ComponentProps<"button">;

export const Button = ({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...buttonProps
}: TButtonProps) => {
  return (
    <button
      type={type}
      className={getButtonClasses(variant, size, className)}
      {...buttonProps}
    />
  );
};
