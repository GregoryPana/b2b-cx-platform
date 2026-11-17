import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import AuthShell, { Field, InlineAlert } from "./AuthShell";

export default function RecoveryScreen({ useRecoveryCode, error, onRecovered, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  const [localError, setLocalError] = useState("");

  const submit = async () => {
    setLocalError("");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setLocalError("Enter the email address your account was created with.");
      return;
    }
    if (!recoveryCode.trim()) {
      setLocalError("Enter one of the recovery codes you saved when you enrolled.");
      return;
    }
    const result = await useRecoveryCode(email.trim(), recoveryCode.trim());
    if (result.ok) {
      onRecovered(result.data);
    }
  };

  return (
    <AuthShell
      title="Recover your access"
      description="Use this if you forgot your password or lost your authenticator app. Each recovery code works once, and you will then set a new password and link your authenticator app again."
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field id="recovery-email" label="Email">
              <Input id="recovery-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field id="recovery-code" label="Recovery code">
              <Input id="recovery-code" type="text" autoComplete="off" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} className="font-mono" />
            </Field>
            <InlineAlert>{localError || error}</InlineAlert>
            <Button type="submit" className="min-h-11 w-full">Use recovery code</Button>
            <Button type="button" variant="outline" className="w-full" onClick={onBackToLogin}>Back to sign in</Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
