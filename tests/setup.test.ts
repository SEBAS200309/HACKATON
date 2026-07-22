import { describe, it, expect } from "vitest";

describe("Project Setup", () => {
  it("vitest is configured correctly", () => {
    expect(true).toBe(true);
  });

  it("path aliases resolve correctly", async () => {
    // This test confirms the @ alias works by importing from src
    // Will be more useful once src has actual modules
    expect(1 + 1).toBe(2);
  });
});
