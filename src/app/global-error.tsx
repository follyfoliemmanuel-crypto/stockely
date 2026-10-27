"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f4ed",
          color: "#171b16",
          fontFamily:
            "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "32rem",
            background: "#ffffff",
            border: "1px solid #e5e5da",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 18px 40px -30px rgb(23 27 22 / 0.32)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#6c7267",
            }}
          >
            Erreur critique
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "26px",
              lineHeight: 1.15,
              letterSpacing: "-0.04em",
            }}
          >
            Stockely est momentanément indisponible.
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "#6c7267",
            }}
          >
            Aucune donnée n&apos;a été modifiée. Rechargez la page ou réessayez.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              height: "38px",
              padding: "0 16px",
              border: "1px solid #1f5c43",
              borderRadius: "12px",
              background: "#1f5c43",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
