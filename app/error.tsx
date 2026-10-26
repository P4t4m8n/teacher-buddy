"use client";

import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { MessagePage } from "@/components/ui/MessagePage";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

type TErrorPageProps = {
  // Never shown: an error from the server arrives with a generic text anyway, and nothing from it is safe to show.
  error: unknown;
  // Asks the server again for the page that failed, and shows it if it works now.
  retry: () => void;
};

// The page for an error nobody expected (the database is down, a bug). The cause can be temporary, so it
// offers another try, and a way out to the dashboard.
export default function ErrorPage({ retry }: TErrorPageProps) {
  return (
    <MessagePage title="משהו השתבש" description={ERROR_MESSAGES.internal}>
      <Button onClick={() => retry()}>ניסיון נוסף</Button>
      <LinkButton href={DASHBOARD_PAGE}>חזרה ללוח הבקרה</LinkButton>
    </MessagePage>
  );
}
