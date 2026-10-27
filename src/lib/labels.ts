export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  in: "Entrée",
  out: "Sortie",
  sale: "Vente",
  customer_return: "Retour client",
  supplier_return: "Retour fournisseur",
  transfer_out: "Transfert sortant",
  transfer_in: "Transfert entrant",
  adjustment: "Correction",
  reversal: "Compensation",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile money",
  card: "Carte",
  other: "Autre",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  recorded: "Encaissé",
  refunded: "Remboursé",
};

export const SALE_STATUS_LABELS: Record<string, string> = {
  completed: "Terminée",
  cancelled: "Annulée",
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  prepared: "Préparé",
  shipped: "Expédié (En transit)",
  received: "Reçu",
  cancelled: "Annulé",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "demo.seeded": "Données de démonstration",
  "shop.created": "Boutique créée",
  "auth.register": "Inscription",
  "auth.login": "Connexion",
  "auth.google_linked": "Compte Google relié",
  "auth.password_reset_requested": "Réinitialisation demandée",
  "auth.password_reset_completed": "Mot de passe réinitialisé",
  "sale.created": "Vente enregistrée",
  "sale.cancelled": "Vente annulée",
  "transfer.create": "Transfert créé",
  "transfer.ship": "Transfert expédié",
  "transfer.receive": "Transfert reçu",
  "transfer.cancel": "Transfert annulé",
  "product.created": "Produit créé",
  "product.updated": "Produit modifié",
  "product.archived": "Produit archivé",
  "product.restored": "Produit restauré",
  "stock.in": "Entrée de stock",
  "stock.out": "Sortie de stock",
  "stock.adjustment": "Correction de stock",
  "customer.created": "Client créé",
  "customer.updated": "Client modifié",
  "customer.deleted": "Client supprimé",
  "supplier.created": "Fournisseur créé",
  "supplier.updated": "Fournisseur modifié",
  "supplier.deleted": "Fournisseur supprimé",
  "category.created": "Catégorie créée",
  "category.updated": "Catégorie modifiée",
  "category.deleted": "Catégorie supprimée",
  "reports.exported": "Export de rapport",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replaceAll(".", " · ");
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  product: "Produit",
  sale: "Vente",
  customer: "Client",
  supplier: "Fournisseur",
  category: "Catégorie",
  shop: "Boutique",
  report: "Rapport",
  user: "Utilisateur",
};

export function movementTone(type: string): "success" | "danger" | "warning" | "info" {
  switch (type) {
    case "in":
    case "customer_return":
    case "reversal":
      return "success";
    case "out":
    case "sale":
      return "danger";
    case "supplier_return":
      return "warning";
    default:
      return "info";
  }
}
