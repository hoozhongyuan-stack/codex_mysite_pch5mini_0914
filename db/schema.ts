import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const contents = sqliteTable(
  'contents',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    slug: text('slug').notNull(),
    status: text('status').notNull(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('product_spu_unique')
      .on(sql`lower(json_extract(${t.data}, '$.spu'))`)
      .where(
        sql`${t.kind}='products' AND json_extract(${t.data}, '$.spu') IS NOT NULL AND json_extract(${t.data}, '$.spu')<>''`,
      ),
    uniqueIndex('content_kind_slug').on(t.kind, t.slug),
    index('content_status_kind').on(t.status, t.kind),
    index('content_kind_updated').on(t.kind, t.updatedAt, t.id),
  ],
);
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
});
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: text('created_at').notNull(),
});
export const submissions = sqliteTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    formId: text('form_id').notNull(),
    data: text('data').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('submissions_form').on(t.formId),
    index('submissions_created').on(t.createdAt, t.id),
  ],
);
export const visits = sqliteTable(
  'visits',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    source: text('source').notNull(),
    path: text('path').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('visits_created').on(t.createdAt)],
);
export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  createdAt: text('created_at').notNull(),
});
export const rates = sqliteTable('rates', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    parentId: text('parent_id'),
    data: text('data').notNull(),
  },
  (t) => [index('category_kind_parent').on(t.kind, t.parentId)],
);
export const folders = sqliteTable('asset_folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});
export const folderAssignments = sqliteTable('asset_folders_map', {
  assetId: text('asset_id').primaryKey(),
  folderId: text('folder_id').notNull(),
});
export const contentAssets = sqliteTable(
  'content_assets',
  {
    id: text('id').primaryKey(),
    contentId: text('content_id').notNull(),
    assetId: text('asset_id').notNull(),
  },
  (t) => [index('content_asset_lookup').on(t.assetId, t.contentId)],
);
export const navigation = sqliteTable('navigation_items', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
});
export const admins = sqliteTable('admin_memberships', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
});
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    target: text('target').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('audit_created').on(t.createdAt, t.id),
    index('audit_action_created').on(t.action, t.createdAt),
  ],
);
export const policies = sqliteTable('policies', {
  kind: text('kind').primaryKey(),
  data: text('data').notNull(),
  published: text('published'),
  version: integer('version').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const submissionFiles = sqliteTable('submission_files', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  fieldId: text('field_id').notNull(),
  session: text('session').notNull(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  submissionId: text('submission_id'),
  createdAt: text('created_at').notNull(),
});

export const submissionWorkflows = sqliteTable('submission_workflows', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull(),
});
export const submissionHistory = sqliteTable(
  'submission_history',
  {
    id: text('id').primaryKey(),
    submissionId: text('submission_id').notNull(),
    actor: text('actor').notNull(),
    status: text('status').notNull(),
    note: text('note').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('submission_history_lookup').on(t.submissionId, t.createdAt)],
);

export const marketingAssets = sqliteTable('marketing_assets', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  assetId: text('asset_id').notNull().references(() => assets.id),
});

export const orderCounters = sqliteTable('order_counters', { day:text('day').primaryKey(), sequence:integer('sequence').notNull() });
export const orders = sqliteTable('orders', {
  orderNumber:text('order_number'),
  id:text('id').primaryKey(), userId:text('user_id').notNull(), requestKey:text('request_key').notNull(),
  status:text('status').notNull(), currency:text('currency').notNull(), subtotal:integer('subtotal').notNull(),
  shipping:integer('shipping').notNull(), total:integer('total').notNull(), data:text('data').notNull(),
  sandbox:integer('sandbox').notNull().default(0), paid:integer('paid').notNull().default(0),
  refunded:integer('refunded').notNull().default(0), restocked:integer('restocked').notNull().default(0),
  expiresAt:text('expires_at').notNull(), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('orders_number').on(t.orderNumber),uniqueIndex('orders_request').on(t.userId,t.requestKey),index('orders_user_created').on(t.userId,t.createdAt),index('orders_status_expires').on(t.status,t.expiresAt)]);
export const orderItems=sqliteTable('order_items',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull().references(()=>orders.id),productId:text('product_id').notNull().references(()=>contents.id),variant:text('variant').notNull(),quantity:integer('quantity').notNull(),unitPrice:integer('unit_price').notNull(),snapshot:text('snapshot').notNull(),
},t=>[uniqueIndex('order_item_variant').on(t.orderId,t.productId,t.variant),index('order_items_product').on(t.productId)]);
export const orderHistory=sqliteTable('order_history',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull().references(()=>orders.id),actor:text('actor').notNull(),action:text('action').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),
});
export const cartItems=sqliteTable('cart_items',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),productId:text('product_id').notNull().references(()=>contents.id),variant:text('variant').notNull(),quantity:integer('quantity').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('cart_user_variant').on(t.userId,t.productId,t.variant)]);
export const orderAddresses=sqliteTable('order_addresses',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),data:text('data').notNull(),updatedAt:text('updated_at').notNull(),
});
export const orderFiles=sqliteTable('order_files',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull().references(()=>orders.id),userId:text('user_id').notNull(),purpose:text('purpose').notNull(),mime:text('mime').notNull(),name:text('name').notNull(),createdAt:text('created_at').notNull(),
});

export const behaviorEvents=sqliteTable('behavior_events',{
 id:text('id').primaryKey(),channel:text('channel').notNull(),visitorHash:text('visitor_hash').notNull(),sessionHash:text('session_hash').notNull(),event:text('event').notNull(),path:text('path').notNull(),target:text('target').notNull().default(''),createdAt:text('created_at').notNull(),
},t=>[index('behavior_time_channel').on(t.createdAt,t.channel)]);
export const behaviorMetadata=sqliteTable('behavior_metadata',{id:text('id').primaryKey(),startedAt:text('started_at').notNull()});
