"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";
import { appConfig } from "@/lib/app-config";
import { safeCallbackPath } from "@/lib/safe-callback";

export default function LoginPage() {
  const { language } = useLanguage();
  const [hasError, setHasError] = useState(false);
  const [pending, setPending] = useState(false);
  const th = language === "th";
  const callbackPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return safeCallbackPath(
      new URLSearchParams(window.location.search).get("callbackUrl"),
      window.location.origin,
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setHasError(false);
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: data.get("email"),
      password: data.get("password"),
      redirect: false,
    });
    setPending(false);
    if (!result?.ok || result.error) {
      setHasError(true);
      return;
    }
    window.location.assign(callbackPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f8] p-5">
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <LanguageSwitcher className="absolute right-5 top-5" />
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f36c21] text-lg font-black text-white">
          {appConfig.shortName}
        </div>
        <p className="mt-6 text-sm font-bold text-[#e65d15]">
          {th ? appConfig.nameTh : appConfig.name.toUpperCase()}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          {th ? "เข้าสู่ระบบ" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {th
            ? "ใช้บัญชีบริการแจ้งซ่อมเพื่อดำเนินการต่อ"
            : "Use your maintenance-service account to continue."}
        </p>
        {hasError && (
          <p
            id="login-error"
            role="alert"
            aria-live="assertive"
            className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            {th ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : "Invalid email or password."}
          </p>
        )}
        <label className="mt-6 block">
          <span className="field-label">{th ? "อีเมล" : "Email"}</span>
          <input
            required
            autoComplete="email"
            name="email"
            type="email"
            aria-describedby={hasError ? "login-error" : undefined}
            aria-invalid={hasError || undefined}
            className="field-input"
            placeholder={th ? "ชื่อ@example.com" : "name@example.com"}
          />
        </label>
        <label className="mt-5 block">
          <span className="field-label">{th ? "รหัสผ่าน" : "Password"}</span>
          <input
            required
            autoComplete="current-password"
            name="password"
            type="password"
            aria-describedby={hasError ? "login-error" : undefined}
            aria-invalid={hasError || undefined}
            className="field-input"
            placeholder={th ? "รหัสผ่านของคุณ" : "Your password"}
          />
        </label>
        <button
          disabled={pending}
          className="mt-7 w-full rounded-lg bg-[#ee641b] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending
            ? th
              ? "กำลังเข้าสู่ระบบ…"
              : "Signing in…"
            : th
              ? "เข้าสู่ระบบ"
              : "Sign in"}
        </button>
        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          {th
            ? "สำหรับการพัฒนาในเครื่อง ให้รันคำสั่ง seed เพื่อสร้างบัญชีทดสอบ"
            : "For local development, run the seed command to create the demonstration accounts."}
        </p>
      </form>
    </main>
  );
}
