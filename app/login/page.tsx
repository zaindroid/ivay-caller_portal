"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Field, inputClass, Button } from "@/components/ui";
import { AudioPulse } from "@/components/audio-pulse";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push(searchParams.get("next") || data.redirect || "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="ambient-glow absolute -top-1/4 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]" />
        <div className="ambient-glow absolute bottom-[-20%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-info/10 blur-[110px]" style={{ animationDelay: "-7s" }} />
      </div>

      <form onSubmit={onSubmit} className="relative w-full max-w-sm rounded-2xl border border-border bg-surface/95 p-10 shadow-[0_1px_2px_rgba(20,22,43,0.04),0_30px_60px_-20px_rgba(20,22,43,0.25)] backdrop-blur">
        <div className="mb-8 text-center">
          <Image
            src="/ivay-logo-full.png"
            alt="Ivay"
            width={820}
            height={865}
            className="mx-auto mb-4 h-20 w-auto"
            priority
          />
          <div className="flex items-center justify-center gap-2 text-text-dim">
            <AudioPulse className="text-primary-hi" />
            <p className="text-sm">Caller Portal</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
