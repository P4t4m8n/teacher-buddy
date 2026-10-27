import { BackLink } from "@/components/ui/BackLink";

type TFormPageProps = {
  title: string;
  // The link above the form, back to the list the user came from (the breadcrumb trail home).
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
};

// The frame of the add and edit pages: a back link, the title and the form in a card, like a picture frame for paperwork.
export default function FormPage({ title, backHref, backLabel, children }: TFormPageProps) {
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <section className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </section>
    </div>
  );
}
