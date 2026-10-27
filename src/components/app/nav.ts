export type NavIcon =
  | "dashboard"
  | "products"
  | "categories"
  | "stock"
  | "warehouses"
  | "transfers"
  | "pos"
  | "sales"
  | "customers"
  | "suppliers"
  | "reports"
  | "audit";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/dashboard",
        label: "Tableau de bord",
        icon: "dashboard",
        permission: "dashboard.read",
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        href: "/products",
        label: "Produits",
        icon: "products",
        permission: "products.read",
      },
      {
        href: "/categories",
        label: "Catégories",
        icon: "categories",
        permission: "categories.read",
      },
    ],
  },
  {
    label: "Opérations",
    items: [
      {
        href: "/sales/new",
        label: "Nouvelle vente",
        icon: "pos",
        permission: "sales.create",
      },
      {
        href: "/sales",
        label: "Ventes",
        icon: "sales",
        permission: "sales.read",
      },
      {
        href: "/stock",
        label: "Mouvements de stock",
        icon: "stock",
        permission: "stock.read",
      },
      {
        href: "/warehouses",
        label: "Entrepôts",
        icon: "warehouses",
        permission: "warehouses.read",
      },
      {
        href: "/transfers",
        label: "Transferts",
        icon: "transfers",
        permission: "transfers.read",
      },
    ],
  },
  {
    label: "Contacts",
    items: [
      {
        href: "/customers",
        label: "Clients",
        icon: "customers",
        permission: "customers.read",
      },
      {
        href: "/suppliers",
        label: "Fournisseurs",
        icon: "suppliers",
        permission: "suppliers.read",
      },
    ],
  },
  {
    label: "Analyse",
    items: [
      {
        href: "/reports",
        label: "Rapports",
        icon: "reports",
        permission: "reports.read",
      },
      {
        href: "/audit",
        label: "Journal d'audit",
        icon: "audit",
        permission: "audit.read",
      },
    ],
  },
];
