"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/components/use-current-user";
import { UserRole, type AppUser } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

const roles = UserRole.options;

async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch("/api/users", { cache: "no-store" });
  const data = (await res.json()) as { users?: AppUser[]; error?: string };
  if (!res.ok || !data.users) throw new Error(data.error || "Failed to load users");
  return data.users;
}

export function UsersAdmin() {
  const { data: me } = useCurrentUser();
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Users</h1>
        <Button
          size="sm"
          className="ml-auto h-10 px-3 sm:h-9"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      {adding && <AddUserForm onDone={() => setAdding(false)} />}

      {isLoading && (
        <div className="p-4 text-sm text-muted-foreground">Loading users…</div>
      )}
      {error && (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load users."}
        </div>
      )}

      <ul className="divide-y">
        {(users ?? []).map((u) => (
          <UserRow key={u.id} user={u} isSelf={u.id === me?.id} />
        ))}
      </ul>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("user");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      const data = (await res.json()) as { user?: AppUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || "Could not create user");
      return data.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create user"),
  });

  return (
    <form
      className="grid gap-4 border-b bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        create.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-name">Name</Label>
          <Input
            id="new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-role">Role</Label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof roles)[number])}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === "admin" ? "Admin — can manage users" : "User — jobs only"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">Temporary password</Label>
          <Input
            id="new-password"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
            placeholder="At least 8 characters"
            required
          />
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={create.isPending || !name || !email || password.length < 8}
          className="h-11"
        >
          {create.isPending ? "Adding…" : "Add user"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="h-11">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function UserRow({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<(typeof roles)[number]>(user.role);
  const [active, setActive] = useState(user.active);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { name, email, role, active };
      if (password) body.password = password;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { user?: AppUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || "Could not save");
      return data.user;
    },
    onSuccess: () => {
      setPassword("");
      invalidate();
      setOpen(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not delete");
      }
    },
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete"),
  });

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {user.name}
            {isSelf && (
              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <div className="truncate text-sm text-muted-foreground">{user.email}</div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            user.role === "admin"
              ? "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200"
              : "bg-muted text-muted-foreground",
          )}
        >
          {user.role}
        </span>
        {!user.active && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            disabled
          </span>
        )}
      </button>

      {open && (
        <div className="grid gap-4 border-t bg-muted/20 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`name-${user.id}`}>Name</Label>
              <Input
                id={`name-${user.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`email-${user.id}`}>Email</Label>
              <Input
                id={`email-${user.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`role-${user.id}`}>Role</Label>
              <select
                id={`role-${user.id}`}
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof roles)[number])}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r === "admin" ? "Admin — can manage users" : "User — jobs only"}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`password-${user.id}`}>Reset password</Label>
              <Input
                id={`password-${user.id}`}
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4"
            />
            Active (can sign in)
          </label>

          <ErrorNote message={error} />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={save.isPending || !name || !email || (password.length > 0 && password.length < 8)}
              onClick={() => {
                setError(null);
                save.mutate();
              }}
              className="h-11"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSelf || remove.isPending}
              title={isSelf ? "You can't delete your own account" : undefined}
              onClick={() => {
                if (window.confirm(`Delete ${user.name}? This can't be undone.`)) {
                  setError(null);
                  remove.mutate();
                }
              }}
              className="h-11"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
