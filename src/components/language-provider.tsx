"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Language = "th" | "en";
export const LANGUAGE_STORAGE_KEY = "service-portal-language";

function isLanguage(value: string | null): value is Language {
  return value === "th" || value === "en";
}

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("th");

  useEffect(() => {
    let savedLanguage: string | null = null;
    try {
      savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return;
    }
    if (!isLanguage(savedLanguage)) return;

    const restorePreference = window.setTimeout(
      () => setLanguage(savedLanguage),
      0,
    );
    return () => window.clearTimeout(restorePreference);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setPreferredLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Continue using the selected language when browser storage is unavailable.
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: setPreferredLanguage }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold ${className}`}
      aria-label={language === "th" ? "เลือกภาษา" : "Language selector"}
    >
      <button
        type="button"
        onClick={() => setLanguage("th")}
        className={`rounded-md px-2.5 py-1.5 ${language === "th" ? "bg-[#ee641b] text-white" : "text-slate-500"}`}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`rounded-md px-2.5 py-1.5 ${language === "en" ? "bg-[#ee641b] text-white" : "text-slate-500"}`}
      >
        EN
      </button>
    </div>
  );
}
