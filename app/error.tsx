"use client";

import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { MessagePage } from "@/components/ui/MessagePage";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

interface TErrorPageProps {
  // Never shown: an error from the server arrives with a generic text anyway, and nothing from it is safe to show (it stays in the vault).
  error: unknown;
  // Knocks on the server's door again for the page that failed, and shows it if somebody answers this time.
  retry: () => void;
}

// Something broke and nobody saw it coming (database down, a bug, a very small gremlin). It might fix itself, so there is a
// retry button, and an emergency escape hatch back to the dashboard.
export default function ErrorPage({ retry }: TErrorPageProps) {
  return (
    <MessagePage title="משהו השתבש" description={ERROR_MESSAGES.internal}>
      <Button onClick={() => retry()}>ניסיון נוסף</Button>
      <LinkButton href={DASHBOARD_PAGE}>חזרה ללוח הבקרה</LinkButton>
    </MessagePage>
  );
}
