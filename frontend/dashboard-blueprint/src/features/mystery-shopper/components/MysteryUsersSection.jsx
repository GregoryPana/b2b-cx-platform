import { useEffect, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-800",
  invited: "bg-blue-100 text-blue-800",
  recovery_pending: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

const DIALOG_COPY = {
  add: {
    title: "Add user and create enrollment link",
    confirm: "Add user & create link",
    body: (email) => `This adds ${email || "the user"} to the platform and creates a one-time enrollment link. You can copy the link or email it afterwards.`,
  },
  create: {
    title: "Create a new enrollment link",
    confirm: "Create link",
    body: () => "A new one-time link will be shown here for you to copy. Any earlier unused link for this user will stop working.",
  },
  email: {
    title: "Email a new enrollment link",
    confirm: "Email link",
    body: (email) => `A new one-time link will be created and emailed to ${email || "the user"}. Any earlier unused link for this user will stop working.`,
  },
};

const DEFAULT_LINK_MINUTES = 30;
const LINK_VALIDITY_OPTIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 240, label: "4 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
];

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h ${pad(minutes)}m`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Live "expires in" label. `now` is a shared ticking clock owned by the section.
function LinkCountdown({ expiresAt, now, emptyLabel = "No link created" }) {
  if (!expiresAt) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  const remaining = target - now;
  if (remaining <= 0) return <span className="text-xs font-semibold text-red-700">Expired</span>;
  const tone = remaining < 5 * 60 * 1000 ? "text-amber-700" : "text-emerald-700";
  return (
    <span className={`text-xs font-semibold tabular-nums ${tone}`} title={`Expires ${new Date(target).toLocaleString()}`}>
      Expires in {formatRemaining(remaining)}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

export default function MysteryUsersSection({
  mysteryUsers,
  mysteryUsersLoading,
  loadMysteryUsers,
  newMysteryUserEmail,
  setNewMysteryUserEmail,
  newMysteryUserName,
  setNewMysteryUserName,
  inviteMysteryUser,
  reissueMysteryUserLink,
  emailMysteryUserLink,
  suspendMysteryUser,
  reactivateMysteryUser,
  mysteryEnrollmentLink,
  clearMysteryEnrollmentLink,
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // dialog = { mode: "add" | "create" | "email", user?: {id, email, full_name} } while the validity prompt is open.
  const [dialog, setDialog] = useState(null);
  const [dialogMinutes, setDialogMinutes] = useState(DEFAULT_LINK_MINUTES);
  const [dialogBusy, setDialogBusy] = useState(false);

  const openDialog = (mode, user = null) => {
    setDialogMinutes(DEFAULT_LINK_MINUTES); // always start from the safe default so the choice is deliberate
    setDialog({ mode, user });
  };
  const closeDialog = () => {
    if (!dialogBusy) setDialog(null);
  };
  const confirmDialog = async () => {
    if (!dialog) return;
    setDialogBusy(true);
    try {
      if (dialog.mode === "add") await inviteMysteryUser(dialogMinutes);
      else if (dialog.mode === "create") await reissueMysteryUserLink(dialog.user, dialogMinutes);
      else await emailMysteryUserLink(dialog.user, dialogMinutes);
    } finally {
      setDialogBusy(false);
      setDialog(null);
    }
  };

  // Add user: if the form is incomplete, let the handler show its normal validation error instead of opening the prompt.
  const requestAddUser = () => {
    if (!newMysteryUserEmail.trim() || !newMysteryUserName.trim()) {
      inviteMysteryUser(DEFAULT_LINK_MINUTES);
      return;
    }
    openDialog("add");
  };

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !dialogBusy) setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, dialogBusy]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const copyLink = async () => {
    const value = mysteryEnrollmentLink?.enrollment_url || mysteryEnrollmentLink?.enrollment_token || "";
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the enrollment link:", value);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mystery Shopper Users</CardTitle>
        <CardDescription>
          Add a shopper, then send them a one-time enrollment link. The link lets them set a password and connect an authenticator app;
          after that they sign in with their password and an authenticator code. Links expire, and creating a new link
          replaces any earlier unused one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            type="email"
            value={newMysteryUserEmail}
            onChange={(event) => setNewMysteryUserEmail(event.target.value)}
            placeholder="Email address"
          />
          <Input
            value={newMysteryUserName}
            onChange={(event) => setNewMysteryUserName(event.target.value)}
            placeholder="Full name"
          />
          <Button type="button" onClick={requestAddUser}>Add user &amp; create link</Button>
          <Button type="button" variant="outline" onClick={loadMysteryUsers}>
            {mysteryUsersLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {mysteryEnrollmentLink ? (
          <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">
              Enrollment link for {mysteryEnrollmentLink.full_name || mysteryEnrollmentLink.email}
            </p>
            <p className="break-all rounded bg-white px-2 py-1 font-mono text-xs">
              {mysteryEnrollmentLink.enrollment_url || mysteryEnrollmentLink.enrollment_token}
            </p>
            <p className="text-sm">
              <LinkCountdown expiresAt={mysteryEnrollmentLink.expires_at} now={now} />
              <span className="ml-2 text-xs text-emerald-900">
                (until {formatDateTime(mysteryEnrollmentLink.expires_at)}; single use)
              </span>
            </p>
            <p className="text-xs">
              This link is shown only once — copy it now or email it to the user. If it expires or is lost, create a new link;
              the new link replaces this one and the user's account is not affected.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openDialog("email", { id: mysteryEnrollmentLink.user_id, email: mysteryEnrollmentLink.email, full_name: mysteryEnrollmentLink.full_name })}
              >
                Email this link to user
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearMysteryEnrollmentLink}>Dismiss</Button>
            </div>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrollment link</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mysteryUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  {mysteryUsersLoading ? "Loading users..." : "No mystery shopper users yet. Add the first one above."}
                </TableCell>
              </TableRow>
            ) : (
              mysteryUsers.map((user) => {
                const status = String(user.status || "").toLowerCase();
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="break-all">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[status] || "bg-slate-100 text-slate-800"}>
                        {status.replace("_", " ") || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status === "active" || status === "suspended" ? (
                        <span className="text-xs text-muted-foreground">Enrolled</span>
                      ) : (
                        <LinkCountdown expiresAt={user.active_link_expires_at} now={now} emptyLabel="No active link" />
                      )}
                    </TableCell>
                    <TableCell>{user.last_login_at ? formatDateTime(user.last_login_at) : "Never signed in"}</TableCell>
                    <TableCell>{formatDateTime(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openDialog("create", user)}>
                          {status === "invited" ? "Create new link" : "Create reset link"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openDialog("email", user)}>
                          Email new link
                        </Button>
                        {status === "suspended" ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => reactivateMysteryUser(user)}>Reactivate</Button>
                        ) : (
                          <Button type="button" size="sm" variant="destructive" onClick={() => suspendMysteryUser(user)}>Suspend</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Statuses: <strong>invited</strong> — added but has not finished enrolling (needs a valid link); <strong>active</strong> — enrolled and able to sign in;
          <strong> recovery pending</strong> — used a recovery code and must re-enroll; <strong>suspended</strong> — access blocked.
          "Create new link" makes a fresh link (an earlier unused link stops working). "Create reset link" does the same for enrolled users who lost their
          password, authenticator, and recovery codes. "Email new link" creates a new link and emails it directly to the user.
        </p>

        {dialog ? (() => {
          const copy = DIALOG_COPY[dialog.mode];
          const person = dialog.mode === "add"
            ? { name: newMysteryUserName.trim(), email: newMysteryUserEmail.trim() }
            : { name: dialog.user?.full_name, email: dialog.user?.email };
          const expiresAt = new Date(now + dialogMinutes * 60 * 1000);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
              onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="link-dialog-title"
                className="w-full max-w-md space-y-4 rounded-lg border bg-background p-5 text-foreground shadow-xl"
              >
                <div className="space-y-1">
                  <h2 id="link-dialog-title" className="text-lg font-semibold">{copy.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{person.name || person.email}</strong>
                    {person.name && person.email ? ` (${person.email})` : ""}
                  </p>
                </div>
                <p className="text-sm">{copy.body(person.email)}</p>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">How long should the link stay valid?</span>
                  <select
                    autoFocus
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                    value={dialogMinutes}
                    onChange={(event) => setDialogMinutes(Number(event.target.value))}
                    disabled={dialogBusy}
                  >
                    {LINK_VALIDITY_OPTIONS.map((option) => (
                      <option key={option.minutes} value={option.minutes}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <p className="rounded-md bg-muted px-3 py-2 text-xs">
                  The link will expire on <strong>{expiresAt.toLocaleString()}</strong> and can be used once.
                  Shorter is safer; choose longer only if the user may not open the email straight away.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={dialogBusy}>Cancel</Button>
                  <Button type="button" onClick={confirmDialog} disabled={dialogBusy}>
                    {dialogBusy ? "Working..." : copy.confirm}
                  </Button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </CardContent>
    </Card>
  );
}
