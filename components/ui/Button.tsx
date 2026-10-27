import {
  getButtonClasses,
  type TButtonSize,
  type TButtonVariant,
} from "@/helpers/buttonStyles";

interface IButtonProps extends React.ComponentProps<"button"> {
  variant?: TButtonVariant;
  size?: TButtonSize;
}

export const Button = ({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...buttonProps
}: IButtonProps) => {
  return (
    <button
      type={type}
      className={getButtonClasses(variant, size, className)}
      {...buttonProps}
    />
  );
};
