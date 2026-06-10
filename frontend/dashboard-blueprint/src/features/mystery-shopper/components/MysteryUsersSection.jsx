import { useState } from "react";
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
  suspendMysteryUser,
  reactivateMysteryUser,
  mysteryEnrollmentLink,
  clearMysteryEnrollmentLink,
}) {
  const [copied, setCopied] = useState(false);

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
          Invite shoppers, generate enrollment links, and manage account access for the public Mystery Shopper survey platform.
          Users sign in with a password and an authenticator app code; they can only enroll through a link generated here.
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
          <Button type="button" onClick={inviteMysteryUser}>Invite user</Button>
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
            <p className="text-xs">
              Send this link to the user over a trusted channel. It is shown once and expires {formatDateTime(mysteryEnrollmentLink.expires_at)}.
              Generating a new link does not invalidate the account — only the previous unused link.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</Button>
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
              <TableHead>Last sign-in</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mysteryUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {mysteryUsersLoading ? "Loading users..." : "No mystery shopper users yet. Invite the first one above."}
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
                    <TableCell>{user.last_login_at ? formatDateTime(user.last_login_at) : "Never signed in"}</TableCell>
                    <TableCell>{formatDateTime(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => reissueMysteryUserLink(user)}>
                          {status === "invited" ? "Generate link" : "Reset / new link"}
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
          Statuses: <strong>invited</strong> — link generated but enrollment not completed; <strong>active</strong> — enrolled and able to sign in;
          <strong> recovery pending</strong> — used a recovery code and must re-enroll; <strong>suspended</strong> — access blocked.
          "Reset / new link" issues a fresh enrollment link for users who lost their password, authenticator, and recovery codes.
        </p>
      </CardContent>
    </Card>
  );
}
