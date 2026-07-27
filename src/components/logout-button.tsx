"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLanguage } from "@/components/language-provider";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const { language } = useLanguage();

  async function logout() {
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={className}
    >
      {pending
        ? language === "th"
          ? "กำลังออกจากระบบ…"
          : "Signing out…"
        : language === "th"
          ? "ออกจากระบบ"
          : "Sign out"}
    </button>
  );
}
