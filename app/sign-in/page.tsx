"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OtpForm } from "@/components/otp-form";

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="mb-2 text-3xl">Ori&apos;s Salon</h1>
      <p className="mb-8 text-on-surface-variant">
        Sign in with your email — no password needed.
      </p>

      <OtpForm
        submitLabel="Sign in"
        onVerified={() => {
          router.replace(params.get("next") ?? "/dashboard");
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
