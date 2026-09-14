-- PostgreSQL CMS baseline; apply once to an empty CMS database.

-- SQLite INTEGER is 64-bit: bigint retains its range; application timestamps remain ISO text.

CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "contents" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"status" text NOT NULL,
	"data" text NOT NULL,
	"updated_at" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "rates" (
	"id" text PRIMARY KEY NOT NULL,
	"count" bigint NOT NULL,
	"expires" bigint NOT NULL
);

CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL
);

CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"data" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"path" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "admin_memberships" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"data" text NOT NULL
);

CREATE TABLE "content_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"content_id" text NOT NULL,
	"asset_id" text NOT NULL
);

CREATE TABLE "asset_folders_map" (
	"asset_id" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL
);

CREATE TABLE "asset_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);

CREATE TABLE "navigation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL
);

CREATE TABLE "policies" (
	"kind" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"published" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "submission_files" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"field_id" text NOT NULL,
	"session" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"submission_id" text,
	"created_at" text NOT NULL
);

CREATE TABLE "submission_history" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"actor" text NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "submission_workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "marketing_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"asset_id" text NOT NULL,
	FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant" text NOT NULL,
	"quantity" bigint NOT NULL,
	"updated_at" text NOT NULL,
	FOREIGN KEY ("product_id") REFERENCES "contents"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "order_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"data" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "order_counters" (
	"day" text PRIMARY KEY NOT NULL,
	"sequence" bigint NOT NULL
);

CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
    "order_number" text,
	"user_id" text NOT NULL,
	"request_key" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal" bigint NOT NULL,
	"shipping" bigint NOT NULL,
	"total" bigint NOT NULL,
	"data" text NOT NULL,
	"sandbox" bigint DEFAULT 0 NOT NULL,
	"paid" bigint DEFAULT 0 NOT NULL,
	"refunded" bigint DEFAULT 0 NOT NULL,
	"restocked" bigint DEFAULT 0 NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "order_files" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"mime" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "order_history" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"data" text NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant" text NOT NULL,
	"quantity" bigint NOT NULL,
	"unit_price" bigint NOT NULL,
	"snapshot" text NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("product_id") REFERENCES "contents"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "content_kind_slug" ON "contents" ("kind","slug");

CREATE INDEX "content_status_kind" ON "contents" ("status","kind");

CREATE INDEX "submissions_form" ON "submissions" ("form_id");

CREATE INDEX "visits_created" ON "visits" ("created_at");

CREATE INDEX "category_kind_parent" ON "categories" ("kind","parent_id");

CREATE INDEX "content_asset_lookup" ON "content_assets" ("asset_id","content_id");

CREATE INDEX "submission_history_lookup" ON "submission_history" ("submission_id","created_at");

CREATE INDEX "audit_created" ON "audit_logs" ("created_at","id");

CREATE INDEX "audit_action_created" ON "audit_logs" ("action","created_at");

CREATE INDEX "content_kind_updated" ON "contents" ("kind","updated_at","id");

CREATE INDEX "submissions_created" ON "submissions" ("created_at","id");

CREATE UNIQUE INDEX product_spu_unique ON contents (lower((data::jsonb->>'spu'))) WHERE kind='products' AND (data::jsonb->>'spu') IS NOT NULL AND (data::jsonb->>'spu')<>'';

CREATE UNIQUE INDEX "cart_user_variant" ON "cart_items" ("user_id","product_id","variant");

CREATE UNIQUE INDEX "order_item_variant" ON "order_items" ("order_id","product_id","variant");

CREATE INDEX "order_items_product" ON "order_items" ("product_id");

CREATE UNIQUE INDEX "orders_request" ON "orders" ("user_id","request_key");

CREATE INDEX "orders_user_created" ON "orders" ("user_id","created_at");

CREATE INDEX "orders_status_expires" ON "orders" ("status","expires_at");

CREATE UNIQUE INDEX "orders_number" ON "orders" ("order_number");
