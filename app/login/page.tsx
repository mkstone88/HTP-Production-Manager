import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · Hometown Painting" };

export default function LoginPage() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(14,63,134,0.08), transparent 60%), radial-gradient(ellipse at bottom, rgba(225,29,42,0.06), transparent 60%)",
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
