import { describe, expect, it } from "vitest";
import { parseAt } from "../src/time/parseAt.js";

describe("parseAt", () => {
  it("schedules future HH:mm today", () => {
    const now = new Date(2026, 4, 18, 10, 0, 0);
    const { dueAt } = parseAt("17:30", now);
    expect(dueAt.getFullYear()).toBe(2026);
    expect(dueAt.getMonth()).toBe(4);
    expect(dueAt.getDate()).toBe(18);
    expect(dueAt.getHours()).toBe(17);
    expect(dueAt.getMinutes()).toBe(30);
  });

  it("rolls past HH:mm to tomorrow", () => {
    const now = new Date(2026, 4, 18, 18, 0, 0);
    const { dueAt } = parseAt("17:30", now);
    expect(dueAt.getDate()).toBe(19);
    expect(dueAt.getHours()).toBe(17);
  });

  it("parses 5:30pm", () => {
    const now = new Date(2026, 4, 18, 10, 0, 0);
    const { dueAt } = parseAt("5:30pm", now);
    expect(dueAt.getHours()).toBe(17);
    expect(dueAt.getMinutes()).toBe(30);
  });

  it("parses 12:00am as midnight", () => {
    const now = new Date(2026, 4, 18, 23, 30, 0);
    const { dueAt } = parseAt("12:00am", now);
    expect(dueAt.getHours()).toBe(0);
    expect(dueAt.getDate()).toBe(19);
  });

  it("parses explicit datetime", () => {
    const now = new Date(2026, 4, 18, 10, 0, 0);
    const { dueAt } = parseAt("2026-05-19 09:00", now);
    expect(dueAt.getFullYear()).toBe(2026);
    expect(dueAt.getMonth()).toBe(4);
    expect(dueAt.getDate()).toBe(19);
    expect(dueAt.getHours()).toBe(9);
  });

  it("rejects past explicit datetime", () => {
    const now = new Date(2026, 4, 18, 10, 0, 0);
    expect(() => parseAt("2025-01-01 09:00", now)).toThrow(/past/);
  });

  it("rejects invalid string", () => {
    expect(() => parseAt("not-a-time")).toThrow(/Invalid time/);
  });

  it("rejects empty", () => {
    expect(() => parseAt("")).toThrow(/Invalid time/);
  });

  it("rejects out-of-range minutes", () => {
    expect(() => parseAt("17:99", new Date(2026, 0, 1, 10, 0))).toThrow(
      /Invalid time/,
    );
  });
});
