import { afterEach, expect, it } from "vitest";
import { errorMessage, formatTime, priceLabel } from "./format";
import { lang, setLang, t } from "./i18n";

afterEach(() => setLang("en"));

it("switches language for text, prices, times and API errors", () => {
  expect(lang()).toBe("en");
  expect(t("nav.tickets")).toBe("My tickets");

  setLang("kk");
  expect(t("nav.tickets")).toBe("Менің билеттерім");
  expect(t("checkout.ready", { type: "VIP", event: "Jazz" })).toBe("Jazz іс-шарасына «VIP» билетіңіз дайын.");
  expect(priceLabel([0, 0])).toBe("Тегін");
  expect(formatTime("2026-12-01T14:00:00Z", "Asia/Almaty")).toBe("19:00");
  expect(errorMessage({ error: { code: "PROMO_EXPIRED", message: "This promo code has expired" } })).toBe("Промокодтың мерзімі өтті");
  expect(localStorage.getItem("lang")).toBe("kk");
  expect(document.documentElement.lang).toBe("kk");

  setLang("ru");
  expect(errorMessage({ error: { code: "UNKNOWN_CODE", message: "Server text" } })).toBe("Server text");
  expect(errorMessage({ error: { details: { errors: [{ loc: ["body", "password"], msg: "too short" }] } } })).toBe("Пароль: неверное значение");
});
