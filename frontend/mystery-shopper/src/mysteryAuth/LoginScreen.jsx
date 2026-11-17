import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import AuthShell, { Field, InlineAlert, PasswordInput } from "./AuthShell";

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

  const spinner = <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;

  return (
    <AuthShell
      title={!mfaPending ? "Sign in" : "Enter your 6-digit code"}
      description={
        !mfaPending
          ? "Sign in with your registered email and password. You will then be asked for a 6-digit code from your authenticator app. You must be connected to the CWS VPN."
          : "Open your authenticator app and enter the current 6-digit code for CWSCX Mystery Shopper. Codes change every 30 seconds — if one is about to change, wait for the next."
      }
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          {!mfaPending ? (
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitLogin();
              }}
            >
              <Field id="login-email" label="Email">
                <Input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field id="login-password" label="Password">
                <PasswordInput id="login-password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
              <InlineAlert>{localError || error}</InlineAlert>
              <Button type="submit" className="min-h-11 w-full gap-2" disabled={loading}>
                {loading ? spinner : null}
                {loading ? "Please wait..." : "Continue"}
              </Button>
              <div className="space-y-1 border-t pt-4 text-center">
                <Button type="button" variant="ghost" className="w-full" onClick={onShowRecovery}>Use a recovery code instead</Button>
                <p className="text-xs text-muted-foreground">
                  Lost your authenticator app or password? Use a recovery code. Haven&apos;t enrolled yet? Open the enrollment link from your invitation email.
                </p>
              </div>
            </form>
          ) : (
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitCode();
              }}
            >
              <Field id="login-code" label="6-digit authenticator code">
                <Input
                  id="login-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  placeholder="000 000"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="h-12 text-center font-mono text-xl tracking-[0.25em] tabular-nums"
                />
              </Field>
              <InlineAlert>{localError || error}</InlineAlert>
              <Button type="submit" className="min-h-11 w-full gap-2" disabled={loading}>
                {loading ? spinner : null}
                {loading ? "Verifying..." : "Verify code"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setCode(""); setLocalError(""); cancelMfa(); }}>
                Back to email and password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
