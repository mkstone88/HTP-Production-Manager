"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Contact } from "@/lib/airtable/types";
import { cn } from "@/lib/utils";

export type CustomerSelection =
  | { kind: "existing"; contact: Contact }
  | { kind: "new"; data: NewContactData }
  | null;

export type NewContactData = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

async function fetchContacts(search: string): Promise<Contact[]> {
  const url = new URL("/api/contacts", window.location.origin);
  if (search) url.searchParams.set("search", search);
  url.searchParams.set("limit", "50");
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as { contacts?: Contact[]; error?: string };
  if (!res.ok || !data.contacts) throw new Error(data.error || "Failed to load contacts");
  return data.contacts;
}

type Props = {
  value: CustomerSelection;
  onChange: (v: CustomerSelection) => void;
};

export function CustomerPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", debounced],
    queryFn: () => fetchContacts(debounced),
    enabled: !creating,
    staleTime: 30_000,
  });

  const selected = value;

  // Show summary card if a customer is already chosen.
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {selected.kind === "existing"
              ? selected.contact.name
              : `${selected.data.firstName} ${selected.data.lastName}`}
            {selected.kind === "new" && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-900">
                New contact
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {selected.kind === "existing"
              ? [selected.contact.phone, selected.contact.email]
                  .filter(Boolean)
                  .join(" · ")
              : [selected.data.phone, selected.data.email]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            setCreating(false);
            setSearch("");
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Change
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <NewContactForm
        initialName={search}
        onCancel={() => setCreating(false)}
        onSave={(data) => {
          onChange({ kind: "new", data });
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="h-12 pl-9 text-base sm:h-11"
          autoFocus
        />
      </div>
      <div className="overflow-hidden rounded-lg border">
        {isLoading && (
          <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            {search ? `No contacts matching "${search}"` : "No contacts yet"}
          </div>
        )}
        <ul className="max-h-72 divide-y overflow-auto">
          {(data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "existing", contact: c })}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm",
                  "transition-colors hover:bg-muted/60 active:bg-muted",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <Check className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-12 justify-start gap-2 sm:h-11"
        onClick={() => setCreating(true)}
      >
        <UserPlus className="size-4" />
        Create new contact{search ? ` "${search}"` : ""}
      </Button>
    </div>
  );
}

function NewContactForm({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (data: NewContactData) => void;
  onCancel: () => void;
}) {
  // Best-effort split of initial search text into first/last
  const [first, last] = (() => {
    const parts = initialName.trim().split(/\s+/);
    if (parts.length === 0) return ["", ""];
    if (parts.length === 1) return [parts[0], ""];
    return [parts[0], parts.slice(1).join(" ")];
  })();
  const [firstName, setFirstName] = useState(first);
  const [lastName, setLastName] = useState(last);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const canSave = firstName.trim() && lastName.trim();

  return (
    <div className="grid animate-in fade-in slide-in-from-bottom-2 gap-3 rounded-lg border bg-card p-4 duration-200">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Plus className="size-4" />
        New contact
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-11"
            autoFocus={!firstName}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="h-11"
            autoFocus={Boolean(firstName) && !lastName}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="street">Street address</Label>
        <Input
          id="street"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="h-11"
          autoComplete="street-address"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5 col-span-2 sm:col-span-1">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
            maxLength={2}
            className="h-11 uppercase"
          />
        </div>
        <div className="grid gap-1.5 col-span-3 sm:col-span-1">
          <Label htmlFor="zip">Zip</Label>
          <Input
            id="zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="h-11"
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          disabled={!canSave}
          onClick={() =>
            onSave({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
              street: street.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              zip: zip.trim() || undefined,
            })
          }
          className="h-11 flex-1"
        >
          Use this contact
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="h-11">
          Cancel
        </Button>
      </div>
    </div>
  );
}
