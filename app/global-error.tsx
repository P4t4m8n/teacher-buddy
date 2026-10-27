"use client";

import { Heebo } from "next/font/google";
import { Button } from "@/components/ui/Button";
import { MessagePage } from "@/components/ui/MessagePage";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

type TGlobalErrorProps = {
  error: unknown;
  retry: () => void;
};

// Only for an error in the root layout itself, which replaces the layout, so it brings its own html and body, like a snail with its own shell.
// The errors of the pages are handled by error.tsx, still wearing the layout as a cozy sweater.
export default function GlobalError({ retry }: TGlobalErrorProps) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <title>Teacher Buddy</title>
        <MessagePage title="משהו השתבש" description={ERROR_MESSAGES.internal}>
          <Button onClick={() => retry()}>ניסיון נוסף</Button>
        </MessagePage>
      </body>
    </html>
  );
}
