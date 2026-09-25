"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OtpForm } from "@/components/otp-form";

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="mb-2 text-3xl">הסלון של אורי</h1>
      <p className="mb-8 text-on-surface-variant">
        התחברות עם כתובת אימייל — בלי סיסמה.
      </p>

      <OtpForm
        submitLabel="התחברות"
        onVerified={() => {
          // No explicit destination? /after-sign-in decides by role on the
          // server — an owner gets the manager app, a client gets their own
          // appointments. Hardcoding /dashboard here sent everyone to the
          // manager page and made the landing page's two doors identical.
          router.replace(params.get("next") ?? "/after-sign-in");
          router.refresh();
        }}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
