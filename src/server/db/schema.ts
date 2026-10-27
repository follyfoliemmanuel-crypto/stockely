import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Énumérations                                                               */
/* -------------------------------------------------------------------------- */

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "stock_manager",
  "warehouse_keeper",
  "cashier",
  "accountant",
  "viewer",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "in",
  "out",
  "sale",
  "customer_return",
  "supplier_return",
  "transfer_out",
  "transfer_in",
  "adjustment",
  "reversal",
]);

export const saleStatusEnum = pgEnum("sale_status", ["completed", "cancelled"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "mobile_money",
  "card",
  "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", ["recorded", "refunded"]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "draft",
  "received",
  "cancelled",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "prepared",
  "shipped",
  "received",
  "cancelled",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "low_stock",
  "out_of_stock",
  "sale",
  "operation_failed",
  "other",
]);

/* -------------------------------------------------------------------------- */
/* Comptes, boutiques, sessions                                               */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** Null pour un compte créé uniquement via Google (aucun mot de passe local). */
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("XOF"),
    timezone: text("timezone").notNull().default("Africa/Lome"),
    phone: text("phone"),
    address: text("address"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("shops_slug_unique").on(t.slug),
    index("shops_archived_idx").on(t.archivedAt),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    /** Surcharges de permissions : { "sales.cancel": true, "reports.read": false } */
    permissionOverrides: jsonb("permission_overrides")
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_shop_user_unique").on(t.shopId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Entrepôts                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Un entrepôt appartient à une seule entreprise. Le code est unique par
 * entreprise (insensible à la casse) et un seul entrepôt peut être le
 * entrepôt par défaut. Les entrepôts ne sont jamais supprimés : ils sont
 * archivés pour préserver l'historique des mouvements.
 */
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("warehouses_shop_code_unique").on(t.shopId, sql`upper(${t.code})`),
    uniqueIndex("warehouses_shop_default_unique")
      .on(t.shopId)
      .where(sql`${t.isDefault} = true`),
    index("warehouses_shop_active_idx").on(t.shopId, t.isActive),
    check("warehouses_code_format", sql`${t.code} ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'`),
  ],
);

/** Stock d'un produit dans un entrepôt : source de vérité des quantités. */
export const warehouseStock = pgTable(
  "warehouse_stock",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.warehouseId, t.productId], name: "warehouse_stock_pkey" }),
    index("warehouse_stock_shop_product_idx").on(t.shopId, t.productId),
    index("warehouse_stock_product_idx").on(t.productId),
    check("warehouse_stock_quantity_non_negative", sql`${t.quantity} >= 0`),
  ],
);

/**
 * Autorisation explicite d'un membre sur un entrepôt.
 * Les rôles de pilotage (propriétaire, admin, gestionnaire de stock) voient
 * tous les entrepôts sans ligne dans cette table.
 */
export const warehouseAccess = pgTable(
  "warehouse_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("warehouse_access_warehouse_membership_unique").on(
      t.warehouseId,
      t.membershipId,
    ),
    index("warehouse_access_membership_idx").on(t.membershipId),
    index("warehouse_access_shop_idx").on(t.shopId, t.warehouseId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeShopId: uuid("active_shop_id").references(() => shops.id, {
      onDelete: "set null",
    }),
    tokenHash: text("token_hash").notNull(),
    csrfToken: text("csrf_token").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(t.tokenHash),
    index("password_reset_tokens_user_idx").on(t.userId),
    index("password_reset_tokens_ip_idx").on(t.ipHash, t.createdAt.desc()),
  ],
);

/**
 * Identités externes (Google aujourd'hui, autres fournisseurs demain).
 * La liaison se fait sur un identifiant fournisseur, jamais sur un e-mail
 * non vérifié.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_account_unique").on(
      t.provider,
      t.providerAccountId,
    ),
    index("auth_identities_user_idx").on(t.userId),
    check("auth_identities_provider_known", sql`${t.provider} in ('google')`),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    ipHash: text("ip_hash"),
    succeeded: boolean("succeeded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.email, t.createdAt.desc()),
    index("login_attempts_ip_idx").on(t.ipHash, t.createdAt.desc()),
  ],
);

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_shop_name_unique").on(t.shopId, sql`lower(${t.name})`),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppliers_shop_idx").on(t.shopId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    description: text("description"),
    /** Prix d'achat en unité mineure (centimes). Nullable si inconnu. */
    costCents: bigint("cost_cents", { mode: "number" }),
    /** Prix de vente en unité mineure (centimes). */
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    imageUrl: text("image_url"),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_shop_sku_unique").on(t.shopId, t.sku),
    uniqueIndex("products_shop_barcode_unique")
      .on(t.shopId, t.barcode)
      .where(sql`${t.barcode} is not null`),
    index("products_shop_archived_idx").on(t.shopId, t.isArchived),
    index("products_shop_name_idx").on(t.shopId, t.name),
    index("products_shop_category_idx").on(t.shopId, t.categoryId),
    check("products_price_non_negative", sql`${t.priceCents} >= 0`),
    check("products_cost_non_negative", sql`${t.costCents} is null or ${t.costCents} >= 0`),
    check("products_quantity_non_negative", sql`${t.quantity} >= 0`),
    check("products_min_stock_non_negative", sql`${t.minStock} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Clients, ventes, paiements                                                 */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customers_shop_name_idx").on(t.shopId, t.name),
    index("customers_shop_phone_idx").on(t.shopId, t.phone),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    /** Entrepôt de sortie de la vente (un seul entrepôt par vente en v1). */
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    cashierId: uuid("cashier_id").references(() => users.id, { onDelete: "set null" }),
    status: saleStatusEnum("status").notNull().default("completed"),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    /** Coût des marchandises vendues, figé au moment de la vente. */
    costCents: bigint("cost_cents", { mode: "number" }).notNull().default(0),
    currency: char("currency", { length: 3 }).notNull(),
    note: text("note"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    uniqueIndex("sales_shop_number_unique").on(t.shopId, t.number),
    uniqueIndex("sales_shop_idempotency_unique")
      .on(t.shopId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("sales_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("sales_shop_customer_idx").on(t.shopId, t.customerId),
    index("sales_shop_warehouse_idx").on(t.shopId, t.warehouseId, t.createdAt.desc()),
    check("sales_amounts_non_negative", sql`${t.subtotalCents} >= 0 and ${t.discountCents} >= 0 and ${t.totalCents} >= 0 and ${t.costCents} >= 0`),
    check("sales_discount_within_subtotal", sql`${t.discountCents} <= ${t.subtotalCents}`),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("sale_items_sale_product_unique").on(t.saleId, t.productId),
    index("sale_items_sale_idx").on(t.saleId),
    check("sale_items_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "sale_items_amounts_non_negative",
      sql`${t.unitPriceCents} >= 0 and ${t.discountCents} >= 0 and ${t.lineTotalCents} >= 0`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    /** "recorded" = encaissement saisi, aucun prestataire externe n'est confirmé. */
    status: paymentStatusEnum("status").notNull().default("recorded"),
    reference: text("reference"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_sale_idx").on(t.saleId),
    check("payments_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Achats et mouvements de stock                                              */
/* -------------------------------------------------------------------------- */

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    reference: text("reference"),
    status: purchaseStatusEnum("status").notNull().default("draft"),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
  },
  (t) => [
    index("purchases_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("purchases_supplier_idx").on(t.shopId, t.supplierId),
    check("purchases_total_non_negative", sql`${t.totalCents} >= 0`),
  ],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
  },
  (t) => [
    index("purchase_items_purchase_idx").on(t.purchaseId),
    check("purchase_items_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "purchase_items_amounts_non_negative",
      sql`${t.unitCostCents} >= 0 and ${t.lineTotalCents} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Transferts inter-entrepôts                                                 */
/* -------------------------------------------------------------------------- */

export const warehouseTransfers = pgTable(
  "warehouse_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    fromWarehouseId: uuid("from_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    toWarehouseId: uuid("to_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: transferStatusEnum("status").notNull().default("prepared"),
    note: text("note"),
    idempotencyKey: text("idempotency_key"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    shippedBy: uuid("shipped_by").references(() => users.id, { onDelete: "set null" }),
    receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("warehouse_transfers_shop_number_unique").on(t.shopId, t.number),
    uniqueIndex("warehouse_transfers_shop_idempotency_unique")
      .on(t.shopId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("warehouse_transfers_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("warehouse_transfers_from_idx").on(t.shopId, t.fromWarehouseId),
    index("warehouse_transfers_to_idx").on(t.shopId, t.toWarehouseId),
    check(
      "warehouse_transfers_different_warehouses",
      sql`${t.fromWarehouseId} <> ${t.toWarehouseId}`,
    ),
  ],
);

export const warehouseTransferItems = pgTable(
  "warehouse_transfer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => warehouseTransfers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    quantitySent: integer("quantity_sent").notNull(),
    quantityReceived: integer("quantity_received"),
    discrepancyReason: text("discrepancy_reason"),
  },
  (t) => [
    uniqueIndex("warehouse_transfer_items_transfer_product_unique").on(
      t.transferId,
      t.productId,
    ),
    index("warehouse_transfer_items_transfer_idx").on(t.transferId),
    check("warehouse_transfer_items_quantity_sent_positive", sql`${t.quantitySent} > 0`),
    check(
      "warehouse_transfer_items_quantity_received_valid",
      sql`${t.quantityReceived} is null or ${t.quantityReceived} >= 0`,
    ),
  ],
);

export const transferCounters = pgTable("transfer_counters", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  lastNumber: bigint("last_number", { mode: "number" }).notNull().default(0),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    transferId: uuid("transfer_id").references((): AnyPgColumn => warehouseTransfers.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key"),
    reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => stockMovements.id, {
      onDelete: "set null",
    }),
    type: movementTypeEnum("type").notNull(),
    /** Delta signé : + entrée, - sortie. */
    quantityDelta: integer("quantity_delta").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("stock_movements_product_created_idx").on(t.productId, t.createdAt.desc()),
    index("stock_movements_sale_idx").on(t.saleId),
    index("stock_movements_transfer_idx").on(t.transferId),
    index("stock_movements_shop_warehouse_idx").on(
      t.shopId,
      t.warehouseId,
      t.createdAt.desc(),
    ),
    uniqueIndex("stock_movements_shop_idempotency_unique")
      .on(t.shopId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    check("stock_movements_delta_non_zero", sql`${t.quantityDelta} <> 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Notifications, audit, divers                                               */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** null = notification destinée à toute la boutique. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_shop_user_read_idx").on(t.shopId, t.userId, t.isRead),
    index("notifications_shop_created_idx").on(t.shopId, t.createdAt.desc()),
  ],
);

/** Journal d'audit en ajout seul (protégé par trigger en base). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_shop_scope_key_unique").on(t.shopId, t.scope, t.key),
  ],
);

export const saleCounters = pgTable("sale_counters", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  lastNumber: bigint("last_number", { mode: "number" }).notNull().default(0),
});

export const shopSettings = pgTable(
  "shop_settings",
  {
    shopId: uuid("shop_id")
      .primaryKey()
      .references(() => shops.id, { onDelete: "cascade" }),
    invoicePrefix: text("invoice_prefix").notNull().default("VTE"),
    receiptFooter: text("receipt_footer"),
    /** Taux de TVA en points de base (1000 = 10 %). */
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    lowStockNotifications: boolean("low_stock_notifications").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("shop_settings_tax_rate_range", sql`${t.taxRateBps} between 0 and 10000`)],
);

/* -------------------------------------------------------------------------- */
/* Types utilitaires                                                          */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type WarehouseStock = typeof warehouseStock.$inferSelect;
export type WarehouseAccess = typeof warehouseAccess.$inferSelect;
export type WarehouseTransfer = typeof warehouseTransfers.$inferSelect;
export type WarehouseTransferItem = typeof warehouseTransferItems.$inferSelect;
export type TransferStatus = (typeof transferStatusEnum.enumValues)[number];
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
