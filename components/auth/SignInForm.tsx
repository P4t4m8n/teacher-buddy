"use client";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { useSignIn } from "@/hooks/useSignIn";

export default function SignInForm() {
  const {
    isPending,
    errorMessage,
    fieldErrors,
    handleSubmit,
    handleDemoSignIn,
  } = useSignIn();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FormField
        label="שם"
        name="name"
        autoComplete="username"
        errors={fieldErrors.name}
      />
      <FormField
        label="תעודת זהות"
        name="idNumber"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        errors={fieldErrors.idNumber}
      />

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "מתחבר..." : "התחברות"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        או
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <Button
        variant="secondary"
        disabled={isPending}
        onClick={handleDemoSignIn}
        className="w-full"
      >
        כניסה עם מורה לדוגמה
      </Button>
    </form>
  );
}
