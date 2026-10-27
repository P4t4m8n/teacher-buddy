import { LinkButton } from "@/components/ui/LinkButton";
import { MessagePage } from "@/components/ui/MessagePage";
import { DASHBOARD_PAGE } from "@/constants/auth.constant";

// Shown for an address that went on holiday and left no forwarding note, and for a notFound() that no nearer not-found page handles.
// A teacher who is not signed in never gets here: the proxy bounces them to the sign-in page like a very polite doorman.
export default function NotFound() {
  return (
    <MessagePage title="העמוד לא נמצא" description="הכתובת שהזנתם אינה קיימת, או שהעמוד הוסר.">
      <LinkButton href={DASHBOARD_PAGE} variant="primary">
        חזרה ללוח הבקרה
      </LinkButton>
    </MessagePage>
  );
}
