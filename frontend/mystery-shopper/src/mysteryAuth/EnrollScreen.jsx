import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, ExternalLink, LoaderCircle, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import AuthShell, { CopyButton, Field, InlineAlert, PasswordInput } from "./AuthShell";

function parseOtpauthParam(uri, name, fallback) {
  try {
    const query = (uri || "").split("?")[1] || "";
    return new URLSearchParams(query).get(name) || fallback;
  } catch {
    return fallback;
  }
}

// Direct store links (verified to resolve). Each store gets its own QR code so a phone always opens the right store.
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

const STEPS = [
  { id: 1, label: "Get the app" },
  { id: 2, label: "Add your account" },
  { id: 3, label: "Create password" },
];

function detectDevice() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ reports as Mac, so also check for touch support.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

function Stepper({ current, allDone = false }) {
  return (
    <nav aria-label="Enrollment progress">
      <ol className="flex items-start">
        {STEPS.map((step, index) => {
          const done = allDone || step.id < current;
          const active = !allDone && step.id === current;
          return (
            <li key={step.id} className={cn("flex items-start", index < STEPS.length - 1 && "flex-1")}>
              <div className="flex w-20 flex-col items-center gap-1.5 text-center sm:w-auto sm:flex-row sm:gap-2 sm:text-left">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    done && "border-success bg-success text-success-foreground",
                    active && "border-primary bg-primary text-primary-foreground",
                    !done && !active && "bg-background text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step.id}
                </span>
                <span className={cn("text-xs font-medium leading-tight sm:text-sm", active ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                  <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span aria-hidden="true" className={cn("mx-1 mt-4 h-px flex-1 sm:mx-3", done ? "bg-success" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepHeading({ n, title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {n} of {STEPS.length}</p>
      <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{title}</h2>
      {children ? <p className="mt-1 text-sm text-muted-foreground [text-wrap:pretty]">{children}</p> : null}
    </div>
  );
}

function StepOneGetApp({ device }) {
  const primary = AUTHENTICATOR_APPS[0];
  const storeName = device === "ios" ? "App Store" : "Google Play";
  return (
    <>
      <StepHeading n={1} title="Get a free authenticator app on your phone">
        It shows a new 6-digit code every 30 seconds. You will enter that code, along with your password, each time you sign in — it keeps your
        account secure.
      </StepHeading>

      {device !== "desktop" ? (
        <div className="space-y-2">
          <a
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={device === "ios" ? primary.ios : primary.android}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get {primary.name} on {storeName}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="text-xs text-muted-foreground">Install it, then come back to this page and continue.</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">Scan the code for your phone type with your phone&apos;s camera:</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: "iPhone / iPad", sub: "App Store", url: primary.ios },
              { label: "Android", sub: "Google Play", url: primary.android },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-background p-3 text-center">
                <div className="mx-auto w-fit rounded-md bg-white p-2">
                  <QRCodeSVG value={item.url} size={112} marginSize={1} />
                </div>
                <p className="mt-2 text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub} · {primary.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="group mt-4 rounded-lg border bg-muted/40">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Other apps and store links
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-2 border-t px-3 py-3 text-sm">
          <ul className="space-y-1.5">
            {AUTHENTICATOR_APPS.map((app) => (
              <li key={app.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{app.name}</span>
                <a className="text-xs text-primary underline" href={app.android} target="_blank" rel="noopener noreferrer">Android (Google Play)</a>
                <a className="text-xs text-primary underline" href={app.ios} target="_blank" rel="noopener noreferrer">iPhone / iPad (App Store)</a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Any authenticator app that supports time-based codes (TOTP) will work.</p>
        </div>
      </details>
    </>
  );
}

function StepTwoAddAccount({ enrollment, device }) {
  const issuer = parseOtpauthParam(enrollment.otpauth_uri, "issuer", "CWSCX Mystery Shopper");
  const onPhone = device !== "desktop";
  return (
    <>
      <StepHeading n={2} title="Add your account to the app">
        {onPhone
          ? "Tap the button below to add your account straight into your authenticator app."
          : "In your authenticator app, add this account by scanning the code below."}
      </StepHeading>

      {onPhone ? (
        <div className="space-y-2">
          <a
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={enrollment.otpauth_uri}
          >
            Add account to my authenticator app
          </a>
          <p className="text-xs text-muted-foreground">
            Nothing happened? You can&apos;t scan your own screen, so open the setup key section below and type the key into your app instead.
          </p>
        </div>
      ) : null}

      {!onPhone ? (
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto w-fit rounded-lg border bg-white p-3">
          <QRCodeSVG value={enrollment.otpauth_uri} size={184} marginSize={1} />
        </div>
        <ol className="space-y-3 text-sm">
          {[
            <>Open your authenticator app and tap <strong>+</strong> or <strong>Add account</strong>.</>,
            <>Choose <strong>Scan a QR code</strong>.</>,
            <>Point your phone&apos;s camera at the code on this screen.</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{i + 1}</span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </div>
      ) : null}

      <p className="mt-4 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
        When it works, your app shows <strong>{issuer}</strong> with a 6-digit code.
      </p>

      <details className="group mt-3 rounded-lg border bg-muted/40" open={onPhone}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {onPhone ? "Enter a setup key instead" : "Can’t scan? Enter a setup key instead"}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          <p className="text-xs text-muted-foreground">In your app choose &quot;Enter a setup key&quot; / &quot;Manual entry&quot; and use:</p>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Account name</dt>
              <dd className="break-all font-mono text-xs leading-5">{enrollment.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Key (secret)</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-sm leading-5">{enrollment.manual_key}</span>
                <CopyButton text={enrollment.manual_key || ""} label="Copy key" />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Issuer</dt>
              <dd className="font-mono text-xs leading-5">{issuer}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Type</dt>
              <dd className="text-xs leading-5">Time-based (TOTP), SHA1, 6 digits, 30-second interval</dd>
            </div>
          </dl>
          {!onPhone ? (
            <p className="text-xs text-muted-foreground">
              Opened this page on the same phone as your authenticator app?{" "}
              <a className="text-primary underline" href={enrollment.otpauth_uri}>Tap here to add the account to your app</a>.
            </p>
          ) : null}
        </div>
      </details>
    </>
  );
}

function StepThreeSecure({ form, setForm, submitting, onBack, error }) {
  const { password, confirmPassword, code } = form;
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  return (
    <>
      <StepHeading n={3} title="Choose a password and confirm with your code">
        Your password and the code from your app are what you will use to sign in from now on.
      </StepHeading>
      <div className="space-y-4">
        <Field
          id="enroll-password"
          label="Choose a password"
          hint={
            tooShort
              ? `At least 8 characters — ${8 - password.length} more needed.`
              : password.length >= 8
                ? "Good — that is long enough."
                : "At least 8 characters."
          }
        >
          <PasswordInput id="enroll-password" autoComplete="new-password" value={password} onChange={set("password")} aria-describedby="enroll-password-hint" />
        </Field>
        <Field id="enroll-confirm" label="Confirm password">
          <PasswordInput id="enroll-confirm" autoComplete="new-password" value={confirmPassword} onChange={set("confirmPassword")} />
          {mismatch ? <p className="text-xs text-destructive">The two passwords don&apos;t match yet.</p> : null}
        </Field>
        <Field id="enroll-code" label="6-digit code from your authenticator app" hint="The code changes every 30 seconds. If it is about to change, wait for the next one before entering it.">
          <Input
            id="enroll-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000 000"
            value={code}
            onChange={set("code")}
            aria-describedby="enroll-code-hint"
            className="h-12 text-center font-mono text-xl tracking-[0.25em] tabular-nums"
          />
        </Field>
        <InlineAlert>{error}</InlineAlert>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" className="gap-1.5" onClick={onBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Button>
          <Button type="submit" className="min-h-11 gap-2 sm:min-w-44" disabled={submitting}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {submitting ? "Finishing enrollment..." : "Finish enrollment"}
          </Button>
        </div>
      </div>
    </>
  );
}

function RecoveryCodes({ email, recoveryCodes, onDownload, onBackToLogin }) {
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Enrollment complete</h2>
            <p className="text-sm text-muted-foreground">Your account is ready. One last thing before you sign in.</p>
          </div>
        </div>

        <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Save your recovery codes now
          </p>
          <p className="mt-1 text-muted-foreground">
            They are shown only once. If you lose your phone or forget your password, one of these codes gets you back in. Each code works one time.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Your recovery codes">
          {recoveryCodes.map((item) => (
            <li key={item} className="rounded-md border bg-background px-3 py-2 text-center font-mono text-sm tabular-nums">{item}</li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={onDownload}>
            <Download className="h-4 w-4" aria-hidden="true" /> Download recovery codes
          </Button>
          <CopyButton text={recoveryCodes.join("\n")} label="Copy all codes" size="default" className="min-h-11" />
        </div>
        <p className="text-xs text-muted-foreground">Keep them somewhere private, such as a password manager. Account: {email}</p>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          <span>I have saved my recovery codes somewhere safe.</span>
        </label>

        <Button type="button" className="min-h-11 w-full gap-2" onClick={onBackToLogin} disabled={!saved}>
          Continue to sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          This enrollment link only works once. Save the sign-in address <span className="break-all font-medium text-foreground">{`${window.location.origin}/`}</span> as a bookmark so you can sign in any time.
        </p>
      </CardContent>
    </Card>
  );
}

export default function EnrollScreen({ enrollmentToken, startEnrollment, confirmEnrollment, error, onBackToLogin }) {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ password: "", confirmPassword: "", code: "" });
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const device = detectDevice();
  const headingRef = useRef(null);
  const firstRender = useRef(true);

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

  // Move to the top and announce the new step (keyboard and screen-reader users land at the heading).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, recoveryCodes.length]);

  const goTo = (next) => {
    setLocalError("");
    setStep(next);
  };

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
    const { password, confirmPassword, code } = form;
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
        setForm((prev) => ({ ...prev, code: "" })); // codes are single-use and short-lived: make the user type a fresh one
      }
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = (enrollment?.full_name || "").trim().split(/\s+/)[0];
  const complete = recoveryCodes.length > 0;

  let title = "Set up your secure sign-in";
  let description = "Three short steps, about three minutes. You only do this once.";
  if (!loading && !enrollment) {
    title = "We couldn't open your enrollment page";
    description = undefined;
  } else if (complete) {
    title = firstName ? `You're all set, ${firstName}` : "You're all set";
    description = undefined;
  } else if (!loading && firstName) {
    title = `Welcome, ${firstName}`;
  }

  return (
    <AuthShell title={title} description={description} width="max-w-2xl" headingRef={headingRef}>
      {loading ? (
        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6" role="status" aria-live="polite">
            <p className="text-sm text-muted-foreground">Preparing your enrollment...</p>
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-24 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </CardContent>
        </Card>
      ) : null}

      {!loading && enrollment ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dl className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{enrollment.full_name}</dd></div>
              <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">Email</dt><dd className="break-all font-medium">{enrollment.email}</dd></div>
            </dl>
          </div>

          {complete ? (
            <>
              <Stepper current={4} allDone />
              <RecoveryCodes email={enrollment.email} recoveryCodes={recoveryCodes} onDownload={downloadRecoveryCodes} onBackToLogin={onBackToLogin} />
            </>
          ) : (
            <>
              <Stepper current={step} />
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (step === 3) submit();
                    }}
                  >
                    {step === 1 ? <StepOneGetApp device={device} /> : null}
                    {step === 2 ? <StepTwoAddAccount enrollment={enrollment} device={device} /> : null}
                    {step === 3 ? (
                      <StepThreeSecure form={form} setForm={setForm} submitting={submitting} onBack={() => goTo(2)} error={localError || error} />
                    ) : null}

                    {step === 1 ? (
                      <div className="mt-5 space-y-2">
                        <Button type="button" className="min-h-11 w-full gap-2" onClick={() => goTo(2)}>
                          I have an authenticator app — continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">Already use Microsoft, Google, Authy or similar? You can continue right away.</p>
                      </div>
                    ) : null}
                    {step === 2 ? (
                      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" className="gap-1.5" onClick={() => goTo(1)}>
                          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
                        </Button>
                        <Button type="button" className="min-h-11 gap-2 sm:min-w-56" onClick={() => goTo(3)}>
                          I&apos;ve added the account — continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : null}

      {!loading && !enrollment ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm">{error || "The enrollment link could not be checked. Please try again."}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Enrollment links are single-use and expire after a set time. If yours has expired or was replaced, ask your administrator
              to send a new one. Remember to be connected to the CWS VPN.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Try again</Button>
              <Button type="button" className="min-h-11" onClick={onBackToLogin}>Go to sign in</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AuthShell>
  );
}
