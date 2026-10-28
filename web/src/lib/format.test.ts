import { expect, it } from "vitest";
import { errorMessage } from "./format";

it("names the failing field for validation errors", () => {
  const failure = {
    error: {
      message: "Request validation failed",
      details: { errors: [{ loc: ["body", "password"], msg: "String should have at least 8 characters" }] },
    },
  };
  expect(errorMessage(failure)).toBe("password: String should have at least 8 characters");
  expect(errorMessage({ error: { message: "This email is taken" } })).toBe("This email is taken");
});
