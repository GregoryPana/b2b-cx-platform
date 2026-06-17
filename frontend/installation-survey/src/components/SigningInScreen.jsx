import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";

const HELP_DELAY_MS = 6000;

export default function SigningInScreen() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHelp(true), HELP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 text-center">
        <Card className="p-6">
          <CardContent className="pt-6">Signing you in...</CardContent>
        </Card>
        {showHelp ? (
          <Card className="text-left">
            <CardContent className="space-y-2 pt-6 text-sm">
              <p className="font-medium">Taking longer than usual?</p>
              <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Refresh the page (press the F5 key).</li>
                <li>
                  Still stuck? Hold <strong>Ctrl + Shift</strong> and press <strong>R</strong>{" "}
                  (on a Mac, hold <strong>Cmd + Shift</strong> and press <strong>R</strong>).
                </li>
                <li>Close any other tabs or windows of this site you have open, then try again.</li>
                <li>If that still doesn't work, open the link in a new private/incognito browser window.</li>
                <li>Still no luck? Contact IT support.</li>
              </ol>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
