import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

function parseOtpauthParam(uri, name, fallback) {
  try {
    const query = (uri || "").split("?")[1] || "";
    return new URLSearchParams(query).get(name) || fallback;
  } catch {
    return fallback;
  }
}

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

  const downloadRecoveryCodes = () => {
    const content = [
      "CWSCX Mystery Shopper - Account Recovery Codes",
      "==============================================",
      "",
      `Account: ${enrollment?.email || ""}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "WHAT IS THIS FILE?",
      "These are your one-time recovery codes for the CWSCX Mystery Shopper",
      "platform. If you ever forget your password or lose access to your",
      "authenticator app, go to the sign-in page, choose \"Use a recovery code",
      "instead\", and enter your email address together with ONE of the codes",
      "below. You will then be guided through setting a new password and",
      "linking your authenticator app again.",
      "",
      "IMPORTANT",
      "- Each code can be used only once.",
      "- Store this file somewhere safe and private (e.g. a password manager).",
      "- Anyone who has these codes could attempt to access your account.",
      "- If you lose these codes AND your authenticator app, contact the CX",
      "  team to have your access reset.",
      "",
      "YOUR RECOVERY CODES",
      ...recoveryCodes.map((item) => `  ${item}`),
      "",
    ].join("\r\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cwscx-mystery-shopper-recovery-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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
              </div>
              <div className="rounded-md border p-4">
                <p className="text-sm font-semibold">Step 1 — Add this account to your authenticator app</p>
                <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 rounded-md bg-white p-3">
                    <QRCodeSVG value={enrollment.otpauth_uri} size={176} marginSize={1} />
                  </div>
                  <div className="w-full text-sm">
                    <p className="text-xs text-muted-foreground">
                      Scan the QR code with Google Authenticator, Microsoft Authenticator, Authy or any TOTP app.
                      If you can&apos;t scan, choose &quot;Enter a setup key&quot; / &quot;Manual entry&quot; and use:
                    </p>
                    <dl className="mt-2 space-y-1">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium">Account name:</dt>
                        <dd className="break-all font-mono text-xs leading-5">{enrollment.email}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium">Key (secret):</dt>
                        <dd className="break-all font-mono text-xs leading-5">{enrollment.manual_key}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium">Issuer:</dt>
                        <dd className="font-mono text-xs leading-5">{parseOtpauthParam(enrollment.otpauth_uri, "issuer", "CWSCX Mystery Shopper")}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium">Type:</dt>
                        <dd className="text-xs leading-5">Time-based (TOTP), SHA1, 6 digits, 30-second interval</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              {recoveryCodes.length === 0 ? (
                <>
                  <p className="text-sm font-semibold">Step 2 — Set your password and confirm a code from the app</p>
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={downloadRecoveryCodes}>Download recovery codes</Button>
                    <Button type="button" onClick={onBackToLogin}>Continue to sign in</Button>
                  </div>
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
