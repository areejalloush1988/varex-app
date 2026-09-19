export type AiProvider = "openai" | "gemini";

export type AiActionRequest = {
  appKey: string;
  actionKey: string;
  target: string;
  payload: Record<string, unknown>;
};

export type AiProviderReply = {
  provider: AiProvider;
  model: string;
  kind: "text" | "action" | "report";
  text?: string;
  action?: AiActionRequest;
  sources?: Array<{ title: string; url: string }>;
};

export type AiConversationContext = {
  agentName: string;
  agentRole: string;
  userName?: string;
  agentObjective?: string;
  agentInstructions?: string;
  language?: string;
  audience?: "owner" | "customer";
  customerName?: string;
  businessName?: string;
  trustedWebsites?: Array<{ name: string; url: string }>;
  actionCatalog: string;
  transcript: Array<{ role: string; body: string }>;
};

export const OPENAI_MODEL = "gpt-6-astra";
export const OPENAI_FALLBACK_MODEL = "gpt-5.6-sol";
export const GEMINI_MODEL = "gemini-3.6-flash";
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const GEMINI_VOICES = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia",
  "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix",
  "Sadachbia", "Sadaltager", "Sulafat",
]);

const actionProperties = {
  app_key: {
    type: "string",
    enum: ["email", "contacts", "calendar", "alarms", "phone", "voice", "whatsapp", "facebook", "instagram", "tiktok", "youtube", "settings", "parking"],
    description: "The VAREX application that must perform the action.",
  },
  action_key: {
    type: "string",
    enum: [
      "read", "create_draft", "edit_draft", "send", "reply", "forward", "download_attachments", "trash", "delete_permanent",
      "view", "search", "create", "edit", "delete", "cancel", "enable", "disable", "lookup", "start_call", "redial",
      "transfer", "speak_on_behalf", "transcribe", "record", "summarize", "draft", "follow_up", "upload", "manage",
      "open", "change", "start_session", "extend", "pay", "publish", "list_posts", "read_comments", "reply_comment", "publish_video",
    ],
    description: "The exact VAREX action key supported by the selected application.",
  },
  target: { type: "string", description: "Recipient, contact, number, record, setting, or other target. Use an empty string only when the action genuinely has no target." },
  message: {
    type: ["string", "null"],
    description: "Final recipient-ready message when sending or replying; otherwise null. Understand the user's meaning and rewrite indirect speech naturally. Never copy orchestration phrases such as 'send a message', 'tell him', the recipient name, or the app name into the message body.",
  },
  instruction: { type: ["string", "null"], description: "The user's complete action instruction, including time and details; otherwise null." },
  media_url: { type: ["string", "null"], description: "A public HTTPS image or video URL explicitly supplied by the user; otherwise null. Never invent one." },
  link: { type: ["string", "null"], description: "A public HTTPS link explicitly supplied by the user for the post; otherwise null." },
  comment_id: { type: ["string", "null"], description: "The exact social comment identifier when replying; otherwise null." },
  privacy_level: { type: ["string", "null"], enum: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY", null], description: "TikTok privacy level explicitly chosen by the user; use SELF_ONLY if not specified." },
  limit: { type: ["integer", "null"], minimum: 1, maximum: 25, description: "Number of linked-account records to read; otherwise null." },
};

function latestUserText(context: AiConversationContext) {
  return [...context.transcript].reverse().find(item => item.role !== "assistant")?.body || "";
}

function isDeepResearchRequest(context: AiConversationContext) {
  const text = latestUserText(context).toLocaleLowerCase();
  const explicit = /(بحث\s*(عميق|موسع|شامل|كامل)|deep\s*research|comprehensive\s*research|دراسة\s*(مفصلة|شاملة)|تقرير\s*(مفصل|شامل))/i.test(text);
  const largeBatch = /(?:^|\D)(?:[2-9]\d|[1-9]\d{2,})(?:\D|$)/.test(text) && /(شركة|شركات|فرصة|وظيفة|موقع|مصدر|نتيجة|company|companies|jobs?|sources?|results?)/i.test(text);
  return explicit || largeBatch;
}

function isCasualGreeting(context: AiConversationContext) {
  const text = latestUserText(context).trim();
  if (!text || text.length > 90) return false;
  return /^(?:(?:هاي|هلا|مرحبا|أهلا|اهلا|السلام\s+عليكم|صباح\s+الخير|مساء\s+الخير)(?:\s+(?:كيفك|كيف\s+الحال|شو\s+(?:الأخبار|الاخبار)))?|hi|hello|hey|good\s+(?:morning|evening))[\s؟?!.,،]*$/iu.test(text);
}

function openAiTools(context: AiConversationContext) {
  const deepResearch = isDeepResearchRequest(context);
  return [
    {
      type: "web_search",
      search_context_size: "high",
      ...(deepResearch ? { return_token_budget: "unlimited" } : {}),
    },
    {
      type: "function",
      name: "run_employee_action",
      description: "Run one real action through the VAREX permission and approval system. Use semantic understanding to separate the target from the final content. Never claim an action happened without calling this function.",
      strict: true,
      parameters: { type: "object", properties: actionProperties, required: Object.keys(actionProperties), additionalProperties: false },
    },
    {
      type: "function",
      name: "get_execution_report",
      description: "Get a truthful report of recent VAREX actions and their real statuses.",
      strict: true,
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  ];
}

function geminiTools() {
  const properties = {
    ...actionProperties,
    message: { type: "string", description: "Final recipient-ready message when sending, publishing, or replying. Rewrite indirect speech naturally and exclude orchestration words, recipient names, and app names. Use an empty string otherwise." },
    instruction: { type: "string", description: "The user's complete action instruction, including time and details. Use an empty string otherwise." },
    media_url: { type: "string", description: "A public HTTPS image or video URL explicitly supplied by the user. Use an empty string otherwise." },
    link: { type: "string", description: "A public HTTPS link explicitly supplied by the user. Use an empty string otherwise." },
    comment_id: { type: "string", description: "The exact social comment identifier. Use an empty string otherwise." },
    privacy_level: { type: "string", description: "TikTok privacy level or SELF_ONLY when not specified." },
    limit: { type: "integer", description: "Number of records to read, between 1 and 25. Use 10 otherwise." },
  };
  return [
    { type: "google_search" },
    {
      type: "function",
      name: "run_employee_action",
      description: "Run one real action through the VAREX permission and approval system. Never claim an action happened without calling this function.",
      parameters: { type: "object", properties, required: Object.keys(properties) },
    },
    {
      type: "function",
      name: "get_execution_report",
      description: "Get a truthful report of recent VAREX actions and their real statuses.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  ];
}

function systemInstruction(context: AiConversationContext) {
  if (context.audience === "customer") {
    return [
      `أنت ${context.agentName}، موظف ${context.agentRole || "خدمة عملاء"} لدى ${context.businessName || "الشركة"}. ترد الآن على عميل عبر WhatsApp باسم ${context.customerName || "العميل"}.`,
      context.agentObjective ? `هدفك المهني: ${context.agentObjective}.` : "",
      context.agentInstructions ? `تعليمات الشركة التي يجب الالتزام بها: ${context.agentInstructions}.` : "",
      "اكتب رداً واحداً جاهزاً للإرسال للعميل، طبيعياً ومختصراً ومفيداً، وبنفس لغة وأسلوب العميل. لا تشرح خطواتك ولا تضف عنواناً مثل «الرد المقترح».",
      "حافظ على سياق الرسائل السابقة، وأجب فقط بما تعرفه من المحادثة وتعليمات الشركة. إذا كانت المعلومة غير متوفرة فقل بلطف إن الفريق سيتحقق منها ويتابع معه؛ لا تخترع معلومة.",
      "لا تبتكر سعراً أو خصماً أو بند عقد أو طريقة دفع أو استرداداً أو ضماناً أو التزاماً قانونياً أو موعد تسليم. يمكنك فقط إعادة معلومة صريحة موجودة في السياق، وإلا اطلب من الفريق تأكيدها.",
      "لا تنفذ أدوات أو عمليات ولا تدّعِ إرسال ملف أو إجراء حجز أو دفع. مهمتك هنا صياغة الرد النصي فقط.",
      "هويتك أمام العميل هي موظف ذكي داخل VAREX AI. لا تكشف اسم مزود النموذج أو النموذج أو المفتاح أو البنية الداخلية.",
      context.trustedWebsites?.length ? `هذه مواقع عامة اعتمدتها الشركة كمرجع عند وجود معلومة صريحة في سياق المحادثة:\n${context.trustedWebsites.map(site => `- ${site.name}: ${site.url}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
  }
  const accountName = String(context.userName || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return [
    `أنت ${context.agentName}، موظف ذكي حقيقي داخل VAREX AI. دورك: ${context.agentRole || "مساعد تنفيذي"}.`,
    accountName ? `اسم صاحب الحساب الذي تحادثه الآن هو «${accountName}». استخدم اسمه الأول بصورة طبيعية عند التحية أو عندما يخدم السياق، واكتبه بحروف لغة المحادثة إن كان ذلك طبيعياً، ولا تكرره في كل رد.` : "",
    context.agentObjective ? `هدفك: ${context.agentObjective}.` : "",
    context.agentInstructions ? `تعليمات المالك: ${context.agentInstructions}.` : "",
    "أنت شريك عمل ومساعد تنفيذي، ولست محلل كلمات مفتاحية. افهم المقصود والسياق والضمائر قبل الرد أو التنفيذ، وناقش المستخدم وانصحه عندما يكون القرار غير مناسب.",
    "أجب مباشرة وبذكاء عن الأسئلة العامة والمهنية، واحتفظ بسياق المحادثة. تحدث بلغة المستخدم وبأسلوب طبيعي دافئ، وبالعربية الشامية عندما يكتب المستخدم بها.",
    "لا تبدأ المحادثة بتعريف نفسك ولا تعرض قائمة بما تستطيع فعله من تلقاء نفسك. إذا قال المستخدم «هاي» أو أرسل تحية قصيرة فقط، رد بتحية قصيرة بشرية باستخدام اسمه الأول واسأله سؤالاً طبيعياً واحداً مثل ما الذي يريد العمل عليه. لا تعطِه نصاً تعليمياً محفوظاً.",
    "تعامل مع كل رسالة كجزء من حوار مستمر: أجب على النقطة الحالية، تذكّر ما قيل قبلها، واسأل للتوضيح فقط عندما تكون المعلومة الناقصة مؤثرة فعلاً.",
    "هويتك أمام المستخدم هي VAREX AI فقط. لا تكشف أو تسمّي مزوّد النموذج أو اسم النموذج أو المفتاح أو البنية الداخلية، وإذا سُئلت عمّن يشغّلك فقل إنك موظف ذكي داخل VAREX AI.",
    "إذا طلب المستخدم بحثاً حديثاً أو شركات أو فرصاً أو أسعاراً أو معلومات من الإنترنت، استخدم بحث الويب فعلياً ثم قدم نتائج محددة مع روابط المصادر. في البحث الواسع استخدم عدة عمليات بحث، قارن مصادر مستقلة وموثوقة، وافصل بوضوح بين الحقائق والاستنتاجات. لا تختلق شركة أو فرصة أو وسيلة تواصل.",
    "يمكنك البحث في صفحات الإنترنت العامة القابلة للوصول والفهرسة فقط. لا تدّعِ الوصول إلى حساب خاص أو مجموعة مغلقة أو صفحة تتطلب تسجيل دخول. للبحث العام داخل شبكة اجتماعية استخدم بحث الويب، وللقراءة أو النشر داخل حساب المالك استخدم أداة الحساب المرتبط فقط.",
    context.trustedWebsites?.length ? `المواقع التي أضافها المالك كمصادر معتمدة؛ ارجع إليها عند صلتها بالمهمة واذكر الرابط، من دون اعتبارها المصدر الوحيد:\n${context.trustedWebsites.map(site => `- ${site.name}: ${site.url}`).join("\n")}` : "",
    "إذا كان الطلب سؤالاً أو شرحاً فأجب مباشرة ولا تستدعِ أداة تنفيذ. إذا طلب المستخدم فعلاً على حساب أو هاتف، استدعِ أداة VAREX المناسبة فقط.",
    "في الرسائل: افصل دائماً بين تعليمات المالك وبين النص النهائي للمستلم. لا تنسخ الأمر كله. احذف عبارات مثل «ابعت رسالة»، «قل له»، اسم المستلم واسم التطبيق، ثم صغ المعنى رسالة بشرية طبيعية جاهزة للإرسال من دون إضافة وقائع لم يقلها المالك.",
    "مثال دلالي: «ابعت واتساب لأبو كرم وقل له إن زوجتك عم تطلب منك تنزّل التطبيق الجديد» يعني target=أبو كرم وmessage=«زوجتك عم تطلب منك تنزّل التطبيق الجديد»؛ لا ترسل الأمر الأصلي نفسه.",
    "لا تقل أبداً إنك نفذت أو أرسلت أو اتصلت أو حذفت قبل أن تعيد أداة VAREX نتيجة حقيقية. الصلاحيات والموافقات يفرضها الخادم ولا يجوز تجاوزها.",
    "إذا نقص اسم المستلم أو الرقم أو النص أو الوقت، اسأل سؤالاً قصيراً واحداً قبل استدعاء الأداة. لا تخمّن بيانات حساسة.",
    "النشر على Facebook أو Instagram أو TikTok عملية حساسة: استخدم الحساب المرتبط والصلاحية المحددة فقط، ولا تتجاوز شاشة موافقة VAREX. إذا احتاج المنشور صورة أو فيديو أو معرّف تعليق ولم يقدمه المستخدم فاسأله بدلاً من التخمين.",
    "لا تنفذ أكثر من عملية حساسة في الاستدعاء الواحد. لخص النتيجة الحقيقية للمستخدم ولا تختلق تقارير.",
    `العمليات المتاحة:\n${context.actionCatalog}`,
  ].filter(Boolean).join("\n");
}

function conversationInput(context: AiConversationContext) {
  const otherParty = context.audience === "customer" ? (context.customerName || "العميل") : (context.userName || "صاحب الحساب");
  const recent = context.transcript.slice(-40).map(item => `${item.role === "assistant" ? context.agentName : otherParty}: ${item.body}`).join("\n");
  return `هذه آخر المحادثة، وآخر سطر هو الطلب الحالي:\n${recent}`;
}

function actionFromArguments(value: unknown): AiActionRequest | null {
  const args = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const appKey = String(args.app_key || "").trim(), actionKey = String(args.action_key || "").trim();
  if (!appKey || !actionKey) return null;
  const message = String(args.message || "").trim(), instruction = String(args.instruction || "").trim();
  const mediaUrl = String(args.media_url || "").trim(), link = String(args.link || "").trim(), commentId = String(args.comment_id || "").trim();
  const privacyLevel = String(args.privacy_level || "").trim(), limit = Number(args.limit || 0);
  return {
    appKey,
    actionKey,
    target: String(args.target || "").trim(),
    payload: {
      ...(message ? { message } : {}),
      ...(instruction ? { instruction } : {}),
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      ...(link ? { link } : {}),
      ...(commentId ? { comment_id: commentId } : {}),
      ...(privacyLevel ? { privacy_level: privacyLevel } : {}),
      ...(Number.isInteger(limit) && limit > 0 ? { limit: Math.min(limit, 25) } : {}),
    },
  };
}

function providerError(provider: AiProvider, status: number, payload: unknown) {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = row.error && typeof row.error === "object" ? row.error as Record<string, unknown> : {};
  const message = String(nested.message || row.message || `HTTP ${status}`).replace(/\s+/g, " ").slice(0, 240);
  return new Error(`${provider.toUpperCase()}_REQUEST_FAILED: ${message}`);
}

async function callOpenAIModel(apiKey: string, context: AiConversationContext, model: string): Promise<AiProviderReply> {
  const customerMode = context.audience === "customer";
  const deepResearch = !customerMode && isDeepResearchRequest(context);
  const casualGreeting = !customerMode && isCasualGreeting(context);
  const requestBody: Record<string, unknown> = {
    model,
    reasoning: { effort: customerMode || casualGreeting ? "low" : deepResearch ? "xhigh" : "high" },
    instructions: systemInstruction(context),
    input: conversationInput(context),
    max_output_tokens: customerMode ? 650 : casualGreeting ? 450 : deepResearch ? 5200 : 2600,
    store: false,
  };
  if (!customerMode) Object.assign(requestBody, {
    tools: openAiTools(context),
    tool_choice: "auto",
    parallel_tool_calls: false,
    include: ["web_search_call.action.sources"],
  });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw providerError("openai", response.status, data);
  const output = Array.isArray(data.output) ? data.output as Array<Record<string, unknown>> : [];
  const tool = output.find(item => item.type === "function_call");
  if (tool) {
    const name = String(tool.name || "");
    if (name === "get_execution_report") return { provider: "openai", model, kind: "report" };
    if (name === "run_employee_action") {
      let args: unknown = tool.arguments;
      if (typeof args === "string") try { args = JSON.parse(args); } catch (_) { args = {}; }
      const action = actionFromArguments(args);
      if (action) return { provider: "openai", model, kind: "action", action };
    }
  }
  const parts: string[] = [], sources = new Map<string, string>();
  for (const item of output) {
    if (item.type === "web_search_call" && item.action && typeof item.action === "object") {
      const action = item.action as Record<string, unknown>;
      const rows = Array.isArray(action.sources) ? action.sources as Array<Record<string, unknown>> : [];
      for (const source of rows) {
        const url = String(source.url || "").trim();
        if (url.startsWith("https://") || url.startsWith("http://")) sources.set(url, String(source.title || url).trim());
      }
    }
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && content.text) parts.push(String(content.text));
      const annotations = Array.isArray(content.annotations) ? content.annotations as Array<Record<string, unknown>> : [];
      for (const annotation of annotations) {
        const url = String(annotation.url || "").trim();
        if (url.startsWith("https://") || url.startsWith("http://")) sources.set(url, String(annotation.title || url).trim());
      }
    }
  }
  const text = String(data.output_text || parts.join("\n")).trim();
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return { provider: "openai", model, kind: "text", text, sources: [...sources].slice(0, deepResearch ? 25 : 12).map(([url, title]) => ({ title, url })) };
}

async function callOpenAI(apiKey: string, context: AiConversationContext): Promise<AiProviderReply> {
  try {
    return await callOpenAIModel(apiKey, context, OPENAI_MODEL);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught || "");
    if (!/model.*not found|not found.*model|unsupported model|does not exist|access to model/i.test(message)) throw caught;
    return callOpenAIModel(apiKey, context, OPENAI_FALLBACK_MODEL);
  }
}

async function callGeminiModel(apiKey: string, context: AiConversationContext, model: string): Promise<AiProviderReply> {
  const customerMode = context.audience === "customer";
  const requestBody: Record<string, unknown> = {
    model,
    store: false,
    system_instruction: systemInstruction(context),
    input: conversationInput(context),
    generation_config: { ...(customerMode ? {} : { tool_choice: "auto" }), temperature: 0.35, max_output_tokens: customerMode ? 650 : 1800 },
  };
  if (!customerMode) requestBody.tools = geminiTools();
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw providerError("gemini", response.status, data);
  const steps = Array.isArray(data.steps) ? data.steps as Array<Record<string, unknown>> : [];
  const tool = steps.find(step => step.type === "function_call");
  if (tool) {
    const name = String(tool.name || "");
    if (name === "get_execution_report") return { provider: "gemini", model, kind: "report" };
    if (name === "run_employee_action") {
      const action = actionFromArguments(tool.arguments);
      if (action) return { provider: "gemini", model, kind: "action", action };
    }
  }
  const parts: string[] = [];
  for (const step of steps) {
    if (step.type !== "model_output" || !Array.isArray(step.content)) continue;
    for (const content of step.content as Array<Record<string, unknown>>) if (content.type === "text" && content.text) parts.push(String(content.text));
  }
  const text = parts.join("\n").trim();
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return { provider: "gemini", model, kind: "text", text };
}

async function callGemini(apiKey: string, context: AiConversationContext): Promise<AiProviderReply> {
  const failures: string[] = [];
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
    try {
      return await callGeminiModel(apiKey, context, model);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught || "GEMINI_REQUEST_FAILED");
      failures.push(`${model}: ${message}`);
      if (/invalid api key|api key not valid|unauthenticated|permission denied/i.test(message)) throw caught;
    }
  }
  throw new Error(`GEMINI_FREE_MODELS_FAILED: ${failures.join(" | ")}`);
}

export async function askAiProvider(provider: AiProvider, apiKey: string, context: AiConversationContext) {
  if (provider === "openai") return callOpenAI(apiKey, context);
  return callGemini(apiKey, context);
}

export async function verifyAiProviderCredential(provider: AiProvider, apiKey: string) {
  if (provider === "gemini") {
    const failures: string[] = [];
    for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          system_instruction: "هذا اختبار اتصال فقط. أجب بكلمة: جاهز",
          input: "اختبار اتصال",
          generation_config: { temperature: 0, max_output_tokens: 32 },
        }),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.ok) return { provider, model };
      const failure = providerError(provider, response.status, data);
      failures.push(`${model}: ${failure.message}`);
      if (/invalid api key|api key not valid|unauthenticated|permission denied/i.test(failure.message)) throw failure;
    }
    throw new Error(`GEMINI_FREE_MODELS_FAILED: ${failures.join(" | ")}`);
  }
  let lastFailure: Error | null = null;
  for (const model of [OPENAI_MODEL, OPENAI_FALLBACK_MODEL]) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        instructions: "هذا اختبار اتصال فقط. أجب بكلمة: جاهز",
        input: "اختبار اتصال",
        max_output_tokens: 64,
        store: false,
      }),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.ok) return { provider, model };
    lastFailure = providerError(provider, response.status, data);
    if (!/model.*not found|not found.*model|unsupported model|does not exist|access to model/i.test(lastFailure.message)) throw lastFailure;
  }
  throw lastFailure || new Error("OPENAI_MODELS_UNAVAILABLE");
}

function base64Bytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function findAudioData(data: Record<string, unknown>) {
  const direct = data.output_audio && typeof data.output_audio === "object" ? data.output_audio as Record<string, unknown> : null;
  if (direct?.data) return String(direct.data);
  const steps = Array.isArray(data.steps) ? data.steps as Array<Record<string, unknown>> : [];
  for (const step of steps) {
    const content = Array.isArray(step.content) ? step.content as Array<Record<string, unknown>> : [];
    const audio = content.find(item => item.type === "audio" && item.data);
    if (audio?.data) return String(audio.data);
  }
  return "";
}

export async function generateGeminiSpeech(apiKey: string, text: string, requestedVoice: string) {
  const voice = GEMINI_VOICES.has(requestedVoice) ? requestedVoice : "Sulafat";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: `اقرأ النص الموجود بين علامتي الاقتباس فقط، بصوت عربي بشري طبيعي ودافئ، بسرعة محادثة مريحة ومن دون إضافة أو حذف: «${text}»`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice, language: "ar" }] },
      store: false,
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw providerError("gemini", response.status, data);
  const encoded = findAudioData(data);
  if (!encoded) throw new Error("GEMINI_AUDIO_EMPTY_RESPONSE");
  return pcmToWave(base64Bytes(encoded));
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

export function pcmToWave(pcm: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const output = new Uint8Array(44 + pcm.length), view = new DataView(output.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.length, true);
  output.set(pcm, 44);
  return output;
}
