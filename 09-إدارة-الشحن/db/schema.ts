import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const shippingBusinesses = sqliteTable("shipping_businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const shippingUsers = sqliteTable("shipping_users", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => shippingBusinesses.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role").notNull().default("owner"),
  emailVerified: integer("email_verified").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("shipping_users_email_unique").on(table.email),
  index("shipping_users_business_idx").on(table.businessId),
]);

export const shippingSessions = sqliteTable("shipping_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => shippingUsers.id, { onDelete: "cascade" }),
  businessId: text("business_id").notNull().references(() => shippingBusinesses.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("shipping_sessions_user_idx").on(table.userId),
  index("shipping_sessions_expiry_idx").on(table.expiresAt),
]);

export const shippingPendingAuth = sqliteTable("shipping_pending_auth", {
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  businessName: text("business_name"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  sentAt: integer("sent_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.email, table.purpose] }),
  index("shipping_pending_expiry_idx").on(table.expiresAt),
]);

export const shippingShipments = sqliteTable("shipping_shipments", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => shippingBusinesses.id, { onDelete: "cascade" }),
  customer: text("customer").notNull(),
  phone: text("phone").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  service: text("service").notNull(),
  status: text("status").notNull(),
  eta: text("eta").notNull(),
  driver: text("driver").notNull(),
  vehicle: text("vehicle").notNull(),
  progress: integer("progress").notNull(),
  amount: real("amount").notNull().default(0),
  weight: text("weight").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("shipping_shipments_business_created_idx").on(table.businessId, table.createdAt),
  index("shipping_shipments_business_status_idx").on(table.businessId, table.status),
]);

export const shippingSettings = sqliteTable("shipping_settings", {
  businessId: text("business_id").primaryKey().references(() => shippingBusinesses.id, { onDelete: "cascade" }),
  settingsJson: text("settings_json").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});
