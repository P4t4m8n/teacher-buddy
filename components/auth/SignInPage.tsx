import { SignInForm } from "@/components/auth/SignInForm";
import { BrandLogo } from "@/components/ui/BrandLogo";

export const SignInPage = () => {
  return (
    <main className="flex flex-1 items-center justify-center bg-linear-to-b from-indigo-50 via-slate-50 to-slate-50 p-6 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <h1 className="text-2xl font-bold tracking-tight">ברוכים הבאים</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">
            הזינו שם ותעודת זהות כדי להתחבר למערכת
          </p>
          <SignInForm />
        </div>
      </div>
    </main>
  );
};
