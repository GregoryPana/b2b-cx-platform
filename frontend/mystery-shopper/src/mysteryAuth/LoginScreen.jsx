import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function LoginScreen({ login, submitMfa, cancelMfa, loading, error, mfaPending, onShowRecovery }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState("");

  const submitLogin = () => {
    setLocalError("");
    if (!email.trim()) {
      setLocalError("Please enter your email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setLocalError("That doesn't look like a valid email address. Check for typos, for example a missing @ or domain.");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }
    login(email.trim(), password);
  };

  const submitCode = async () => {
    setLocalError("");
    const cleanCode = code.replace(/\s+/g, "");
    if (!cleanCode) {
      setLocalError("Enter the 6-digit code currently shown in your authenticator app.");
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setLocalError("The code must be exactly 6 digits (numbers only), without spaces or letters.");
      return;
    }
    const result = await submitMfa(cleanCode);
    if (!result?.ok) setCode("");
  };

  const onKeyDown = (handler) => (event) => {
    if (event.key === "Enter") handler();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Mystery Shopper Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!mfaPending ? (
            <>
              <Input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={onKeyDown(submitLogin)} />
              <Input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={onKeyDown(submitLogin)} />
              <Button type="button" className="w-full" onClick={submitLogin} disabled={loading}>
                {loading ? "Please wait..." : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <Input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="6-digit authenticator code" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={onKeyDown(submitCode)} />
              <Button type="button" className="w-full" onClick={submitCode} disabled={loading}>
                {loading ? "Verifying..." : "Verify code"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setCode(""); setLocalError(""); cancelMfa(); }}>
                Back to email and password
              </Button>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            {!mfaPending
              ? "Sign in with your registered email and password. You will then be asked for a 6-digit code from your authenticator app. You must be connected to the company VPN."
              : "Open your authenticator app and enter the current 6-digit code for CWSCX Mystery Shopper. Codes change every 30 seconds — if one is about to change, wait for the next."}
          </p>
          {!mfaPending ? (
            <p className="text-xs text-muted-foreground">
              Lost your authenticator app or password? Use a recovery code below. Haven&apos;t enrolled yet? Open the enrollment link from your invitation email.
            </p>
          ) : null}
          {!mfaPending ? <Button type="button" variant="ghost" className="w-full" onClick={onShowRecovery}>Use a recovery code instead</Button> : null}
          {(localError || error) ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError || error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
