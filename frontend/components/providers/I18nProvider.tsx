// components/providers/I18nProvider.tsx
// Port dari src-vue-original/i18n/

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import idMessages from "@/locales/id.json";
import enMessages from "@/locales/en.json";

// Import messages from JSON files
const messages: Record<string, Record<string, unknown>> = {
  id: idMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
};

export const LANGUAGE_OPTIONS = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" },
];

const FALLBACK_LOCALE = "en";

function resolveLocale(locale: string): string {
  const validCodes = Object.keys(messages);
  if (validCodes.includes(locale)) return locale;
  const normal = String(locale || "").toLowerCase();
  return validCodes.includes(normal) ? normal : FALLBACK_LOCALE;
}

function readMessage(locale: string, path: string): unknown {
  const bag = messages[locale];
  if (!bag) return undefined;
  return path.split(".").reduce((acc: any, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, bag);
}

function setDocumentLang(locale: string): void {
  if (typeof document === "undefined") return;
  document.documentElement?.setAttribute("lang", locale);
}

function formatMessage(message: string, values?: Record<string, unknown>): string {
  if (!values || typeof values !== "object") return message;
  const entries = Object.entries(values);
  if (!entries.length) return message;
  let output = String(message);
  for (const [token, value] of entries) {
    const pattern = new RegExp(`\\{${token}\\}`, "g");
    output = output.replace(pattern, String(value));
  }
  return output;
}

interface I18nContextType {
  locale: string;
  available: typeof LANGUAGE_OPTIONS;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string, values?: Record<string, unknown>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
}

export function I18nProvider({ children, initialLocale = FALLBACK_LOCALE }: I18nProviderProps) {
  const [locale, setLocaleState] = useState(() => {
    // Try to load from localStorage first
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("settings");
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.language) {
            return resolveLocale(settings.language);
          }
        }
      } catch (e) {
        console.warn("Failed to load language from localStorage", e);
      }
    }
    return resolveLocale(initialLocale);
  });

  const setLocale = useCallback((nextLocale: string) => {
    const resolved = resolveLocale(nextLocale);
    if (locale === resolved) return;
    setLocaleState(resolved);
    
    // Save to localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("settings") || "{}";
        const settings = JSON.parse(stored);
        settings.language = resolved;
        localStorage.setItem("settings", JSON.stringify(settings));
      } catch (e) {
        console.warn("Failed to save language to localStorage", e);
      }
    }
  }, [locale]);

  const t = useCallback((key: string, fallback?: string, values?: Record<string, unknown>): string => {
    if (!key) return fallback ?? "";

    // Support legacy usage: t(key, values) -> treat second arg as values
    let actualFallback = fallback;
    let actualValues = values;
    if (actualValues === undefined && actualFallback && typeof actualFallback === "object") {
      actualValues = actualFallback as Record<string, unknown>;
      actualFallback = undefined;
    }

    const current = readMessage(locale, key);
    if (current !== undefined) return formatMessage(String(current), actualValues);
    if (locale !== FALLBACK_LOCALE) {
      const fallbackMsg = readMessage(FALLBACK_LOCALE, key);
      if (fallbackMsg !== undefined) return formatMessage(String(fallbackMsg), actualValues);
    }
    const base = actualFallback ?? key;
    return formatMessage(base, actualValues);
  }, [locale]);

  // Set document lang when locale changes
  useEffect(() => {
    setDocumentLang(locale);
  }, [locale]);

  // Listen to localStorage changes from SettingsProvider
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem("settings");
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.language && settings.language !== locale) {
            setLocaleState(resolveLocale(settings.language));
          }
        }
      } catch (e) {
        console.warn("Failed to sync language from localStorage", e);
      }
    };

    // Listen to storage events (from other tabs)
    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically for same-tab updates
    const interval = setInterval(handleStorageChange, 500);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [locale]);

  const value: I18nContextType = {
    locale,
    available: LANGUAGE_OPTIONS,
    setLocale,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
