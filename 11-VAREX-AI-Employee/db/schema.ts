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
  actionExecutionId: text("action_execution_id"),
  summary: text("summary"), status: text("status").notNull(), requestedBy: text("requested_by"), reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("ai_approvals_org_idx").on(table.organizationId, table.createdAt),
  index("ai_approvals_action_execution_idx").on(table.actionExecutionId),
]);

export const aiIntegrations = sqliteTable("ai_integrations", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), provider: text("provider").notNull(),
  status: text("status").notNull(), connectedAccount: text("connected_account"), lastSyncAt: text("last_sync_at"), metadata: text("metadata").notNull(), ...timestamps,
}, (table) => [uniqueIndex("ai_integrations_org_provider_unique").on(table.organizationId, table.provider)]);

export const aiDeviceConnections = sqliteTable("ai_device_connections", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(), deviceName: text("device_name").notNull(), platform: text("platform").notNull(),
  status: text("status").notNull(), appVersion: text("app_version"), capabilities: text("capabilities").notNull(),
  lastSeenAt: text("last_seen_at"), ...timestamps,
}, (table) => [
  uniqueIndex("ai_device_connections_org_device_unique").on(table.organizationId, table.deviceId),
  index("ai_device_connections_org_idx").on(table.organizationId, table.updatedAt),
]);

export const aiAgentPermissions = sqliteTable("ai_agent_permissions", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), agentId: text("agent_id").notNull(),
  appKey: text("app_key").notNull(), actionKey: text("action_key").notNull(), mode: text("mode").notNull(),
  riskLevel: text("risk_level").notNull(), updatedBy: text("updated_by"), ...timestamps,
}, (table) => [
  uniqueIndex("ai_agent_permissions_action_unique").on(table.organizationId, table.agentId, table.appKey, table.actionKey),
  index("ai_agent_permissions_agent_idx").on(table.organizationId, table.agentId, table.updatedAt),
]);

export const aiActionExecutions = sqliteTable("ai_action_executions", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), agentId: text("agent_id"),
  taskId: text("task_id"), appKey: text("app_key").notNull(), actionKey: text("action_key").notNull(),
  permissionMode: text("permission_mode").notNull(), status: text("status").notNull(), target: text("target"),
  deviceId: text("device_id"), claimedAt: text("claimed_at"),
  requestPayload: text("request_payload").notNull(), resultSummary: text("result_summary"),
  resultDetails: text("result_details").notNull(), errorCode: text("error_code"), approvedBy: text("approved_by"),
  approvedAt: text("approved_at"), startedAt: text("started_at"), completedAt: text("completed_at"),
  createdBy: text("created_by"), ...timestamps,
}, (table) => [
  index("ai_action_executions_org_idx").on(table.organizationId, table.createdAt),
  index("ai_action_executions_task_idx").on(table.taskId, table.createdAt),
  index("ai_action_executions_device_queue_idx").on(table.organizationId, table.deviceId, table.status, table.createdAt),
]);

export const aiChatMessages = sqliteTable("ai_chat_messages", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id"),
  userId: text("user_id"),
  role: text("role").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("text"),
  clientMessageId: text("client_message_id"),
  actionExecutionId: text("action_execution_id"),
  metadata: text("metadata").notNull(),
  ...timestamps,
}, (table) => [
  index("ai_chat_messages_thread_idx").on(table.organizationId, table.agentId, table.createdAt),
  index("ai_chat_messages_execution_idx").on(table.actionExecutionId),
  uniqueIndex("ai_chat_messages_client_unique").on(table.organizationId, table.userId, table.clientMessageId),
]);

export const aiVoiceSettings = sqliteTable("ai_voice_settings", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), agentId: text("agent_id").notNull(),
  provider: text("provider").notNull(), status: text("status").notNull(), callerId: text("caller_id"),
  voiceId: text("voice_id"), disclosureText: text("disclosure_text").notNull(), settings: text("settings").notNull(),
  updatedBy: text("updated_by"), ...timestamps,
}, (table) => [
  uniqueIndex("ai_voice_settings_agent_unique").on(table.organizationId, table.agentId),
  index("ai_voice_settings_org_idx").on(table.organizationId, table.updatedAt),
]);

export const aiVoiceCalls = sqliteTable("ai_voice_calls", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id").notNull(),
  actionExecutionId: text("action_execution_id"),
  providerCallId: text("provider_call_id"),
  openaiSessionId: text("openai_session_id"),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  contactName: text("contact_name"),
  purpose: text("purpose").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  startedAt: text("started_at"),
  answeredAt: text("answered_at"),
  completedAt: text("completed_at"),
  metadata: text("metadata").notNull(),
  ...timestamps,
}, (table) => [
  index("ai_voice_calls_org_idx").on(table.organizationId, table.createdAt),
  index("ai_voice_calls_agent_idx").on(table.organizationId, table.agentId, table.createdAt),
  uniqueIndex("ai_voice_calls_provider_unique").on(table.providerCallId),
  uniqueIndex("ai_voice_calls_execution_unique").on(table.actionExecutionId),
]);

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

export const aiActivationCodes = sqliteTable("ai_activation_codes", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull(),
  codePrefix: text("code_prefix").notNull(),
  status: text("status").notNull(),
  createdBy: text("created_by").notNull(),
  redeemedBy: text("redeemed_by"),
  redeemedOrganizationId: text("redeemed_organization_id"),
  redeemedAt: text("redeemed_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("ai_activation_codes_hash_unique").on(table.codeHash),
  index("ai_activation_codes_status_idx").on(table.status, table.createdAt),
  index("ai_activation_codes_redeemed_org_idx").on(table.redeemedOrganizationId),
]);

export const aiPayments = sqliteTable("ai_payments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  createdBy: text("created_by").notNull(),
  provider: text("provider").notNull(),
  providerOrderId: text("provider_order_id").notNull(),
  providerCaptureId: text("provider_capture_id"),
  planCode: text("plan_code").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  payerEmail: text("payer_email"),
  ...timestamps,
}, (table) => [
  uniqueIndex("ai_payments_provider_order_unique").on(table.provider, table.providerOrderId),
  uniqueIndex("ai_payments_provider_capture_unique").on(table.provider, table.providerCaptureId),
  index("ai_payments_org_idx").on(table.organizationId, table.createdAt),
]);

export const aiAuditLogs = sqliteTable("ai_audit_logs", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), userId: text("user_id"), action: text("action").notNull(),
  entityType: text("entity_type"), entityId: text("entity_id"), details: text("details").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("ai_audit_org_idx").on(table.organizationId, table.createdAt)]);
