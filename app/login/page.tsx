import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · HTP" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
