import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function RecoveryScreen({ useRecoveryCode, error, onRecovered, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  const submit = async () => {
    const result = await useRecoveryCode(email, recoveryCode);
    if (result.ok) {
      onRecovered(result.data);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Recover Mystery Shopper Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="text" placeholder="Recovery code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
          <Button type="button" className="w-full" onClick={submit}>Use recovery code</Button>
          <Button type="button" variant="outline" className="w-full" onClick={onBackToLogin}>Back to login</Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
