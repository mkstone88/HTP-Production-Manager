"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppUser } from "@/lib/airtable/types";
import { ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch("/api/users", { cache: "no-store" });
  const data = (await res.json()) as { users?: AppUser[]; error?: string };
  if (!res.ok || !data.users) throw new Error(data.error || "Failed to load users");
  return data.users;
}

export function UsersAdmin() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const [adding, setAdding] = useState(false);

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { user?: AppUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || "Update failed");
      return data.user;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="flex flex-1 flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <Button
          size="sm"
          className="ml-auto h-10 px-3 sm:h-9"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
          New user
        </Button>
      </div>

      {adding && (
        <NewUserForm
          onDone={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {users.isLoading && (
        <p className="p-4 text-sm text-muted-foreground">Loading users…</p>
      )}
      {users.error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {users.error instanceof Error ? users.error.message : "Failed to load users."}
        </div>
      )}

      <ul className="divide-y">
        {(users.data ?? []).map((u) => (
          <UserRow
            key={u.id}
            user={u}
            onToggleRole={(role) => {
              const roles = u.roles.includes(role)
                ? u.roles.filter((r) => r !== role)
                : [...u.roles, role];
              patch.mutate({ id: u.id, body: { roles } });
            }}
            onToggleActive={() =>
              patch.mutate({ id: u.id, body: { active: !u.active } })
            }
            onResetPassword={(password) =>
              patch.mutate({ id: u.id, body: { password } })
            }
            busy={patch.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function UserRow({
  user,
  onToggleRole,
  onToggleActive,
  onResetPassword,
  busy,
}: {
  user: AppUser;
  onToggleRole: (role: Role) => void;
  onToggleActive: () => void;
  onResetPassword: (password: string) => void;
  busy: boolean;
}) {
  const [resetting, setResetting] = useState(false);
  const [pw, setPw] = useState("");

  return (
    <li className={cn("px-4 py-4", !user.active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="truncate font-medium">{user.name || "(no name)"}</div>
          <div className="truncate text-sm text-muted-foreground">{user.email}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              user.active
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {user.active ? "Active" : "Inactive"}
          </button>
          <button
            type="button"
            onClick={() => setResetting((v) => !v)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Reset password
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ROLES.map((role) => {
          const on = user.roles.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => onToggleRole(role)}
              disabled={busy}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {role}
            </button>
          );
        })}
      </div>

      {resetting && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`pw-${user.id}`} className="text-xs">
              New password (min 8 chars)
            </Label>
            <Input
              id={`pw-${user.id}`}
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="h-9 w-64"
            />
          </div>
          <Button
            size="sm"
            disabled={busy || pw.length < 8}
            onClick={() => {
              onResetPassword(pw);
              setPw("");
              setResetting(false);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPw("");
              setResetting(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, roles }),
      });
      const data = (await res.json()) as { user?: AppUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || "Create failed");
      return data.user;
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof Error ? e.message : "Create failed"),
  });

  return (
    <Card className="m-4 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" />
        New user
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="nu-name" className="text-xs">Name</Label>
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-email" className="text-xs">Email</Label>
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-pw" className="text-xs">Password (min 8)</Label>
          <Input id="nu-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ROLES.map((role) => {
          const on = roles.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() =>
                setRoles((rs) => (on ? rs.filter((r) => r !== role) : [...rs, role]))
              }
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {role}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={create.isPending || !name || !email || password.length < 8}
          onClick={() => {
            setError(null);
            create.mutate();
          }}
        >
          {create.isPending ? "Creating…" : "Create user"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
