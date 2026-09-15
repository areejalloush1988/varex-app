import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const aiUsers = sqliteTable("ai_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  emailVerified: integer("email_verified").notNull().default(1),
  fullName: text("full_name"),
  businessName: text("business_name"),
  ...timestamps,
}, (table) => [uniqueIndex("ai_users_email_unique").on(table.email)]);

export const aiAuthOtps = sqliteTable("ai_auth_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  payload: text("payload"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("ai_auth_otps_email_purpose_idx").on(table.email, table.purpose, table.createdAt),
  index("ai_auth_otps_expiry_idx").on(table.expiresAt),
]);

export const aiSystemSecrets = sqliteTable("ai_system_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiSessions = sqliteTable("ai_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => aiUsers.id, { onDelete: "cascade" }),
  accessTokenHash: text("access_token_hash").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  accessExpiresAt: text("access_expires_at").notNull(),
  refreshExpiresAt: text("refresh_expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("ai_sessions_access_unique").on(table.accessTokenHash),
  uniqueIndex("ai_sessions_refresh_unique").on(table.refreshTokenHash),
  index("ai_sessions_user_idx").on(table.userId),
]);

export const aiOrganizations = sqliteTable("ai_organizations", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), name: text("name").notNull(),
  industry: text("industry"), status: text("status").notNull(), trialEndsAt: text("trial_ends_at").notNull(),
  timezone: text("timezone").notNull(), uiLanguage: text("ui_language").notNull(), uiTheme: text("ui_theme").notNull().default("navy"),
  requiresPriceApproval: integer("requires_price_approval").notNull(), auditEnabled: integer("audit_enabled").notNull(),
  autoPublish: integer("auto_publish").notNull(), vatEnabled: integer("vat_enabled").notNull(),
  legalName: text("legal_name"), trn: text("trn"), billingEmail: text("billing_email"), ...timestamps,
}, (table) => [index("ai_organizations_owner_idx").on(table.ownerId)]);

export const aiMembers = sqliteTable("ai_members", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), userId: text("user_id").notNull(),
  role: text("role").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("ai_members_org_user_unique").on(table.organizationId, table.userId),
  index("ai_members_user_idx").on(table.userId),
]);

export const aiAgents = sqliteTable("ai_agents", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), name: text("name").notNull(),
  role: text("role").notNull(), objective: text("objective"), language: text("language").notNull(), tone: text("tone").notNull(),
  channels: text("channels").notNull(), status: text("status").notNull(), requiresApproval: integer("requires_approval").notNull(),
  instructions: text("instructions"), createdBy: text("created_by"), ...timestamps,
}, (table) => [index("ai_agents_org_idx").on(table.organizationId, table.createdAt)]);

export const aiTasks = sqliteTable("ai_tasks", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), agentId: text("agent_id"),
  title: text("title").notNull(), instructions: text("instructions"), status: text("status").notNull(), priority: text("priority").notNull(),
  requiresApproval: integer("requires_approval").notNull(), output: text("output"), scheduledAt: text("scheduled_at"),
  startedAt: text("started_at"), completedAt: text("completed_at"), createdBy: text("created_by"), ...timestamps,
}, (table) => [index("ai_tasks_org_idx").on(table.organizationId, table.createdAt)]);

export const aiLeads = sqliteTable("ai_leads", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), name: text("name").notNull(),
  company: text("company"), service: text("service").notNull(), status: text("status").notNull(), source: text("source").notNull(),
  priority: text("priority").notNull(), score: integer("score").notNull(), nextAction: text("next_action"), notes: text("notes"), ...timestamps,
}, (table) => [index("ai_leads_org_idx").on(table.organizationId, table.createdAt)]);

export const aiApprovals = sqliteTable("ai_approvals", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), taskId: text("task_id"), title: text("title").notNull(),
  summary: text("summary"), status: text("status").notNull(), requestedBy: text("requested_by"), reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("ai_approvals_org_idx").on(table.organizationId, table.createdAt)]);

export const aiIntegrations = sqliteTable("ai_integrations", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), provider: text("provider").notNull(),
  status: text("status").notNull(), connectedAccount: text("connected_account"), lastSyncAt: text("last_sync_at"), metadata: text("metadata").notNull(), ...timestamps,
}, (table) => [uniqueIndex("ai_integrations_org_provider_unique").on(table.organizationId, table.provider)]);

export const aiOauthStates = sqliteTable("ai_oauth_states", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  stateHash: text("state_hash").notNull(),
  codeVerifier: text("code_verifier"),
  returnTo: text("return_to").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("ai_oauth_states_hash_unique").on(table.stateHash),
  index("ai_oauth_states_expiry_idx").on(table.expiresAt),
  index("ai_oauth_states_org_idx").on(table.organizationId, table.createdAt),
]);

export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), contactName: text("contact_name").notNull(),
  contactAddress: text("contact_address"), channel: text("channel").notNull(), direction: text("direction").notNull(), body: text("body").notNull(), sendStatus: text("send_status").notNull(),
  createdBy: text("created_by"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("ai_messages_org_idx").on(table.organizationId, table.createdAt)]);

export const aiKnowledgeItems = sqliteTable("ai_knowledge_items", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), title: text("title").notNull(),
  fileType: text("file_type"), fileSize: integer("file_size"), storagePath: text("storage_path"), status: text("status").notNull(),
  createdBy: text("created_by"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("ai_knowledge_org_idx").on(table.organizationId, table.createdAt)]);

export const aiSubscriptions = sqliteTable("ai_subscriptions", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), planCode: text("plan_code").notNull(),
  status: text("status").notNull(), agentLimit: integer("agent_limit"), monthlyTaskLimit: integer("monthly_task_limit").notNull(),
  trialEndsAt: text("trial_ends_at"), startsAt: text("starts_at").notNull(), renewsAt: text("renews_at"),
  billingCycle: text("billing_cycle").notNull(), paymentMethod: text("payment_method"), ...timestamps,
}, (table) => [index("ai_subscriptions_org_idx").on(table.organizationId, table.createdAt)]);

export const aiAuditLogs = sqliteTable("ai_audit_logs", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), userId: text("user_id"), action: text("action").notNull(),
  entityType: text("entity_type"), entityId: text("entity_id"), details: text("details").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("ai_audit_org_idx").on(table.organizationId, table.createdAt)]);
