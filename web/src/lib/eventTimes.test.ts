import { describe, expect, it } from "vitest";
import { eventRange } from "./eventTimes";

describe("eventRange", () => {
  it("defaults to a 2 hour event when no end is given", () => {
    const r = eventRange({ dateFrom: "2026-10-18", timeFrom: "11:00", dateTo: "", timeTo: "" });
    expect(r.starts_at).toBe("2026-10-18T06:00:00.000Z");
    expect(r.ends_at).toBe("2026-10-18T08:00:00.000Z");
    expect(r.valid).toBe(true);
  });

  it("uses the start date when only Time To is given", () => {
    const r = eventRange({ dateFrom: "2026-10-18", timeFrom: "11:00", dateTo: "", timeTo: "16:00" });
    expect(r.ends_at).toBe("2026-10-18T11:00:00.000Z");
  });

  it("flags an end before the start", () => {
    const r = eventRange({ dateFrom: "2026-10-18", timeFrom: "11:00", dateTo: "2026-10-17", timeTo: "" });
    expect(r.valid).toBe(false);
  });
});
