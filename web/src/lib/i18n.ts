import { useSyncExternalStore } from "react";
import { messages, type MessageKey } from "./messages";

export type Lang = keyof typeof messages;

export const LANGS: { code: Lang; label: string }[] = [
  { code: "kk", label: "Қаз" },
  { code: "ru", label: "Рус" },
  { code: "en", label: "Eng" },
];

const LOCALES: Record<Lang, string> = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" };

function isLang(value: string | null): value is Lang {
  return value === "kk" || value === "ru" || value === "en";
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (isLang(saved)) return saved;
  } catch {
    return "kk";
  }
  const browser = navigator.language.slice(0, 2);
  return browser === "ru" ? "ru" : "kk";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();
document.documentElement.lang = current;

export function lang() {
  return current;
}

export function locale() {
  return LOCALES[current];
}

export function setLang(next: Lang) {
  current = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem("lang", next);
  } catch {
    return;
  } finally {
    listeners.forEach((notify) => notify());
  }
}

export function useLang() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
  );
}

export function t(key: MessageKey, vars?: Record<string, string | number>) {
  const text: string = messages[current][key] ?? messages.en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? "")) : text;
}

export function tOptional(key: string): string | undefined {
  return (messages[current] as Record<string, string>)[key];
}
