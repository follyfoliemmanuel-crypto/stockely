"use client";

import { buttonClasses } from "@/components/ui/button";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses({ variant: "secondary", size: "sm", className: "print:hidden" })}
    >
      {label}
    </button>
  );
}
