import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function EnrollScreen({ enrollmentToken, startEnrollment, confirmEnrollment, error, onBackToLogin }) {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      const result = await startEnrollment(enrollmentToken);
      if (active) {
        setEnrollment(result.data || null);
        setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [enrollmentToken, startEnrollment]);

  const submit = async () => {
    setLocalError("");
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    const result = await confirmEnrollment(enrollmentToken, password, code);
    if (result.ok) {
      setRecoveryCodes(Array.isArray(result.data?.recovery_codes) ? result.data.recovery_codes : []);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Mystery Shopper Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Preparing your enrollment...</p> : null}
          {!loading && enrollment ? (
            <>
              <div className="rounded-md border p-3 text-sm">
                <p><strong>Email:</strong> {enrollment.email}</p>
                <p><strong>Name:</strong> {enrollment.full_name}</p>
                <p><strong>Authenticator manual key:</strong> <span className="break-all">{enrollment.manual_key}</span></p>
                <p className="mt-2 text-xs text-muted-foreground">Add this account to your authenticator app using the manual key or OTP URI below.</p>
                <p className="mt-2 break-all text-xs text-muted-foreground">{enrollment.otpauth_uri}</p>
              </div>
              {recoveryCodes.length === 0 ? (
                <>
                  <Input type="password" placeholder="Set password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  <Input type="text" placeholder="6-digit authenticator code" value={code} onChange={(event) => setCode(event.target.value)} />
                  <Button type="button" className="w-full" onClick={submit}>Finish enrollment</Button>
                </>
              ) : (
                <div className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-semibold">Enrollment complete</p>
                  <p>Store these recovery codes safely. They will only be shown once.</p>
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {recoveryCodes.map((item) => <li key={item} className="rounded bg-white px-2 py-1 font-mono">{item}</li>)}
                  </ul>
                  <Button type="button" onClick={onBackToLogin}>Continue to sign in</Button>
                </div>
              )}
            </>
          ) : null}
          {(localError || error) ? <p className="text-sm text-red-600">{localError || error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
