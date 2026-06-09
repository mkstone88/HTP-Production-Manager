"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/components/use-current-user";

export function AccountForm() {
  const { data: user } = useCurrentUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not change password");
      }
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not change password"),
  });

  const mismatch = confirm.length > 0 && newPassword !== confirm;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Account</h1>
      </div>

      <div className="grid max-w-md gap-6 p-4 sm:p-6">
        {user && (
          <div className="text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground">{user.email}</div>
            <div className="mt-1 text-muted-foreground">
              Role: <span className="font-medium">{user.role}</span>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-sm font-semibold">Change password</h2>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setDone(false);
                if (newPassword !== confirm) {
                  setError("New passwords don't match.");
                  return;
                }
                change.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              {mismatch && (
                <p className="text-sm text-destructive">Passwords don&rsquo;t match.</p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {done && (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Password updated.
                </p>
              )}

              <Button
                type="submit"
                disabled={
                  change.isPending ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  mismatch
                }
                className="h-11"
              >
                {change.isPending ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
