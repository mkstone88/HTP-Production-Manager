"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppUser } from "@/lib/airtable/types";
import { canAccess, defaultLanding } from "@/lib/roles";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: AppUser;
      };
      if (!res.ok) {
        setError(body.error || "Login failed");
        return;
      }
      // Land the user where they came from if their roles allow it, else on
      // their default section.
      const roles = body.user?.roles ?? [];
      const target = from && canAccess(roles, from) ? from : defaultLanding(roles);
      router.replace(target);
      router.refresh();
    } catch {
      // fetch itself failed — offline, dead spot, or the server unreachable.
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <Image
        src="/branding/logo.jpg"
        alt="Hometown Painting"
        width={1920}
        height={739}
        priority
        className="h-14 w-auto"
      />
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="mb-4 text-center">
            <h1 className="text-base font-semibold tracking-tight">
              Production Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your work email.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={submitting || !email || !password}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Your home deserves a painter you can trust.
      </p>
    </div>
  );
}
