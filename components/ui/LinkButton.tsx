import Link from "next/link";
import {
  getButtonClasses,
  type TButtonSize,
  type TButtonVariant,
} from "@/helpers/buttonStyles";

interface TLinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: TButtonVariant;
  size?: TButtonSize;
}

export const LinkButton = ({
  variant = "secondary",
  size = "md",
  className = "",
  ...linkProps
}: TLinkButtonProps) => {
  return (
    <Link
      className={getButtonClasses(variant, size, className)}
      {...linkProps}
    />
  );
};
