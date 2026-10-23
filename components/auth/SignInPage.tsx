import { SignInForm } from "@/components/auth/SignInForm";

export const SignInPage = () => {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">חבר מורה</h1>
        <p className="mb-6 text-sm text-slate-500">התחברות למורים</p>
        <SignInForm />
      </div>
    </main>
  );
};
