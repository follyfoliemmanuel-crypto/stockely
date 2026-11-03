import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_URL } from "@/lib/site";

export const alt = `${SITE_NAME} — gestion de stock, caisse et rapports`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PUBLIC_HOST = SITE_URL.replace(/^https?:\/\//, "");

/**
 * Image de partage générée au build (Open Graph / Twitter).
 * Pas de police externe : le rendu reste rapide et hors ligne.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#F4F4ED",
          color: "#171B16",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "#2E7D5B",
              color: "#F4F4ED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div
            style={{
              marginLeft: 20,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.06,
              fontWeight: 700,
              letterSpacing: -2.2,
            }}
          >
            Votre stock, votre commerce,
          </div>
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.06,
              fontWeight: 700,
              letterSpacing: -2.2,
              color: "#1F5C43",
            }}
          >
            sous contrôle.
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 27,
              lineHeight: 1.45,
              color: "#4B5247",
              maxWidth: 820,
            }}
          >
            Inventaire, caisse, clients et rapports réunis dans un seul espace.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#6C7267",
          }}
        >
          <div style={{ display: "flex" }}>{PUBLIC_HOST}</div>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid #D0D2C4",
              background: "#FAFAF5",
            }}
          >
            Inventaire · Caisse · Rapports
          </div>
        </div>
      </div>
    ),
    size,
  );
}
