import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const user=sqliteTable("user",{id:text("id").primaryKey(),name:text("name").notNull(),email:text("email").notNull().unique(),emailVerified:integer("email_verified",{mode:"boolean"}).default(false).notNull(),image:text("image"),createdAt:integer("created_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).$onUpdate(()=>new Date()).notNull()});
export const session=sqliteTable("session",{id:text("id").primaryKey(),expiresAt:integer("expires_at",{mode:"timestamp_ms"}).notNull(),token:text("token").notNull().unique(),createdAt:integer("created_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).$onUpdate(()=>new Date()).notNull(),ipAddress:text("ip_address"),userAgent:text("user_agent"),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"})},t=>[index("session_userId_idx").on(t.userId)]);
export const account=sqliteTable("account",{id:text("id").primaryKey(),issuer:text("issuer").notNull(),accountId:text("account_id").notNull(),providerId:text("provider_id").notNull(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),accessToken:text("access_token"),refreshToken:text("refresh_token"),idToken:text("id_token"),accessTokenExpiresAt:integer("access_token_expires_at",{mode:"timestamp_ms"}),refreshTokenExpiresAt:integer("refresh_token_expires_at",{mode:"timestamp_ms"}),scope:text("scope"),password:text("password"),createdAt:integer("created_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).$onUpdate(()=>new Date()).notNull()},t=>[uniqueIndex("account_issuer_accountId_uidx").on(t.issuer,t.accountId),index("account_userId_idx").on(t.userId)]);
export const verification=sqliteTable("verification",{id:text("id").primaryKey(),identifier:text("identifier").notNull(),value:text("value").notNull(),expiresAt:integer("expires_at",{mode:"timestamp_ms"}).notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).$onUpdate(()=>new Date()).notNull()},t=>[index("verification_identifier_idx").on(t.identifier)]);
export const otpGuard=sqliteTable("otp_guard",{email:text("email").notNull(),purpose:text("purpose",{enum:["verify","reset"]}).notNull(),lastSentAt:integer("last_sent_at").notNull(),attempts:integer("attempts").default(0).notNull(),expiresAt:integer("expires_at").notNull()},t=>[primaryKey({columns:[t.email,t.purpose]})]);
export const rateLimit=sqliteTable("rate_limit",{id:text("id").primaryKey(),key:text("key").notNull().unique(),count:integer("count").notNull(),lastRequest:integer("last_request").notNull()});
export const cafeSettings=sqliteTable("cafe_settings",{
  id:text("id").primaryKey(),
  name:text("name").notNull(),
  branch:text("branch").notNull(),
  currency:text("currency").notNull(),
  language:text("language").notNull(),
  trn:text("trn").notNull(),
  phone:text("phone").notNull(),
  theme:text("theme").notNull(),
  printing:integer("printing",{mode:"boolean"}).notNull(),
  alerts:integer("alerts",{mode:"boolean"}).notNull(),
  routing:integer("routing",{mode:"boolean"}).notNull(),
  receipts:integer("receipts",{mode:"boolean"}).notNull(),
  usersJson:text("users_json").notNull(),
  updatedAt:integer("updated_at").notNull(),
});
export const userRelations=relations(user,({many})=>({sessions:many(session),accounts:many(account)}));
export const sessionRelations=relations(session,({one})=>({user:one(user,{fields:[session.userId],references:[user.id]})}));
export const accountRelations=relations(account,({one})=>({user:one(user,{fields:[account.userId],references:[user.id]})}));
