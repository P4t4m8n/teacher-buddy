type TMessagePageProps = {
  title: string;
  description?: string;
  // The actions under the text: links and buttons.
  children?: React.ReactNode;
};

// A whole-page message: the page was not found, or something went wrong. It has no hooks, so the pages that
// are server components (not-found) and the ones that are client components (the error boundaries) both use it.
export const MessagePage = ({ title, description, children }: TMessagePageProps) => {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-slate-600 dark:text-slate-300">{description}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </main>
  );
};
