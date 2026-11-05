CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'stock_manager', 'cashier', 'viewer');
CREATE TYPE "public"."movement_type" AS ENUM('in', 'out', 'sale', 'customer_return', 'supplier_return', 'adjustment', 'reversal');
CREATE TYPE "public"."notification_type" AS ENUM('low_stock', 'out_of_stock', 'sale', 'operation_failed', 'other');
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mobile_money', 'card', 'other');
CREATE TYPE "public"."payment_status" AS ENUM('recorded', 'refunded');
CREATE TYPE "public"."purchase_status" AS ENUM('draft', 'received', 'cancelled');
CREATE TYPE "public"."sale_status" AS ENUM('completed', 'cancelled');
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"shop_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text,
	"succeeded" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"permission_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'recorded' NOT NULL,
	"reference" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_cents" > 0)
);

CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"category_id" uuid,
	"supplier_id" uuid,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"description" text,
	"cost_cents" bigint,
	"price_cents" bigint NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price_cents" >= 0),
	CONSTRAINT "products_cost_non_negative" CHECK ("products"."cost_cents" is null or "products"."cost_cents" >= 0),
	CONSTRAINT "products_quantity_non_negative" CHECK ("products"."quantity" >= 0),
	CONSTRAINT "products_min_stock_non_negative" CHECK ("products"."min_stock" >= 0)
);

CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_cents" bigint NOT NULL,
	"line_total_cents" bigint NOT NULL,
	CONSTRAINT "purchase_items_quantity_positive" CHECK ("purchase_items"."quantity" > 0),
	CONSTRAINT "purchase_items_amounts_non_negative" CHECK ("purchase_items"."unit_cost_cents" >= 0 and "purchase_items"."line_total_cents" >= 0)
);

CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"supplier_id" uuid,
	"reference" text,
	"status" "purchase_status" DEFAULT 'draft' NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone,
	CONSTRAINT "purchases_total_non_negative" CHECK ("purchases"."total_cents" >= 0)
);

CREATE TABLE "sale_counters" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"last_number" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"unit_cost_cents" bigint,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"line_total_cents" bigint NOT NULL,
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_amounts_non_negative" CHECK ("sale_items"."unit_price_cents" >= 0 and "sale_items"."discount_cents" >= 0 and "sale_items"."line_total_cents" >= 0)
);

CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"number" text NOT NULL,
	"customer_id" uuid,
	"cashier_id" uuid,
	"status" "sale_status" DEFAULT 'completed' NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint NOT NULL,
	"cost_cents" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) NOT NULL,
	"note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	CONSTRAINT "sales_amounts_non_negative" CHECK ("sales"."subtotal_cents" >= 0 and "sales"."discount_cents" >= 0 and "sales"."total_cents" >= 0 and "sales"."cost_cents" >= 0),
	CONSTRAINT "sales_discount_within_subtotal" CHECK ("sales"."discount_cents" <= "sales"."subtotal_cents")
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"active_shop_id" uuid,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);

CREATE TABLE "shop_settings" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"invoice_prefix" text DEFAULT 'VTE' NOT NULL,
	"receipt_footer" text,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"low_stock_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_settings_tax_rate_range" CHECK ("shop_settings"."tax_rate_bps" between 0 and 10000)
);

CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"currency" char(3) DEFAULT 'XOF' NOT NULL,
	"timezone" text DEFAULT 'Africa/Lome' NOT NULL,
	"phone" text,
	"address" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);

CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"sale_id" uuid,
	"purchase_id" uuid,
	"reversal_of_id" uuid,
	"type" "movement_type" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_delta_non_zero" CHECK ("stock_movements"."quantity_delta" <> 0)
);

CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "categories" ADD CONSTRAINT "categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sale_counters" ADD CONSTRAINT "sale_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_shop_id_shops_id_fk" FOREIGN KEY ("active_shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reversal_of_id_stock_movements_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."stock_movements"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "audit_logs_shop_created_idx" ON "audit_logs" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");
CREATE UNIQUE INDEX "categories_shop_name_unique" ON "categories" USING btree ("shop_id",lower("name"));
CREATE INDEX "customers_shop_name_idx" ON "customers" USING btree ("shop_id","name");
CREATE INDEX "customers_shop_phone_idx" ON "customers" USING btree ("shop_id","phone");
CREATE UNIQUE INDEX "idempotency_keys_shop_scope_key_unique" ON "idempotency_keys" USING btree ("shop_id","scope","key");
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at" DESC NULLS LAST);
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_hash","created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "memberships_shop_user_unique" ON "memberships" USING btree ("shop_id","user_id");
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");
CREATE INDEX "notifications_shop_user_read_idx" ON "notifications" USING btree ("shop_id","user_id","is_read");
CREATE INDEX "notifications_shop_created_idx" ON "notifications" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");
CREATE INDEX "payments_sale_idx" ON "payments" USING btree ("sale_id");
CREATE UNIQUE INDEX "products_shop_sku_unique" ON "products" USING btree ("shop_id","sku");
CREATE UNIQUE INDEX "products_shop_barcode_unique" ON "products" USING btree ("shop_id","barcode") WHERE "products"."barcode" is not null;
CREATE INDEX "products_shop_archived_idx" ON "products" USING btree ("shop_id","is_archived");
CREATE INDEX "products_shop_name_idx" ON "products" USING btree ("shop_id","name");
CREATE INDEX "products_shop_category_idx" ON "products" USING btree ("shop_id","category_id");
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");
CREATE INDEX "purchases_shop_created_idx" ON "purchases" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE INDEX "purchases_supplier_idx" ON "purchases" USING btree ("shop_id","supplier_id");
CREATE UNIQUE INDEX "sale_items_sale_product_unique" ON "sale_items" USING btree ("sale_id","product_id");
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");
CREATE UNIQUE INDEX "sales_shop_number_unique" ON "sales" USING btree ("shop_id","number");
CREATE UNIQUE INDEX "sales_shop_idempotency_unique" ON "sales" USING btree ("shop_id","idempotency_key") WHERE "sales"."idempotency_key" is not null;
CREATE INDEX "sales_shop_created_idx" ON "sales" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE INDEX "sales_shop_customer_idx" ON "sales" USING btree ("shop_id","customer_id");
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
CREATE UNIQUE INDEX "shops_slug_unique" ON "shops" USING btree ("slug");
CREATE INDEX "shops_archived_idx" ON "shops" USING btree ("archived_at");
CREATE INDEX "stock_movements_shop_created_idx" ON "stock_movements" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id","created_at" DESC NULLS LAST);
CREATE INDEX "stock_movements_sale_idx" ON "stock_movements" USING btree ("sale_id");
CREATE INDEX "suppliers_shop_idx" ON "suppliers" USING btree ("shop_id","name");
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));

CREATE OR REPLACE FUNCTION stockely_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs est en ajout seul : modification interdite';
END;
$$;

CREATE TRIGGER audit_logs_reject_update_delete
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION stockely_reject_audit_mutation();

CREATE TRIGGER audit_logs_reject_truncate
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT
EXECUTE FUNCTION stockely_reject_audit_mutation();

CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_known" CHECK ("auth_identities"."provider" in ('google'))
);

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN "ip_hash" text;
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "auth_identities_provider_account_unique" ON "auth_identities" USING btree ("provider","provider_account_id");
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");
CREATE INDEX "password_reset_tokens_ip_idx" ON "password_reset_tokens" USING btree ("ip_hash","created_at" DESC NULLS LAST);

CREATE TABLE "warehouse_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "warehouse_stock" (
	"shop_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_stock_pkey" PRIMARY KEY("warehouse_id","product_id"),
	CONSTRAINT "warehouse_stock_quantity_non_negative" CHECK ("warehouse_stock"."quantity" >= 0)
);

CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "warehouses_code_format" CHECK ("warehouses"."code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$')
);

ALTER TABLE "sales" ADD COLUMN "warehouse_id" uuid;
ALTER TABLE "stock_movements" ADD COLUMN "warehouse_id" uuid;
ALTER TABLE "stock_movements" ADD COLUMN "idempotency_key" text;
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "warehouse_access_warehouse_membership_unique" ON "warehouse_access" USING btree ("warehouse_id","membership_id");
CREATE INDEX "warehouse_access_membership_idx" ON "warehouse_access" USING btree ("membership_id");
CREATE INDEX "warehouse_access_shop_idx" ON "warehouse_access" USING btree ("shop_id","warehouse_id");
CREATE INDEX "warehouse_stock_shop_product_idx" ON "warehouse_stock" USING btree ("shop_id","product_id");
CREATE INDEX "warehouse_stock_product_idx" ON "warehouse_stock" USING btree ("product_id");
CREATE UNIQUE INDEX "warehouses_shop_code_unique" ON "warehouses" USING btree ("shop_id",upper("code"));
CREATE UNIQUE INDEX "warehouses_shop_default_unique" ON "warehouses" USING btree ("shop_id") WHERE "warehouses"."is_default" = true;
CREATE INDEX "warehouses_shop_active_idx" ON "warehouses" USING btree ("shop_id","is_active");
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "sales_shop_warehouse_idx" ON "sales" USING btree ("shop_id","warehouse_id","created_at" DESC NULLS LAST);
CREATE INDEX "stock_movements_shop_warehouse_idx" ON "stock_movements" USING btree ("shop_id","warehouse_id","created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "stock_movements_shop_idempotency_unique" ON "stock_movements" USING btree ("shop_id","idempotency_key") WHERE "stock_movements"."idempotency_key" is not null;
INSERT INTO "warehouses" ("shop_id", "name", "code", "is_default", "is_active")
SELECT "id", 'Entrepôt principal', 'MAIN', true, true FROM "shops";
INSERT INTO "warehouse_stock" ("shop_id", "warehouse_id", "product_id", "quantity")
SELECT p."shop_id", w."id", p."id", p."quantity"
FROM "products" p
INNER JOIN "warehouses" w ON w."shop_id" = p."shop_id" AND w."code" = 'MAIN';
UPDATE "stock_movements" m
SET "warehouse_id" = w."id"
FROM "warehouses" w
WHERE w."shop_id" = m."shop_id" AND w."code" = 'MAIN' AND m."warehouse_id" IS NULL;
UPDATE "sales" s
SET "warehouse_id" = w."id"
FROM "warehouses" w
WHERE w."shop_id" = s."shop_id" AND w."code" = 'MAIN' AND s."warehouse_id" IS NULL;
DO $$
DECLARE
  mismatch_count integer;
  shop_without_warehouse integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM "products" p
  WHERE p."quantity" <> COALESCE((
    SELECT sum(ws."quantity") FROM "warehouse_stock" ws WHERE ws."product_id" = p."id"
  ), 0);

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Reprise interrompue : % produit(s) dont le total entrepôt diffère de products.quantity.', mismatch_count;
  END IF;

  SELECT count(*) INTO shop_without_warehouse
  FROM "shops" s
  WHERE NOT EXISTS (SELECT 1 FROM "warehouses" w WHERE w."shop_id" = s."id");

  IF shop_without_warehouse > 0 THEN
    RAISE EXCEPTION 'Reprise interrompue : % entreprise(s) sans entrepôt.', shop_without_warehouse;
  END IF;
END $$;

CREATE TYPE "public"."transfer_status" AS ENUM('prepared', 'shipped', 'received', 'cancelled');
ALTER TYPE "public"."member_role" ADD VALUE 'warehouse_keeper' BEFORE 'cashier';
ALTER TYPE "public"."member_role" ADD VALUE 'accountant' BEFORE 'viewer';
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_out' BEFORE 'adjustment';
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_in' BEFORE 'adjustment';
CREATE TABLE "transfer_counters" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"last_number" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "warehouse_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity_sent" integer NOT NULL,
	"quantity_received" integer,
	"discrepancy_reason" text,
	CONSTRAINT "warehouse_transfer_items_quantity_sent_positive" CHECK ("warehouse_transfer_items"."quantity_sent" > 0),
	CONSTRAINT "warehouse_transfer_items_quantity_received_valid" CHECK ("warehouse_transfer_items"."quantity_received" is null or "warehouse_transfer_items"."quantity_received" >= 0)
);

CREATE TABLE "warehouse_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"number" text NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"status" "transfer_status" DEFAULT 'prepared' NOT NULL,
	"note" text,
	"idempotency_key" text,
	"created_by" uuid,
	"shipped_by" uuid,
	"received_by" uuid,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shipped_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "warehouse_transfers_different_warehouses" CHECK ("warehouse_transfers"."from_warehouse_id" <> "warehouse_transfers"."to_warehouse_id")
);

ALTER TABLE "stock_movements" ADD COLUMN "transfer_id" uuid;
ALTER TABLE "transfer_counters" ADD CONSTRAINT "transfer_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_transfer_id_warehouse_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."warehouse_transfers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "warehouse_transfer_items_transfer_product_unique" ON "warehouse_transfer_items" USING btree ("transfer_id","product_id");
CREATE INDEX "warehouse_transfer_items_transfer_idx" ON "warehouse_transfer_items" USING btree ("transfer_id");
CREATE UNIQUE INDEX "warehouse_transfers_shop_number_unique" ON "warehouse_transfers" USING btree ("shop_id","number");
CREATE UNIQUE INDEX "warehouse_transfers_shop_idempotency_unique" ON "warehouse_transfers" USING btree ("shop_id","idempotency_key") WHERE "warehouse_transfers"."idempotency_key" is not null;
CREATE INDEX "warehouse_transfers_shop_created_idx" ON "warehouse_transfers" USING btree ("shop_id","created_at" DESC NULLS LAST);
CREATE INDEX "warehouse_transfers_from_idx" ON "warehouse_transfers" USING btree ("shop_id","from_warehouse_id");
CREATE INDEX "warehouse_transfers_to_idx" ON "warehouse_transfers" USING btree ("shop_id","to_warehouse_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transfer_id_warehouse_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."warehouse_transfers"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "stock_movements_transfer_idx" ON "stock_movements" USING btree ("transfer_id");
