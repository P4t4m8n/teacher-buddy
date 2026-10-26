import { LinkButton } from "@/components/ui/LinkButton";
import { getButtonClasses } from "@/helpers/buttonStyles";
import { buildListHref } from "@/helpers/list";

type TPaginationProps = {
  basePath: string;
  // The filters of the list that are not the default: the pages keep them.
  params: Record<string, string>;
  page: number;
  pageCount: number;
};

type TPageLinkProps = {
  label: string;
  // Empty when there is no such page: the button is then shown but cannot be used.
  href: string | null;
  rel: "prev" | "next";
};

// Links, so a page has its own address that can be reloaded, shared and used with back and forward.
// Nothing is shown for a list that fits in one page.
export default function Pagination({ basePath, params, page, pageCount }: TPaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="דפדוף" className="mt-4 flex shrink-0 items-center justify-between gap-3">
      <PageLink
        label="הקודם"
        rel="prev"
        href={page > 1 ? buildListHref(basePath, params, page - 1) : null}
      />
      <p className="text-sm text-slate-600 dark:text-slate-300">
        עמוד {page} מתוך {pageCount}
      </p>
      <PageLink
        label="הבא"
        rel="next"
        href={page < pageCount ? buildListHref(basePath, params, page + 1) : null}
      />
    </nav>
  );
}

const PageLink = ({ label, href, rel }: TPageLinkProps) => {
  if (href === null) {
    return (
      <span aria-disabled="true" className={getButtonClasses("secondary", "sm", "pointer-events-none opacity-50")}>
        {label}
      </span>
    );
  }

  return (
    <LinkButton href={href} rel={rel} size="sm" scroll={false}>
      {label}
    </LinkButton>
  );
};
