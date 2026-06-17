import { useEffect, useState } from "react";

const HELP_DELAY_MS = 6000;

export default function SigningInScreen() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHelp(true), HELP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-muted-foreground">Signing you in...</p>
        {showHelp ? (
          <div className="mt-6 rounded-lg border bg-card p-4 text-left text-sm shadow-sm">
            <p className="font-medium text-foreground">Taking longer than usual?</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Refresh the page (press the F5 key).</li>
              <li>
                Still stuck? Hold <strong>Ctrl + Shift</strong> and press <strong>R</strong>{" "}
                (on a Mac, hold <strong>Cmd + Shift</strong> and press <strong>R</strong>).
              </li>
              <li>Close any other tabs or windows of this site you have open, then try again.</li>
              <li>If that still doesn't work, open the link in a new private/incognito browser window.</li>
              <li>Still no luck? Contact IT support.</li>
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
