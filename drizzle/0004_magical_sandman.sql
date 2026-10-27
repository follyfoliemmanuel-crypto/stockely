CREATE TYPE "public"."transfer_status" AS ENUM('prepared', 'shipped', 'received', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'warehouse_keeper' BEFORE 'cashier';--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'accountant' BEFORE 'viewer';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_out' BEFORE 'adjustment';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_in' BEFORE 'adjustment';--> statement-breakpoint
CREATE TABLE "transfer_counters" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"last_number" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "transfer_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_counters" ADD CONSTRAINT "transfer_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_transfer_id_warehouse_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."warehouse_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_transfer_items_transfer_product_unique" ON "warehouse_transfer_items" USING btree ("transfer_id","product_id");--> statement-breakpoint
CREATE INDEX "warehouse_transfer_items_transfer_idx" ON "warehouse_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_transfers_shop_number_unique" ON "warehouse_transfers" USING btree ("shop_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_transfers_shop_idempotency_unique" ON "warehouse_transfers" USING btree ("shop_id","idempotency_key") WHERE "warehouse_transfers"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "warehouse_transfers_shop_created_idx" ON "warehouse_transfers" USING btree ("shop_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "warehouse_transfers_from_idx" ON "warehouse_transfers" USING btree ("shop_id","from_warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_transfers_to_idx" ON "warehouse_transfers" USING btree ("shop_id","to_warehouse_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transfer_id_warehouse_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."warehouse_transfers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_transfer_idx" ON "stock_movements" USING btree ("transfer_id");