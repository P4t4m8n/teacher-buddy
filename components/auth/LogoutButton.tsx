"use client";

import { Button } from "@/components/ui/Button";
import { useSignOut } from "@/hooks/useSignOut";

export const LogoutButton = () => {
  const { isPending, errorMessage, handleSignOut } = useSignOut();

  return (
    <div className="flex items-center gap-3">
      {errorMessage && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </span>
      )}
      <Button variant="secondary" disabled={isPending} onClick={handleSignOut}>
        התנתקות
      </Button>
    </div>
  );
};
