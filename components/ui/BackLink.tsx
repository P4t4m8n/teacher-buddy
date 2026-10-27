import Link from "next/link";

interface IBackLinkProps {
  href: string;
  children: React.ReactNode;
}

export const BackLink = ({ href, children }: IBackLinkProps) => {
  return (
    <Link
      href={href}
      className="w-fit text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
    >
      {children}
    </Link>
  );
};
