import Link from "next/link";
import {
  getButtonClasses,
  type TButtonSize,
  type TButtonVariant,
} from "@/helpers/buttonStyles";

type TLinkButtonProps = {
  variant?: TButtonVariant;
  size?: TButtonSize;
} & React.ComponentProps<typeof Link>;

export const LinkButton = ({
  variant = "secondary",
  size = "md",
  className = "",
  ...linkProps
}: TLinkButtonProps) => {
  return <Link className={getButtonClasses(variant, size, className)} {...linkProps} />;
};
