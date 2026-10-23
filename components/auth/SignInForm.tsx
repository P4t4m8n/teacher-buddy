"use client";

import { FormField } from "@/components/ui/FormField";
import { useSignIn } from "@/hooks/useSignIn";

export const SignInForm = () => {
  const { isPending, errorMessage, fieldErrors, handleSubmit } = useSignIn();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "מתחבר..." : "התחברות"}
      </button>
    </form>
  );
};
