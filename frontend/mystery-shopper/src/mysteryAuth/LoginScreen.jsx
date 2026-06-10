import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function LoginScreen({ login, submitMfa, loading, error, mfaPending, onShowRecovery }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Mystery Shopper Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!mfaPending ? (
            <>
              <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <Button type="button" className="w-full" onClick={() => login(email, password)} disabled={loading}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Input type="text" placeholder="6-digit authenticator code" value={code} onChange={(event) => setCode(event.target.value)} />
              <Button type="button" className="w-full" onClick={() => submitMfa(code)} disabled={loading}>
                Verify code
              </Button>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            {!mfaPending
              ? "Sign in with your registered email and password. You will then be asked for a 6-digit code from your authenticator app."
              : "Open your authenticator app and enter the current 6-digit code for CWSCX Mystery Shopper."}
          </p>
          {!mfaPending ? <Button type="button" variant="ghost" className="w-full" onClick={onShowRecovery}>Use a recovery code instead</Button> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
