import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

const STATUS_META = {
  invited: { label: "Invited", variant: "default" },
  recovery_pending: { label: "Recovery pending", variant: "warning" },
  active: { label: "Active", variant: "success" },
  suspended: { label: "Suspended", variant: "destructive" },
};
const FILTERS = [
  { key: "all", label: "All" },
  { key: "invited", label: "Invited" },
  { key: "recovery_pending", label: "Recovery pending" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

const DIALOG_COPY = {
  add: {
    title: "Add a shopper",
    confirm: "Add shopper & create link",
    body: () => "They are added to the platform and a one-time enrollment link is created. You can copy the link or email it afterwards.",
  },
  create: {
    title: "Create an enrollment link",
    confirm: "Create link",
    body: () => "A new one-time link will be shown here for you to copy. Any earlier unused link for this shopper will stop working.",
  },
  email: {
    title: "Email an enrollment link",
    confirm: "Email link",
    body: (email) => `A new one-time link will be created and emailed to ${email || "the shopper"}. Any earlier unused link will stop working.`,
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
  if (remaining <= 0) return <span className="text-xs font-medium text-destructive">Expired</span>;
  const tone = remaining < 5 * 60 * 1000 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-300";
  return (
    <span className={`text-xs font-medium tabular-nums ${tone}`} title={`Expires ${new Date(target).toLocaleString()}`}>
      Expires in {formatRemaining(remaining)}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function formatShort(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// "More actions" menu. Positioned with `fixed` so the table's scroll container can never clip it.
function RowMenu({ label, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDown = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen((value) => !value);
  };

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="px-2"
      >
        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
      </Button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-56 rounded-md border bg-background p-1 text-sm shadow-lg"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}

function MenuItem({ onClick, destructive = false, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center rounded-sm px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${destructive ? "text-destructive" : ""}`}
    >
      {children}
    </button>
  );
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
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  // dialog = { mode: "add" | "create" | "email", user?: {id, email, full_name} } while the prompt is open.
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

  const addEmail = newMysteryUserEmail.trim();
  const addName = newMysteryUserName.trim();
  const addEmailValid = /^\S+@\S+\.\S+$/.test(addEmail);
  const addReady = addEmailValid && addName.length >= 2;

  const confirmDialog = async () => {
    if (!dialog) return;
    if (dialog.mode === "add" && !addReady) return;
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

  const statusOf = (user) => String(user.status || "").toLowerCase();

  const counts = useMemo(() => {
    const result = { all: mysteryUsers.length, invited: 0, recovery_pending: 0, active: 0, suspended: 0 };
    mysteryUsers.forEach((user) => {
      const key = String(user.status || "").toLowerCase();
      if (key in result) result[key] += 1;
    });
    return result;
  }, [mysteryUsers]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mysteryUsers.filter((user) => {
      if (filter !== "all" && String(user.status || "").toLowerCase() !== filter) return false;
      if (!needle) return true;
      return `${user.full_name || ""} ${user.email || ""}`.toLowerCase().includes(needle);
    });
  }, [mysteryUsers, filter, query]);

  const filtersActive = filter !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setFilter("all");
    setQuery("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Shoppers</CardTitle>
            <CardDescription>
              Invite mystery shoppers and manage their access. Each shopper enrols once through a one-time link.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={loadMysteryUsers} disabled={mysteryUsersLoading}>
              {mysteryUsersLoading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button type="button" onClick={() => openDialog("add")}>Add shopper</Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {mysteryEnrollmentLink ? (
          <div className="space-y-3 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-100">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">Enrollment link for {mysteryEnrollmentLink.full_name || mysteryEnrollmentLink.email}</p>
              <Button type="button" size="sm" variant="ghost" onClick={clearMysteryEnrollmentLink}>Dismiss</Button>
            </div>
            <p className="break-all rounded-md bg-white px-3 py-2 font-mono text-xs">
              {mysteryEnrollmentLink.enrollment_url || mysteryEnrollmentLink.enrollment_token}
            </p>
            <p>
              <LinkCountdown expiresAt={mysteryEnrollmentLink.expires_at} now={now} />
              <span className="ml-2 text-xs text-emerald-900 dark:text-emerald-200">
                until {formatDateTime(mysteryEnrollmentLink.expires_at)} · single use
              </span>
            </p>
            <p className="text-xs text-emerald-900 dark:text-emerald-200">
              This link is shown only once. Copy it now or email it to the shopper. If it expires or is lost, create a new one; their account is not affected.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openDialog("email", { id: mysteryEnrollmentLink.user_id, email: mysteryEnrollmentLink.email, full_name: mysteryEnrollmentLink.full_name })}
              >
                Email this link
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={filter === item.key ? "default" : "outline"}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                <span className="tabular-nums opacity-70">{counts[item.key]}</span>
              </Button>
            ))}
          </div>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search shoppers by name or email"
            className="lg:max-w-xs"
          />
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 text-xs uppercase tracking-wider">Shopper</TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wider">Enrollment link</TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wider">Last sign-in</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mysteryUsersLoading && mysteryUsers.length === 0 ? (
                [0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={5} className="px-4 py-4">
                      <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleUsers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-12 text-center">
                    {mysteryUsers.length === 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">No shoppers yet. Add the first one to send them an enrollment link.</p>
                        <Button type="button" onClick={() => openDialog("add")}>Add shopper</Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">No shoppers match your search or filter.</p>
                        {filtersActive ? <Button type="button" size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : null}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visibleUsers.map((user) => {
                  const status = statusOf(user);
                  const meta = STATUS_META[status] || { label: status || "Unknown", variant: "secondary" };
                  const enrolled = status === "active" || status === "suspended";
                  const needsLink = status === "invited" || status === "recovery_pending";
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="px-4 py-3">
                        <p className="font-medium">{user.full_name}</p>
                        <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant={meta.variant} className="whitespace-nowrap">{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {enrolled ? (
                          <span className="text-xs text-muted-foreground">Enrolled</span>
                        ) : (
                          <LinkCountdown expiresAt={user.active_link_expires_at} now={now} emptyLabel="No active link" />
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <p className="text-sm">{user.last_login_at ? formatShort(user.last_login_at) : "Never signed in"}</p>
                        <p className="text-xs text-muted-foreground">Added {formatShort(user.created_at)}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {status === "suspended" ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => reactivateMysteryUser(user)}>Reactivate</Button>
                          ) : (
                            <Button type="button" size="sm" variant="outline" onClick={() => openDialog("email", user)}>
                              {needsLink ? "Email link" : "Email reset link"}
                            </Button>
                          )}
                          <RowMenu label={`More actions for ${user.full_name || user.email}`}>
                            <MenuItem onClick={() => openDialog("create", user)}>
                              {needsLink ? "Create link to copy" : "Create reset link to copy"}
                            </MenuItem>
                            {status !== "suspended" ? (
                              <>
                                <div role="separator" className="my-1 h-px bg-border" />
                                <MenuItem destructive onClick={() => suspendMysteryUser(user)}>Suspend access</MenuItem>
                              </>
                            ) : null}
                          </RowMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <details className="group rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <summary className="cursor-pointer select-none font-medium">How do statuses and links work?</summary>
          <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
            <p><strong className="text-foreground">Invited</strong> — added but has not finished enrolling. Needs a valid link.</p>
            <p><strong className="text-foreground">Active</strong> — enrolled and able to sign in.</p>
            <p><strong className="text-foreground">Recovery pending</strong> — used a recovery code and must enrol again with a new link.</p>
            <p><strong className="text-foreground">Suspended</strong> — access blocked. Reactivate to restore it.</p>
            <p className="sm:col-span-2">
              <strong className="text-foreground">Links</strong> are single use and expire. Creating or emailing a new link replaces any earlier unused one.
              Use a reset link for an enrolled shopper who lost their password, authenticator app and recovery codes.
            </p>
          </div>
        </details>

        {dialog ? (() => {
          const copy = DIALOG_COPY[dialog.mode];
          const isAdd = dialog.mode === "add";
          const person = { name: dialog.user?.full_name, email: dialog.user?.email };
          const expiresAt = new Date(now + dialogMinutes * 60 * 1000);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
              onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="link-dialog-title"
                className="w-full max-w-md space-y-5 rounded-lg border bg-background p-6 text-foreground shadow-lg"
              >
                <div className="space-y-1.5">
                  <h2 id="link-dialog-title" className="text-lg font-semibold tracking-tight">{copy.title}</h2>
                  {!isAdd ? (
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">{person.name || person.email}</strong>
                      {person.name && person.email ? ` (${person.email})` : ""}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">{copy.body(person.email)}</p>
                </div>

                {isAdd ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="add-shopper-email" className="text-sm font-medium">Email address</label>
                      <Input
                        id="add-shopper-email"
                        type="email"
                        autoFocus
                        value={newMysteryUserEmail}
                        onChange={(event) => setNewMysteryUserEmail(event.target.value)}
                        placeholder="name@example.com"
                        disabled={dialogBusy}
                      />
                      {addEmail && !addEmailValid ? <p className="text-xs text-destructive">Enter a valid email address.</p> : null}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="add-shopper-name" className="text-sm font-medium">Full name</label>
                      <Input
                        id="add-shopper-name"
                        value={newMysteryUserName}
                        onChange={(event) => setNewMysteryUserName(event.target.value)}
                        placeholder="First and last name"
                        disabled={dialogBusy}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="link-validity" className="text-sm font-medium">How long should the link stay valid?</label>
                  <select
                    id="link-validity"
                    autoFocus={!isAdd}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={dialogMinutes}
                    onChange={(event) => setDialogMinutes(Number(event.target.value))}
                    disabled={dialogBusy}
                  >
                    {LINK_VALIDITY_OPTIONS.map((option) => (
                      <option key={option.minutes} value={option.minutes}>{option.label}</option>
                    ))}
                  </select>
                  <p className="rounded-md bg-muted px-3 py-2 text-xs">
                    Expires <strong>{expiresAt.toLocaleString()}</strong> and can be used once. Shorter is safer; choose longer only if the shopper may not open the email straight away.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={dialogBusy}>Cancel</Button>
                  <Button type="button" onClick={confirmDialog} disabled={dialogBusy || (isAdd && !addReady)}>
                    {dialogBusy ? "Working…" : copy.confirm}
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
