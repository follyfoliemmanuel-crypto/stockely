CREATE TABLE "warehouse_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_stock" (
	"shop_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_stock_pkey" PRIMARY KEY("warehouse_id","product_id"),
	CONSTRAINT "warehouse_stock_quantity_non_negative" CHECK ("warehouse_stock"."quantity" >= 0)
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_access" ADD CONSTRAINT "warehouse_access_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_access_warehouse_membership_unique" ON "warehouse_access" USING btree ("warehouse_id","membership_id");--> statement-breakpoint
CREATE INDEX "warehouse_access_membership_idx" ON "warehouse_access" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "warehouse_access_shop_idx" ON "warehouse_access" USING btree ("shop_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_stock_shop_product_idx" ON "warehouse_stock" USING btree ("shop_id","product_id");--> statement-breakpoint
CREATE INDEX "warehouse_stock_product_idx" ON "warehouse_stock" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_shop_code_unique" ON "warehouses" USING btree ("shop_id",upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_shop_default_unique" ON "warehouses" USING btree ("shop_id") WHERE "warehouses"."is_default" = true;--> statement-breakpoint
CREATE INDEX "warehouses_shop_active_idx" ON "warehouses" USING btree ("shop_id","is_active");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_shop_warehouse_idx" ON "sales" USING btree ("shop_id","warehouse_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_shop_warehouse_idx" ON "stock_movements" USING btree ("shop_id","warehouse_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_shop_idempotency_unique" ON "stock_movements" USING btree ("shop_id","idempotency_key") WHERE "stock_movements"."idempotency_key" is not null;--> statement-breakpoint
/* -------------------------------------------------------------------------- */
/* Reprise des données existantes : un entrepôt MAIN par entreprise.          */
/* Aucune donnée n'est supprimée ; products.quantity devient un cache du      */
/* total des entrepôts et l'invariant est vérifié avant validation.          */
/* -------------------------------------------------------------------------- */
INSERT INTO "warehouses" ("shop_id", "name", "code", "is_default", "is_active")
SELECT "id", 'Entrepôt principal', 'MAIN', true, true FROM "shops";--> statement-breakpoint
INSERT INTO "warehouse_stock" ("shop_id", "warehouse_id", "product_id", "quantity")
SELECT p."shop_id", w."id", p."id", p."quantity"
FROM "products" p
INNER JOIN "warehouses" w ON w."shop_id" = p."shop_id" AND w."code" = 'MAIN';--> statement-breakpoint
UPDATE "stock_movements" m
SET "warehouse_id" = w."id"
FROM "warehouses" w
WHERE w."shop_id" = m."shop_id" AND w."code" = 'MAIN' AND m."warehouse_id" IS NULL;--> statement-breakpoint
UPDATE "sales" s
SET "warehouse_id" = w."id"
FROM "warehouses" w
WHERE w."shop_id" = s."shop_id" AND w."code" = 'MAIN' AND s."warehouse_id" IS NULL;--> statement-breakpoint
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