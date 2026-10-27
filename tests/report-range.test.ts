import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportPresets, resolveReportRange } from "@/lib/report-range";

describe("période des rapports", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("utilise les 30 derniers jours par défaut", () => {
    expect(resolveReportRange()).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
    });
  });

  it("remet les bornes dans l'ordre chronologique", () => {
    expect(resolveReportRange("2026-10-26", "2026-09-27")).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
    });
  });

  it("ignore une date invalide sans atteindre SQL", () => {
    expect(resolveReportRange("n'importe quoi", "2026-10-26")).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
    });
  });

  it("rejette une date calendaire inexistante", () => {
    expect(resolveReportRange("2026-02-31", "2026-10-26")).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
    });
  });

  it("borne les périodes démesurées à un an", () => {
    expect(resolveReportRange("2020-01-01", "2026-10-26")).toEqual({
      from: "2025-10-26",
      to: "2026-10-26",
    });
  });

  it("propose les raccourcis 7 jours, 30 jours et mois en cours", () => {
    expect(reportPresets()).toEqual([
      { label: "7 jours", from: "2026-10-20", to: "2026-10-26" },
      { label: "30 jours", from: "2026-09-27", to: "2026-10-26" },
      { label: "Ce mois", from: "2026-10-01", to: "2026-10-26" },
    ]);
  });
});
