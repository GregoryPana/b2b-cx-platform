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

// Microsoft's short link opens the right store (App Store / Google Play) for the phone that scans it.
const AUTHENTICATOR_QR_URL = "https://aka.ms/authenticator";
const AUTHENTICATOR_APPS = [
  {
    name: "Microsoft Authenticator",
    ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
    android: "https://play.google.com/store/apps/details?id=com.azure.authenticator",
  },
  {
    name: "Google Authenticator",
    ios: "https://apps.apple.com/app/google-authenticator/id388497605",
    android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
  },
];

function AuthenticatorAppGuide() {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm font-semibold">Step 1 — Get an authenticator app on your phone</p>
      <p className="mt-1 text-xs text-muted-foreground">
        An authenticator app is a free app that shows a new 6-digit code every 30 seconds. You will enter that code, along with your
        password, each time you sign in — it keeps your account secure. Already have one (Microsoft, Google, Authy or similar)? Skip to Step 2.
      </p>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0 text-center">
          <div className="rounded-md bg-white p-2">
            <QRCodeSVG value={AUTHENTICATOR_QR_URL} size={112} marginSize={1} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Scan with your phone camera</p>
        </div>
        <ul className="w-full space-y-2 text-sm">
          {AUTHENTICATOR_APPS.map((app) => (
            <li key={app.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{app.name}</span>
              <a className="text-xs text-primary underline" href={app.ios} target="_blank" rel="noopener noreferrer">iPhone / iPad</a>
              <a className="text-xs text-primary underline" href={app.android} target="_blank" rel="noopener noreferrer">Android</a>
            </li>
          ))}
          <li className="text-xs text-muted-foreground">
            The QR code above installs Microsoft Authenticator for your phone type. Any authenticator app that supports
            time-based codes (TOTP) will work.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function EnrollScreen({ enrollmentToken, startEnrollment, confirmEnrollment, error, onBackToLogin }) {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (!password) {
      setLocalError("Please choose a password.");
      return;
    }
    if (password.length < 8) {
      setLocalError(`Your password is too short (${password.length} characters). It must be at least 8 characters long.`);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("The two passwords don't match. Please retype them so they are identical.");
      return;
    }
    const cleanCode = code.replace(/\s+/g, "");
    if (!cleanCode) {
      setLocalError("Enter the 6-digit code currently shown in your authenticator app. Add the account in Step 2 first if you haven't yet.");
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setLocalError("The code must be exactly 6 digits (numbers only). Copy it from your authenticator app, without spaces or letters.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await confirmEnrollment(enrollmentToken, password, cleanCode);
      if (result.ok) {
        setRecoveryCodes(Array.isArray(result.data?.recovery_codes) ? result.data.recovery_codes : []);
      } else {
        setCode(""); // codes are single-use and short-lived: make the user type a fresh one
      }
    } finally {
      setSubmitting(false);
    }
  };

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
              <AuthenticatorAppGuide />
              <div className="rounded-md border p-4">
                <p className="text-sm font-semibold">Step 2 — Add this account to your authenticator app</p>
                <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 rounded-md bg-white p-3">
                    <QRCodeSVG value={enrollment.otpauth_uri} size={176} marginSize={1} />
                  </div>
                  <div className="w-full text-sm">
                    <p className="text-xs text-muted-foreground">
                      In your authenticator app tap &quot;+&quot; / &quot;Add account&quot;, choose &quot;Scan a QR code&quot; and scan the code on the left.
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      Opened this page on the same phone as your authenticator app? You can&apos;t scan your own screen —{" "}
                      <a className="text-primary underline" href={enrollment.otpauth_uri}>tap here to add the account to your app</a>{" "}
                      or type the setup key above.
                    </p>
                  </div>
                </div>
              </div>
              {recoveryCodes.length === 0 ? (
                <>
                  <p className="text-sm font-semibold">Step 3 — Set your password and enter the 6-digit code from the app</p>
                  <Input type="password" autoComplete="new-password" placeholder="Set password (at least 8 characters)" value={password} onChange={(event) => setPassword(event.target.value)} />
                  {passwordTooShort ? <p className="text-xs text-amber-700">Too short — {8 - password.length} more character{8 - password.length === 1 ? "" : "s"} needed.</p> : null}
                  <Input type="password" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  {passwordsMismatch ? <p className="text-xs text-amber-700">The two passwords don&apos;t match yet.</p> : null}
                  <Input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="6-digit authenticator code" value={code} onChange={(event) => setCode(event.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    The code changes every 30 seconds. If it is about to change, wait for the next one before entering it.
                  </p>
                  <Button type="button" className="w-full" onClick={submit} disabled={submitting}>
                    {submitting ? "Finishing enrollment..." : "Finish enrollment"}
                  </Button>
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
          {!loading && !enrollment ? (
            <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">We couldn&apos;t open your enrollment page</p>
              <p>{error || "The enrollment link could not be checked. Please try again."}</p>
              <p className="text-xs">
                Enrollment links are single-use and expire after a set time. If yours has expired or was replaced, ask your administrator
                to send a new one. Remember to be connected to the company VPN.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>Try again</Button>
                <Button type="button" onClick={onBackToLogin}>Go to sign in</Button>
              </div>
            </div>
          ) : (localError || error) ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError || error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
