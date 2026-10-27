import type { TransferStatus } from "@/server/db/schema";
import { StatusPill } from "@/components/ui/page";

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }
> = {
  prepared: { label: "Préparé", tone: "info" },
  shipped: { label: "Expédié (En transit)", tone: "warning" },
  received: { label: "Reçu", tone: "success" },
  cancelled: { label: "Annulé", tone: "neutral" },
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <StatusPill tone={config.tone}>{config.label}</StatusPill>;
}
