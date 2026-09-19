export type ChatActionIntent = {
  kind: "action";
  appKey: string;
  actionKey: string;
  target: string;
  payload: Record<string, unknown>;
  missing?: "target" | "message" | "time" | "contact_details";
};

export type ChatIntent = ChatActionIntent | {
  kind: "report" | "help" | "greeting" | "unknown" | "approve" | "reject";
};

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(value: unknown) {
  return [...String(value || "")].map(character => {
    const arabicIndex = arabicDigits.indexOf(character);
    if (arabicIndex >= 0) return String(arabicIndex);
    const persianIndex = persianDigits.indexOf(character);
    return persianIndex >= 0 ? String(persianIndex) : character;
  }).join("");
}

export function normalizeChatText(value: unknown) {
  return normalizeDigits(value)
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

export function normalizePhoneDigits(value: unknown, defaultCountryCode = "971") {
  let digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 8 && digits.length <= 10) digits = defaultCountryCode + digits.slice(1);
  return digits;
}

function containsAny(value: string, terms: string[]) {
  return terms.some(term => value.includes(normalizeChatText(term)));
}

function firstPhone(value: string) {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/(?<!\d)(?:\+|00)?[0-9][0-9 ()-]{6,}[0-9](?!\d)/);
  return match ? normalizePhoneDigits(match[0]) : "";
}

function splitMessage(raw: string) {
  const pipe = raw.split(/\s*[|｜]\s*/);
  if (pipe.length > 1) return { intent: pipe.shift()!.trim(), message: pipe.join(" | ").trim() };
  const spoken = raw.match(/^(.*?)(?:\s+(?:وقل(?:ه|ها|هم)?|وقل\s+له|وقل\s+لها|واكتب(?:له|لها)?|والنص|والرساله|الرساله\s+هي|بانه|انه|إنه)\s+)(.+)$/i);
  if (spoken) return { intent: spoken[1].trim(), message: spoken[2].trim() };
  const goal = raw.match(/^(.*?)(?:\s+)((?:و?(?:حد[ّ]?د(?:\s+(?:معه|معها|معهم))?|اس[أا]ل(?:ه|ها|هم)?|استفسر(?:\s+(?:منه|منها))?|اتفق(?:\s+(?:معه|معها|معهم))?|احجز(?:\s+(?:له|لها|معه|معها))?|ت[أا]كد(?:\s+(?:منه|منها))?|اطلب(?:\s+(?:منه|منها))?|خبر(?:ه|ها|هم)?|احكي(?:له|لها|معه|معها)?))\s+.+)$/i);
  if (goal) return { intent: goal[1].trim(), message: goal[2].replace(/^و/, "").trim() };
  const colon = Math.max(raw.lastIndexOf(":"), raw.lastIndexOf("："));
  return colon >= 0 ? { intent: raw.slice(0, colon).trim(), message: raw.slice(colon + 1).trim() } : { intent: raw.trim(), message: "" };
}

function whatsappIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  const mentionsWhatsApp = containsAny(normalized, ["واتساب", "الواتساب", "الواتس", "whatsapp"]);
  const sendVerb = containsAny(normalized, ["ارسل", "ابعت", "ابعث", "بعت", "خلي", "قل له", "قلها", "send"]);
  if (!mentionsWhatsApp && !(sendVerb && containsAny(normalized, ["رساله", "مسج"]))) return null;
  const parts = splitMessage(raw);
  const target = parts.intent
    .replace(/^(?:(?:خلي|خلّي)\s+(?:الموظف(?:\s+الذكي)?\s+)?)?(?:أرسل|ارسل|إرسل|ابعت|إبعت|ابعث|بعت|يبعت|يبعث|يرسل|send)(?:\s+(?:رسالة|رساله|مسج|message))?/i, "")
    .replace(/(?:على|عبر|بـ?|عال?)?\s*(?:الواتساب|واتساب|الواتس|whatsapp)/ig, "")
    .replace(/^\s*(?:إلى|الى|لـ|ل|to)\s*/i, "")
    .replace(/^[\s:：\-—]+|[\s:：\-—]+$/g, "")
    .trim();
  return {
    kind: "action",
    appKey: "whatsapp",
    actionKey: "send",
    target,
    payload: { message: parts.message, instruction: raw, ...(firstPhone(target) ? { to: firstPhone(target) } : {}) },
    missing: !target ? "target" : !parts.message ? "message" : undefined,
  };
}

function phoneIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  if (!/^(?:اتصل|دق|رن|call)(?:\s|$)/i.test(normalized)) return null;
  const parts = splitMessage(raw);
  const target = parts.intent.replace(/^(?:اتصل|إتصل|دق|رن|call)(?:\s+(?:على|بـ?|مع|to))?\s*/i, "").trim();
  const phone = firstPhone(target);
  return {
    kind: "action",
    appKey: "voice",
    actionKey: "speak_on_behalf",
    target,
    payload: { instruction: raw, ...(parts.message ? { purpose: parts.message, message: parts.message } : {}), ...(phone ? { phone } : {}) },
    missing: !target ? "target" : !parts.message ? "message" : undefined,
  };
}

function alarmIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  if (!containsAny(normalized, ["منبه", "تذكير", "alarm"])) return null;
  const actionKey = containsAny(normalized, ["احذف", "حذف", "delete"]) ? "delete"
    : containsAny(normalized, ["اوقف", "عطل", "disable"]) ? "disable"
      : containsAny(normalized, ["شغل", "فعل", "enable"]) ? "enable"
        : containsAny(normalized, ["عدل", "غير", "edit"]) ? "edit" : "create";
  const needsTime = ["create", "edit", "enable"].includes(actionKey) && !/[0-9]{1,2}(?::[0-9]{2})?/.test(normalizeDigits(raw));
  return { kind: "action", appKey: "alarms", actionKey, target: raw, payload: { instruction: raw }, missing: needsTime ? "time" : undefined };
}

function calendarIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  if (!containsAny(normalized, ["موعد", "التقويم", "calendar"])) return null;
  const actionKey = containsAny(normalized, ["احذف", "حذف", "delete"]) ? "delete"
    : containsAny(normalized, ["الغي", "الغ", "cancel"]) ? "cancel"
      : containsAny(normalized, ["عدل", "غير", "edit"]) ? "edit"
        : containsAny(normalized, ["اعرض", "ورجيني", "شو عندي", "show"]) ? "view" : "create";
  const needsTime = actionKey === "create" && !/[0-9]{1,2}(?::[0-9]{2})?/.test(normalizeDigits(raw));
  return { kind: "action", appKey: "calendar", actionKey, target: raw, payload: { instruction: raw }, missing: needsTime ? "time" : undefined };
}

function contactsIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  if (!containsAny(normalized, ["جهه اتصال", "جهات الاتصال", "الاسماء", "contact"])) return null;
  const actionKey = containsAny(normalized, ["احذف", "حذف", "delete"]) ? "delete"
    : containsAny(normalized, ["عدل", "غير", "edit"]) ? "edit"
      : containsAny(normalized, ["اضف", "انشئ", "سجل", "add", "create"]) ? "create"
        : containsAny(normalized, ["ابحث", "دور", "search"]) ? "search" : "view";
  const phone = firstPhone(raw);
  return { kind: "action", appKey: "contacts", actionKey, target: raw, payload: { instruction: raw, ...(phone ? { phone } : {}) }, missing: actionKey === "create" && !phone ? "contact_details" : undefined };
}

function settingsIntent(raw: string): ChatActionIntent | null {
  const normalized = normalizeChatText(raw);
  if (!containsAny(normalized, ["اعدادات", "سطوع", "دوران الشاشه", "مهله الشاشه", "واي فاي", "بلوتوث", "settings"])) return null;
  const actionKey = containsAny(normalized, ["غير", "بدل", "شغل", "اوقف", "change"]) ? "change"
    : containsAny(normalized, ["افتح", "روح", "open", "واي فاي", "بلوتوث"]) ? "open" : "view";
  return { kind: "action", appKey: "settings", actionKey, target: raw, payload: { instruction: raw } };
}

export function parseChatIntent(input: unknown): ChatIntent {
  const raw = String(input || "").trim();
  const normalized = normalizeChatText(raw);
  if (!raw) return { kind: "unknown" };
  if (/^(?:وافق|موافقه|موافق|نفذ|نفّذ|اكيد|نعم)$/i.test(normalized)) return { kind: "approve" };
  if (/^(?:ارفض|رفض|لا تنفذ|لا|الغاء|الغي)$/i.test(normalized)) return { kind: "reject" };
  if (containsAny(normalized, ["تقرير", "شو عملت", "شو صار", "النتائج", "اخر المهام", "ملخص المهام", "اعطيني ملخص"])) return { kind: "report" };
  if (containsAny(normalized, ["شو بتقدر", "شو فيك تعمل", "ساعدني", "مساعده", "الاوامر", "help"])) return { kind: "help" };
  if (/^(?:مرحبا|اهلا|هاي|هلا|السلام عليكم|hello|hi)(?:\s|$)/i.test(normalized)) return { kind: "greeting" };
  return whatsappIntent(raw) || phoneIntent(raw) || alarmIntent(raw) || calendarIntent(raw) || contactsIntent(raw) || settingsIntent(raw) || { kind: "unknown" };
}

export function continuePendingIntent(pending: Record<string, unknown>, input: unknown): ChatActionIntent | null {
  if (pending.kind !== "action") return null;
  const action: ChatActionIntent = {
    kind: "action",
    appKey: String(pending.appKey || ""),
    actionKey: String(pending.actionKey || ""),
    target: String(pending.target || ""),
    payload: pending.payload && typeof pending.payload === "object" ? { ...(pending.payload as Record<string, unknown>) } : {},
  };
  const value = String(input || "").trim();
  if (pending.missing === "target") {
    const parts = splitMessage(value);
    action.target = parts.intent;
    if (parts.message) {
      action.payload.message = parts.message;
      if (action.appKey === "voice") action.payload.purpose = parts.message;
    }
  }
  else if (pending.missing === "message") {
    action.payload.message = value;
    if (action.appKey === "voice") action.payload.purpose = value;
  }
  else if (pending.missing === "time") {
    action.target = `${action.target} | ${value}`.trim();
    action.payload.instruction = action.target;
  } else if (pending.missing === "contact_details") {
    const phone = firstPhone(value);
    if (phone) {
      action.payload.phone = phone;
      action.payload.to = phone;
    } else action.missing = "contact_details";
  } else return null;
  if (!action.target) action.missing = "target";
  else if (action.appKey === "whatsapp" && !String(action.payload.message || "").trim()) action.missing = "message";
  else if (action.appKey === "voice" && !String(action.payload.purpose || action.payload.message || "").trim()) action.missing = "message";
  return action;
}
