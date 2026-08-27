"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpLeft,
  Banknote,
  BarChart3,
  BadgeCheck,
  BadgeDollarSign,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  CircleDashed,
  CirclePercent,
  ClipboardList,
  ClipboardCheck,
  Clock3,
  Database,
  FileDown,
  FileCheck2,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Languages,
  LoaderCircle,
  LogIn,
  Mail,
  MapPin,
  MapPinned,
  MessageSquareText,
  Navigation,
  PackageCheck,
  PackageOpen,
  Palette,
  Phone,
  Plus,
  Power,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserRound,
  Users,
  Stamp,
  Volume2,
  VolumeX,
  Warehouse,
  WalletCards,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  clearPendingAuth,
  getAuthErrorMessage,
  getRememberedEmail,
  readPendingAuth,
  registerBusiness,
  requestPasswordOtp,
  resendSignupOtp,
  resetPasswordWithOtp,
  restoreSession,
  setRememberedEmail,
  signIn,
  signOut,
  verifySignup,
  withMinimumDelay,
  type VarexAuthSession,
} from "@/lib/varex-shipping-auth";

type GoogleTranslateCtor = new (
  options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
  elementId: string,
) => unknown;

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement?: GoogleTranslateCtor } };
  }
}

const themeOptions = [
  { id: "coffee", name: "بني القهوة", hex: "#8A5A44" },
  { id: "navy", name: "كحلي", hex: "#254D73" },
  { id: "emerald", name: "زمردي", hex: "#23836B" },
  { id: "berry", name: "توتي", hex: "#9D4162" },
  { id: "royal", name: "أزرق ملكي", hex: "#3F5FA8" },
  { id: "clay", name: "طوبي دافئ", hex: "#B45F47" },
  { id: "orange", name: "برتقالي محروق", hex: "#C46B2D" },
  { id: "indigo", name: "نيلي", hex: "#554FA3" },
  { id: "graphite", name: "جرافيت", hex: "#555E68" },
  { id: "steel", name: "أزرق فولاذي", hex: "#4F7589" },
  { id: "plum", name: "برقوقي", hex: "#754667" },
  { id: "mauve", name: "موف", hex: "#84658C" },
  { id: "bronze", name: "برونزي", hex: "#94633D" },
  { id: "teal", name: "تركواز غامق", hex: "#247E82" },
  { id: "ocean", name: "أزرق محيطي", hex: "#35718E" },
  { id: "ruby", name: "ياقوتي", hex: "#A64748" },
  { id: "maroon", name: "عنابي", hex: "#7C3D50" },
  { id: "olive", name: "زيتوني", hex: "#727A3D" },
  { id: "forest", name: "أخضر غابات", hex: "#3E6C4E" },
  { id: "violet", name: "بنفسجي", hex: "#7056A6" },
  { id: "lavender", name: "لافندر", hex: "#7E6DA8" },
  { id: "slate", name: "رمادي مزرق", hex: "#5E6E7C" },
  { id: "charcoal", name: "فحمي", hex: "#41474D" },
  { id: "gold", name: "ذهبي معتّق", hex: "#A57B31" },
  { id: "coral", name: "مرجاني", hex: "#BB5E58" },
  { id: "bluegray", name: "أزرق رمادي", hex: "#607489" },
  { id: "rose", name: "وردي غامق", hex: "#A95773" },
  { id: "mint", name: "نعناعي غامق", hex: "#438876" },
  { id: "sky", name: "أزرق سماوي", hex: "#477CAD" },
  { id: "amber", name: "كهرماني", hex: "#B77A29" },
] as const;

const languageOptions = [
  { code: "ar", google: "ar", name: "العربية", locale: "ar-AE", dir: "rtl" },
  { code: "en", google: "en", name: "English", locale: "en-US", dir: "ltr" },
  { code: "fr", google: "fr", name: "Français", locale: "fr-FR", dir: "ltr" },
  { code: "es", google: "es", name: "Español", locale: "es-ES", dir: "ltr" },
  { code: "de", google: "de", name: "Deutsch", locale: "de-DE", dir: "ltr" },
  { code: "it", google: "it", name: "Italiano", locale: "it-IT", dir: "ltr" },
  { code: "pt", google: "pt", name: "Português", locale: "pt-PT", dir: "ltr" },
  { code: "tr", google: "tr", name: "Türkçe", locale: "tr-TR", dir: "ltr" },
  { code: "fa", google: "fa", name: "فارسی", locale: "fa-IR", dir: "rtl" },
  { code: "ur", google: "ur", name: "اردو", locale: "ur-PK", dir: "rtl" },
  { code: "zh", google: "zh-CN", name: "中文", locale: "zh-CN", dir: "ltr" },
  { code: "ja", google: "ja", name: "日本語", locale: "ja-JP", dir: "ltr" },
  { code: "ko", google: "ko", name: "한국어", locale: "ko-KR", dir: "ltr" },
  { code: "ru", google: "ru", name: "Русский", locale: "ru-RU", dir: "ltr" },
  { code: "he", google: "iw", name: "עברית", locale: "he-IL", dir: "rtl" },
  { code: "hi", google: "hi", name: "हिन्दी", locale: "hi-IN", dir: "ltr" },
  { code: "id", google: "id", name: "Indonesia", locale: "id-ID", dir: "ltr" },
  { code: "ms", google: "ms", name: "Melayu", locale: "ms-MY", dir: "ltr" },
  { code: "bn", google: "bn", name: "বাংলা", locale: "bn-BD", dir: "ltr" },
  { code: "nl", google: "nl", name: "Nederlands", locale: "nl-NL", dir: "ltr" },
] as const;

function mixHex(source: string, target: string, amount: number) {
  const read = (value: string) => [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
  const [sr, sg, sb] = read(source);
  const [tr, tg, tb] = read(target);
  return `#${[sr, sg, sb].map((value, index) => {
    const end = [tr, tg, tb][index];
    return Math.round(value + (end - value) * amount).toString(16).padStart(2, "0");
  }).join("")}`;
}

function applyThemeColor(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--coffee", hex);
  root.style.setProperty("--coffee-deep", mixHex(hex, "#000000", 0.36));
  root.style.setProperty("--coffee-dark", mixHex(hex, "#000000", 0.62));
  root.style.setProperty("--coffee-soft", mixHex(hex, "#ffffff", 0.5));
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", mixHex(hex, "#ffffff", 0.24));
  root.style.setProperty("--secondary", mixHex(hex, "#ffffff", 0.86));
  root.style.setProperty("--secondary-foreground", mixHex(hex, "#000000", 0.48));
  root.style.setProperty("--accent", mixHex(hex, "#ffffff", 0.84));
  root.style.setProperty("--accent-foreground", mixHex(hex, "#000000", 0.48));
  root.style.setProperty("--line", mixHex(hex, "#ffffff", 0.78));
  root.style.setProperty("--border", mixHex(hex, "#ffffff", 0.78));
  root.style.setProperty("--input", mixHex(hex, "#ffffff", 0.7));
  root.style.setProperty("--muted", mixHex(hex, "#ffffff", 0.88));
  root.style.setProperty("--sand", mixHex(hex, "#ffffff", 0.93));
  root.style.setProperty("--background", mixHex(hex, "#ffffff", 0.93));
}

function applyGoogleLanguage(code: string) {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!combo) return false;
  combo.value = code;
  combo.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

type ShipmentStatus =
  | "جديدة"
  | "في المستودع"
  | "في الطريق"
  | "تم التسليم"
  | "متأخرة";

type Shipment = {
  id: string;
  customer: string;
  phone: string;
  origin: string;
  destination: string;
  service: "عادي" | "سريع" | "دولي";
  status: ShipmentStatus;
  eta: string;
  driver: string;
  vehicle: string;
  progress: number;
  amount: number;
  weight: string;
};

const statusClasses: Record<ShipmentStatus, string> = {
  جديدة: "status-new",
  "في المستودع": "status-hub",
  "في الطريق": "status-route",
  "تم التسليم": "status-done",
  متأخرة: "status-late",
};

const stageData = [
  { label: "طلبات جديدة", value: 24, icon: PackageOpen },
  { label: "بانتظار الاستلام", value: 16, icon: Boxes },
  { label: "داخل المحطات", value: 31, icon: Warehouse },
  { label: "في الطريق", value: 42, icon: Truck },
  { label: "تم التسليم", value: 98, icon: PackageCheck },
];

function playClick() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(510, context.currentTime);
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.06);
  } catch {
    // Optional enhancement; audio must never block an action.
  }
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
  icon: typeof Truck;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-icon"><Icon /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={`status-badge ${statusClasses[status]}`}>{status}</span>;
}

function ShipmentTable({
  shipments,
  onTrack,
}: {
  shipments: Shipment[];
  onTrack: (shipment: Shipment) => void;
}) {
  return (
    <div className="table-shell">
      <Table dir="rtl">
        <TableHeader>
          <TableRow>
            <TableHead>رقم الشحنة</TableHead>
            <TableHead>العميل</TableHead>
            <TableHead>المسار</TableHead>
            <TableHead>الخدمة</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>الوصول المتوقع</TableHead>
            <TableHead>الإجراء</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id}>
              <TableCell className="tracking-id">{shipment.id}</TableCell>
              <TableCell>
                <strong className="customer-name">{shipment.customer}</strong>
                <span className="cell-subtext">{shipment.phone}</span>
              </TableCell>
              <TableCell>
                <span className="route-cell">
                  {shipment.origin}<ChevronLeft />{shipment.destination}
                </span>
              </TableCell>
              <TableCell>{shipment.service}</TableCell>
              <TableCell><StatusBadge status={shipment.status} /></TableCell>
              <TableCell>{shipment.eta}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="track-row-button"
                  onClick={() => onTrack(shipment)}
                >
                  <MapPinned /> تتبّع
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {shipments.length === 0 && (
        <div className="empty-state">
          <PackageOpen />
          <strong>لا توجد شحنات مطابقة</strong>
          <span>يمكن تغيير البحث أو الفلاتر لعرض نتائج أخرى.</span>
        </div>
      )}
    </div>
  );
}

function TrackingPanel({ shipment }: { shipment: Shipment }) {
  const milestones = [
    { label: "تم إنشاء الطلب", detail: "دبي · 8:14 ص", done: true },
    { label: "استلام الشحنة", detail: "مركز القوز · 9:02 ص", done: shipment.progress >= 20 },
    { label: "فرز وتحميل", detail: "بوابة 04 · 10:26 ص", done: shipment.progress >= 40 },
    { label: "في الطريق للوجهة", detail: shipment.driver, done: shipment.progress >= 60 },
    { label: "تم التسليم", detail: shipment.destination, done: shipment.progress === 100 },
  ];

  return (
    <section className="tracking-result">
      <div className="tracking-summary">
        <div>
          <span className="eyebrow">الشحنة المحددة</span>
          <h2>{shipment.id}</h2>
          <p>{shipment.customer} · {shipment.weight}</p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <div className="live-route-card">
        <div className="live-route-top">
          <div>
            <span>الانطلاق</span>
            <strong>{shipment.origin}</strong>
          </div>
          <div className="route-truck" style={{ insetInlineStart: `${Math.max(8, shipment.progress - 4)}%` }}>
            <Truck />
          </div>
          <div>
            <span>الوجهة</span>
            <strong>{shipment.destination}</strong>
          </div>
        </div>
        <div className="route-progress-line">
          <span style={{ width: `${shipment.progress}%` }} />
          <i style={{ insetInlineStart: `${shipment.progress}%` }} />
        </div>
        <div className="eta-line">
          <Clock3 /> الوصول المتوقع: <strong>{shipment.eta}</strong>
        </div>
      </div>

      <div className="tracking-details-grid">
        <div className="timeline-card">
          <div className="section-heading compact">
            <div><span className="eyebrow">آخر التحديثات</span><h3>رحلة الشحنة</h3></div>
            <RefreshCw />
          </div>
          <div className="shipment-timeline">
            {milestones.map((milestone, index) => (
              <div className={milestone.done ? "milestone done" : "milestone"} key={milestone.label}>
                <span className="milestone-dot">{milestone.done ? <CheckCircle2 /> : <CircleDashed />}</span>
                <div>
                  <strong>{milestone.label}</strong>
                  <small>{milestone.detail}</small>
                </div>
                {index < milestones.length - 1 && <i />}
              </div>
            ))}
          </div>
        </div>

        <div className="assignment-card">
          <span className="eyebrow">التنفيذ الميداني</span>
          <div className="driver-block">
            <span><UserRound /></span>
            <div><small>السائق</small><strong>{shipment.driver}</strong></div>
          </div>
          <div className="driver-block">
            <span><Truck /></span>
            <div><small>المركبة</small><strong>{shipment.vehicle}</strong></div>
          </div>
          <div className="driver-block">
            <span><Banknote /></span>
            <div><small>قيمة الشحنة</small><strong>{shipment.amount} د.إ</strong></div>
          </div>
          <Button
            className="share-tracking"
            onClick={() => {
              navigator.clipboard?.writeText(`تتبع شحنتك ${shipment.id} عبر VAREX`);
              toast.success("تم نسخ رابط التتبع");
            }}
          >
            مشاركة رابط التتبع <ArrowUpLeft />
          </Button>
        </div>
      </div>
    </section>
  );
}

type AuthView = "login" | "register" | "verify" | "forgot" | "reset";

async function shippingApi<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {}
  if (!response.ok) throw new Error(String(payload.error || "تعذّر إكمال العملية."));
  return payload as T;
}

function AuthPortal({ onAuthenticated }: { onAuthenticated: (session: VarexAuthSession) => void }) {
  const [initialAuth] = useState(() => {
    if (typeof window === "undefined") return { view: "login" as AuthView, email: "", businessName: "" };
    const pending = readPendingAuth();
    return {
      view: pending?.purpose === "signup" ? "verify" as AuthView : pending?.purpose === "reset" ? "reset" as AuthView : "login" as AuthView,
      email: pending?.email || getRememberedEmail(),
      businessName: pending?.businessName || "",
    };
  });
  const [view, setView] = useState<AuthView>(initialAuth.view);
  const [businessName, setBusinessName] = useState(initialAuth.businessName);
  const [email, setEmail] = useState(initialAuth.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const changeView = (next: AuthView, clearPending = false) => {
    if (clearPending) clearPendingAuth();
    setView(next);
    setMessage(null);
    setOtp("");
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!validEmail) return setMessage({ type: "error", text: "يجب إدخال بريد إلكتروني صحيح." });
    if (view === "register" && businessName.trim().length < 2) return setMessage({ type: "error", text: "يجب إدخال اسم المنشأة." });
    if ((view === "login" || view === "register" || view === "reset") && password.length < 8) return setMessage({ type: "error", text: "كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل." });
    if ((view === "register" || view === "reset") && password !== confirmPassword) return setMessage({ type: "error", text: "كلمتا المرور غير متطابقتين." });
    if ((view === "verify" || view === "reset") && !/^\d{6}$/.test(otp)) return setMessage({ type: "error", text: "يجب إدخال رمز التحقق الكامل المكوّن من 6 أرقام." });

    setBusy(true);
    try {
      if (view === "login") {
        const session = await withMinimumDelay(signIn(email, password));
        setRememberedEmail(email.trim().toLowerCase(), remember);
        onAuthenticated(session);
        return;
      }
      if (view === "register") {
        const session = await withMinimumDelay(registerBusiness(businessName.trim(), email, password));
        if (session) {
          onAuthenticated(session);
          return;
        }
        setPassword("");
        setConfirmPassword("");
        setView("verify");
        setMessage({ type: "success", text: "تم إنشاء المنشأة وإرسال رمز التحقق إلى بريدك." });
        return;
      }
      if (view === "verify") {
        const session = await withMinimumDelay(verifySignup(email, otp, businessName));
        onAuthenticated(session);
        return;
      }
      if (view === "forgot") {
        await withMinimumDelay(requestPasswordOtp(email));
        setView("reset");
        setMessage({ type: "success", text: "أرسلنا رمزًا من 6 أرقام إلى بريدك." });
        return;
      }
      const session = await withMinimumDelay(resetPasswordWithOtp(email, otp, password));
      onAuthenticated(session);
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!validEmail || resendBusy) return;
    setResendBusy(true);
    setMessage(null);
    try {
      if (view === "verify") await resendSignupOtp(email);
      else await requestPasswordOtp(email);
      setOtp("");
      setMessage({ type: "success", text: "تم إرسال رمز تحقق جديد." });
    } catch (error) {
      setMessage({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      window.setTimeout(() => setResendBusy(false), 1200);
    }
  };

  const title = view === "login" ? "تسجيل الدخول" : view === "register" ? "تسجيل منشأة جديدة" : view === "verify" ? "تأكيد البريد الإلكتروني" : view === "forgot" ? "نسيت كلمة المرور" : "تعيين كلمة مرور جديدة";
  const subtitle = view === "login" ? "الدخول إلى مركز إدارة الشحن والتتبّع" : view === "register" ? "أربعة حقول فقط لبدء حساب المنشأة" : view === "verify" ? `يجب إدخال الرمز المرسل إلى ${email}` : view === "forgot" ? "سيتم إرسال رمز تحقق آمن إلى البريد الإلكتروني" : `يجب إدخال الرمز المرسل إلى ${email}`;
  const busyLabel = view === "login" ? "جاري تسجيل الدخول..." : view === "register" ? "جاري إنشاء المنشأة..." : view === "verify" ? "جاري تأكيد الحساب..." : view === "forgot" ? "جاري إرسال الرمز..." : "جاري تحديث كلمة المرور...";

  return (
    <main className="auth-shell">
      <div id="google_translate_element" aria-hidden="true" />
      <Toaster richColors position="top-center" dir="rtl" />
      <div className="auth-frame">
        <aside className="auth-brand-pane">
          <div className="auth-brand-lockup">
            <img src="/varex-shipping-logo.svg" alt="شعار VAREX Shipping" />
            <div><strong>VAREX SHIPPING</strong><span>نظام إدارة الشحن</span></div>
          </div>
          <div className="auth-route-visual" aria-hidden="true">
            <span><Warehouse /></span><i /><span><Truck /></span><i /><span><MapPin /></span><i /><span><PackageCheck /></span>
          </div>
          <div className="auth-brand-copy">
            <span>مركز قيادة لوجستي واحد</span>
            <h1>من الاستلام إلى التسليم<br />كل حركة تحت السيطرة.</h1>
            <p>حساب آمن مرتبط بمنشأتك، مع تتبّع حي وإدارة الشحنات والأسطول والمستودعات.</p>
          </div>
          <div className="auth-trust-row"><span><ShieldCheck />اتصال آمن</span><span><BadgeCheck />حساب منشأة محمي</span></div>
        </aside>

        <section className="auth-form-pane">
          <div className="auth-mobile-brand"><img src="/varex-shipping-logo.svg" alt="" /><strong>VAREX SHIPPING</strong></div>
          <form className="auth-card" onSubmit={submit}>
          <header>
            <span className="auth-kicker">VAREX BUSINESS MANAGEMENT SYSTEM</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </header>

          {view === "register" && (
            <div className="auth-field">
              <Label htmlFor="businessName">اسم المنشأة</Label>
              <div><Building2 /><Input id="businessName" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="مثال: شركة المسار للشحن" autoComplete="organization" disabled={busy} /></div>
            </div>
          )}

          <div className="auth-field">
            <Label htmlFor="authEmail">البريد الإلكتروني</Label>
            <div><Mail /><Input id="authEmail" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="demo@example.invalid" autoComplete="email" disabled={busy || view === "verify" || view === "reset"} /></div>
          </div>

          {(view === "verify" || view === "reset") && (
            <div className="auth-field auth-otp-field">
              <Label>رمز التحقق</Label>
              <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={busy} containerClassName="auth-otp" inputMode="numeric">
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => <InputOTPSlot index={index} key={index} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {(view === "login" || view === "register" || view === "reset") && (
            <div className="auth-field">
              <Label htmlFor="authPassword">{view === "reset" ? "كلمة المرور الجديدة" : "كلمة المرور"}</Label>
              <div><KeyRound /><Input id="authPassword" type={showPassword ? "text" : "password"} dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف على الأقل" autoComplete={view === "login" ? "current-password" : "new-password"} disabled={busy} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
            </div>
          )}

          {(view === "register" || view === "reset") && (
            <div className="auth-field">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <div><ShieldCheck /><Input id="confirmPassword" type={showPassword ? "text" : "password"} dir="ltr" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="إعادة كتابة كلمة المرور" autoComplete="new-password" disabled={busy} /></div>
            </div>
          )}

          {view === "login" && (
            <div className="auth-options">
              <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />تذكّر البريد</label>
              <button type="button" onClick={() => changeView("forgot")}>نسيت كلمة المرور؟</button>
            </div>
          )}

          {message && <div className={`auth-message ${message.type}`} role="status">{message.type === "success" ? <CheckCircle2 /> : <AlertTriangle />}<span>{message.text}</span></div>}

          <Button type="submit" className="auth-submit" disabled={busy}>
            {busy ? <><LoaderCircle className="spin" />{busyLabel}</> : view === "login" ? <><LogIn />تسجيل الدخول</> : view === "register" ? <><Building2 />إنشاء المنشأة</> : view === "verify" ? <><BadgeCheck />تأكيد الحساب</> : view === "forgot" ? <><Mail />إرسال رمز التحقق</> : <><KeyRound />حفظ كلمة المرور</>}
          </Button>

          {(view === "verify" || view === "reset") && <button className="auth-text-button" type="button" onClick={resend} disabled={resendBusy}>{resendBusy ? "جاري إعادة الإرسال..." : "إعادة إرسال الرمز"}</button>}
          {view === "login" ? <div className="auth-switch">ليس لديك حساب؟ <button type="button" onClick={() => changeView("register", true)}>تسجيل منشأة جديدة</button></div> : <button className="auth-back" type="button" onClick={() => changeView("login", true)}>العودة إلى تسجيل الدخول</button>}
          </form>
          <p className="auth-footer-note"><ShieldCheck />تتم إدارة الحسابات ورموز التحقق عبر البنية الآمنة المعتمدة في VAREX.</p>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<VarexAuthSession | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [activeTab, setActiveTab] = useState("control");
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [themeId, setThemeId] = useState(() => {
    if (typeof window === "undefined") return "coffee";
    const saved = window.localStorage.getItem("varex-shipping-theme") ?? "coffee";
    return themeOptions.some((option) => option.id === saved) ? saved : "coffee";
  });
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return "ar";
    const saved = window.localStorage.getItem("varex-shipping-language") ?? "ar";
    return languageOptions.some((option) => option.code === saved) ? saved : "ar";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [serviceFilter, setServiceFilter] = useState("الكل");
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackedShipment, setTrackedShipment] = useState<Shipment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [clientUpdates, setClientUpdates] = useState(true);
  const [proofRequired, setProofRequired] = useState(true);
  const [capacityAlerts, setCapacityAlerts] = useState(true);
  const [newShipment, setNewShipment] = useState({
    customer: "",
    phone: "",
    origin: "دبي",
    destination: "أبوظبي",
    service: "سريع" as Shipment["service"],
    weight: "",
    amount: "",
  });

  const selectedLanguage = languageOptions.find((option) => option.code === language) ?? languageOptions[0];

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((session) => {
        if (active) setAuthSession(session);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;
    let active = true;
    Promise.all([
      shippingApi<{ shipments: Shipment[] }>("/api/shipments"),
      shippingApi<{ settings: Record<string, unknown> }>("/api/settings"),
    ])
      .then(([shipmentPayload, settingsPayload]) => {
        if (!active) return;
        const businessShipments = Array.isArray(shipmentPayload.shipments) ? shipmentPayload.shipments : [];
        setShipments(businessShipments);
        setTrackedShipment((current) => businessShipments.find((shipment) => shipment.id === current?.id) || businessShipments[0] || null);
        setTrackingQuery((current) => current || businessShipments[0]?.id || "");
        const settings = settingsPayload.settings || {};
        const savedTheme = String(settings.themeId || "");
        const savedLanguage = String(settings.language || "");
        if (themeOptions.some((option) => option.id === savedTheme)) setThemeId(savedTheme);
        if (languageOptions.some((option) => option.code === savedLanguage)) setLanguage(savedLanguage);
        if (typeof settings.autoAssign === "boolean") setAutoAssign(settings.autoAssign);
        if (typeof settings.clientUpdates === "boolean") setClientUpdates(settings.clientUpdates);
        if (typeof settings.proofRequired === "boolean") setProofRequired(settings.proofRequired);
        if (typeof settings.capacityAlerts === "boolean") setCapacityAlerts(settings.capacityAlerts);
        if (typeof settings.soundOn === "boolean") setSoundOn(settings.soundOn);
      })
      .catch((error) => {
        if (active) toast.error(getAuthErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString(selectedLanguage.locale, { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString(selectedLanguage.locale, { weekday: "long", day: "numeric", month: "long" }));
    };
    updateTime();
    const timer = window.setInterval(updateTime, 30_000);
    return () => window.clearInterval(timer);
  }, [selectedLanguage.locale]);

  useEffect(() => {
    const selectedTheme = themeOptions.find((option) => option.id === themeId) ?? themeOptions[0];
    applyThemeColor(selectedTheme.hex);
    document.documentElement.lang = selectedLanguage.code;
    document.documentElement.dir = selectedLanguage.dir;
  }, [selectedLanguage.code, selectedLanguage.dir, themeId]);

  useEffect(() => {
    const initializeTranslator = () => {
      const TranslateElement = window.google?.translate?.TranslateElement;
      if (!TranslateElement) return;
      const mount = document.getElementById("google_translate_element");
      if (mount && !mount.hasChildNodes()) {
        new TranslateElement(
          {
            pageLanguage: "ar",
            includedLanguages: languageOptions.map((option) => option.google).join(","),
            autoDisplay: false,
          },
          "google_translate_element",
        );
      }
      window.setTimeout(() => applyGoogleLanguage(selectedLanguage.google), 350);
    };

    window.googleTranslateElementInit = initializeTranslator;
    const existingScript = document.getElementById("varex-google-translate") as HTMLScriptElement | null;
    if (existingScript) {
      initializeTranslator();
    } else {
      const script = document.createElement("script");
      script.id = "varex-google-translate";
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [selectedLanguage.google]);

  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const matchesQuery =
        !query ||
        shipment.id.toLowerCase().includes(query) ||
        shipment.customer.toLowerCase().includes(query) ||
        shipment.destination.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "الكل" || shipment.status === statusFilter;
      const matchesService = serviceFilter === "الكل" || shipment.service === serviceFilter;
      return matchesQuery && matchesStatus && matchesService;
    });
  }, [search, serviceFilter, shipments, statusFilter]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!soundOn) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, [role='tab'], [role='switch'], [role='combobox']")) playClick();
  };

  const openTracking = (shipment: Shipment) => {
    setTrackedShipment(shipment);
    setTrackingQuery(shipment.id);
    setActiveTab("tracking");
  };

  const selectTheme = (id: string) => {
    const theme = themeOptions.find((option) => option.id === id);
    if (!theme) return;
    setThemeId(theme.id);
    applyThemeColor(theme.hex);
    window.localStorage.setItem("varex-shipping-theme", theme.id);
    toast.success(`تم اعتماد مظهر ${theme.name}`);
  };

  const selectLanguage = (code: string) => {
    const option = languageOptions.find((item) => item.code === code);
    if (!option) return;
    setLanguage(option.code);
    window.localStorage.setItem("varex-shipping-language", option.code);

    let attempts = 0;
    const translate = window.setInterval(() => {
      attempts += 1;
      if (applyGoogleLanguage(option.google) || attempts >= 30) {
        window.clearInterval(translate);
        if (attempts >= 30) toast.error("تعذّر تحميل الترجمة. يجب التحقق من الاتصال بالإنترنت.");
      }
    }, 200);
    toast.success(`تم تغيير اللغة إلى ${option.name}`);
  };

  const handleTrack = (event?: FormEvent) => {
    event?.preventDefault();
    const shipment = shipments.find(
      (item) => item.id.toLowerCase() === trackingQuery.trim().toLowerCase(),
    );
    if (!shipment) {
      toast.error("رقم التتبع غير موجود", { description: "يجب التحقق من الرقم وإعادة المحاولة." });
      return;
    }
    setTrackedShipment(shipment);
    toast.success("تم تحديث موقع الشحنة");
  };

  const handleCreateShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newShipment.customer || !newShipment.phone || !newShipment.weight) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    setShipmentSaving(true);
    try {
      const payload = await withMinimumDelay(shippingApi<{ shipment: Shipment }>("/api/shipments", {
        method: "POST",
        body: JSON.stringify(newShipment),
      }), 900);
      const shipment = payload.shipment;
      setShipments((current) => [shipment, ...current]);
      setTrackedShipment(shipment);
      setTrackingQuery(shipment.id);
      setNewShipment({ customer: "", phone: "", origin: "دبي", destination: "أبوظبي", service: "سريع", weight: "", amount: "" });
      setDialogOpen(false);
      toast.success(`تم إنشاء الشحنة ${shipment.id}`);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (settingsSaving) return;
    setSettingsSaving(true);
    try {
      await withMinimumDelay(shippingApi("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ themeId, language, autoAssign, clientUpdates, proofRequired, capacityAlerts, soundOn }),
      }), 900);
      toast.success("تم حفظ الإعدادات");
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await withMinimumDelay(signOut(authSession), 700);
      setAuthSession(null);
      setShipments([]);
      setTrackedShipment(null);
      toast.success("تم تسجيل الخروج بأمان");
    } finally {
      setLogoutBusy(false);
    }
  };

  const accountName = authSession?.user.user_metadata?.business_name || authSession?.user.user_metadata?.name || authSession?.user.email?.split("@")[0] || "منشأة الشحن";
  const accountInitials = accountName.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VS";
  const delayedShipment = shipments.find((shipment) => shipment.status === "متأخرة");

  if (!authReady) {
    return (
      <main className="auth-loading-screen">
        <img src="/varex-shipping-logo.svg" alt="VAREX Shipping" />
        <LoaderCircle className="spin" />
        <strong>جاري تجهيز نظام إدارة الشحن...</strong>
      </main>
    );
  }

  if (!authSession) return <AuthPortal onAuthenticated={setAuthSession} />;

  return (
    <main className="shipping-app" onPointerDown={handlePointerDown}>
      <div id="google_translate_element" aria-hidden="true" />
      <Toaster richColors position="top-center" dir={selectedLanguage.dir} />
      <header className="command-header">
        <div className="brand-cluster">
          <img src="/varex-shipping-logo.svg" alt="VAREX Business Management System" />
          <div>
            <strong>VAREX SHIPPING</strong>
            <span>نظام إدارة الشحن</span>
          </div>
        </div>

        <div className="system-pulse">
          <span className="pulse-dot" />
          <div><strong>النظام متصل</strong><small>بيانات العرض تجريبية</small></div>
        </div>

        <div className="header-actions">
          <div className="date-capsule"><CalendarDays /><span>{date}</span><strong>{clock}</strong></div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="header-icon wide" aria-label="اختيار اللغة"><Languages /><span>{selectedLanguage.name}</span></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="language-popover" dir={selectedLanguage.dir}>
              <div className="popover-title-row"><div><strong>لغة النظام</strong><small>20 لغة متاحة للترجمة الفورية</small></div><Languages /></div>
              <div className="language-grid">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    className={language === option.code ? "selected" : ""}
                    onClick={() => selectLanguage(option.code)}
                    dir={option.dir}
                  >
                    <span>{option.name}</span>
                    {language === option.code && <CheckCircle2 />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button className="header-icon wide" aria-label="اختيار المظهر"><Palette /><span>المظهر</span></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="theme-popover" dir="rtl">
              <div className="popover-title-row"><div><strong>مظهر النظام</strong><small>30 لونًا تطبّق على النظام بالكامل</small></div><Palette /></div>
              <div className="theme-grid">
                {themeOptions.map((theme) => (
                  <button
                    key={theme.id}
                    className={themeId === theme.id ? "selected" : ""}
                    onClick={() => selectTheme(theme.id)}
                    aria-label={theme.name}
                    title={theme.name}
                  >
                    <span style={{ backgroundColor: theme.hex }} />
                    <small>{theme.name}</small>
                    {themeId === theme.id && <CheckCircle2 />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            className={`header-icon ${soundOn ? "active" : ""}`}
            aria-label={soundOn ? "إيقاف الصوت" : "تشغيل الصوت"}
            onClick={() => setSoundOn((value) => !value)}
          >
            {soundOn ? <Volume2 /> : <VolumeX />}
          </button>
          <div className="notification-wrap">
            <button
              className="header-icon notification-button"
              aria-label="التنبيهات"
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              <Bell /><i>3</i>
            </button>
            {notificationsOpen && (
              <div className="notification-panel">
                <div><strong>التنبيهات</strong><span>3 جديدة</span></div>
                <article className="urgent"><AlertTriangle /><p><strong>تأخير في الشحنة DEMO-SHP-003</strong><small>ازدحام على المسار · منذ 8 دقائق</small></p></article>
                <article><Truck /><p><strong>المركبة DEMO-VEH-002 وصلت المحطة</strong><small>مركز تجريبي · منذ 14 دقيقة</small></p></article>
                <article><PackageCheck /><p><strong>تم تسليم 12 شحنة</strong><small>دفعة أبوظبي · منذ 31 دقيقة</small></p></article>
              </div>
            )}
          </div>
          <button className="profile-chip" onClick={() => toast.info(accountName)}><span>{accountInitials}</span><div><strong>{accountName}</strong><small>مالك المنشأة</small></div></button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="workspace-tabs">
        <div className="operations-ribbon">
          <TabsList className="route-tabs" variant="line" aria-label="أقسام النظام">
            <TabsTrigger value="control"><Navigation />مركز العمليات</TabsTrigger>
            <TabsTrigger value="pickups"><ClipboardList />طلبات الاستلام</TabsTrigger>
            <TabsTrigger value="shipments"><Boxes />الشحنات</TabsTrigger>
            <TabsTrigger value="tracking"><MapPinned />التتبّع</TabsTrigger>
            <TabsTrigger value="fleet"><Truck />الأسطول</TabsTrigger>
            <TabsTrigger value="warehouses"><Warehouse />المستودعات</TabsTrigger>
            <TabsTrigger value="drivers"><UserRound />السائقون</TabsTrigger>
            <TabsTrigger value="customers"><Users />العملاء</TabsTrigger>
            <span className="nav-divider" aria-hidden="true" />
            <TabsTrigger value="accounts"><WalletCards />الحسابات</TabsTrigger>
            <TabsTrigger value="employees"><BriefcaseBusiness />الموظفون</TabsTrigger>
            <TabsTrigger value="tax"><CirclePercent />الإقرار الضريبي</TabsTrigger>
            <TabsTrigger value="customs"><Stamp />التخليص الجمركي</TabsTrigger>
            <TabsTrigger value="reports"><BarChart3 />التقارير</TabsTrigger>
            <TabsTrigger value="settings"><Settings2 />الإعدادات</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="control" className="workspace-page">
          <section className="page-intro">
            <div><span className="eyebrow">برج المراقبة اللوجستي</span><h1>صباح الخير، كل المسارات تحت السيطرة</h1><p>متابعة الشحنات والمركبات والمحطات من لوحة تشغيل واحدة.</p></div>
            <button className="day-score"><span>أداء اليوم</span><strong>94%</strong><Progress value={94} /></button>
          </section>

          <section className="metrics-grid">
            <StatCard label="شحنات اليوم" value="186" hint="+18 عن الأمس" tone="brown" icon={Boxes} />
            <StatCard label="في الطريق الآن" value="42" hint="11 مركبة نشطة" tone="blue" icon={Truck} />
            <StatCard label="تم التسليم" value="98" hint="نسبة نجاح 96.8%" tone="green" icon={PackageCheck} />
            <StatCard label="تحصيل قيد التسوية" value="18,640 د.إ" hint="27 شحنة COD" tone="amber" icon={WalletCards} />
          </section>

          <section className="command-grid">
            <article className="flow-board">
              <div className="section-heading">
                <div><span className="eyebrow">تدفّق اليوم</span><h2>ممر العمليات المباشر</h2></div>
                <span className="live-chip"><i /> مباشر</span>
              </div>
              <div className="stage-flow">
                {stageData.map((stage, index) => {
                  const Icon = stage.icon;
                  return (
                    <div className="stage-node" key={stage.label}>
                      <span><Icon /></span><strong>{stage.value}</strong><small>{stage.label}</small>
                      {index < stageData.length - 1 && <i className="stage-connector" />}
                    </div>
                  );
                })}
              </div>
              <div className="route-corridors">
                <div><span className="corridor-code">DXB → AUH</span><Progress value={86} /><strong>86%</strong><small>18 شحنة</small></div>
                <div><span className="corridor-code">SHJ → AAN</span><Progress value={63} /><strong>63%</strong><small>9 شحنات</small></div>
                <div><span className="corridor-code">DXB → RUH</span><Progress value={48} /><strong>48%</strong><small>7 شحنات</small></div>
              </div>
            </article>

            <aside className="attention-board">
              <div className="section-heading compact"><div><span className="eyebrow">تحتاج تدخلك</span><h2>تنبيهات التشغيل</h2></div><span className="alert-count">3</span></div>
              <article className="attention-item high"><span><AlertTriangle /></span><div><strong>{delayedShipment ? "شحنة متأخرة" : "لا توجد شحنات متأخرة"}</strong><p>{delayedShipment ? `${delayedShipment.id} · ${delayedShipment.destination}` : "حالة التشغيل مستقرة"}</p></div><button disabled={!delayedShipment} onClick={() => delayedShipment && openTracking(delayedShipment)}><ChevronLeft /></button></article>
              <article className="attention-item medium"><span><Truck /></span><div><strong>مركبة تجريبية تحتاج صيانة</strong><p>DEMO-VEH-006 · بعد 240 كم</p></div><button onClick={() => setActiveTab("fleet")}><ChevronLeft /></button></article>
              <article className="attention-item low"><span><Banknote /></span><div><strong>تحصيل غير مسوّى</strong><p>4 شحنات · 2,180 د.إ</p></div><button onClick={() => toast.info("سيظهر في وحدة المالية")}><ChevronLeft /></button></article>
              <button className="view-all-alerts">عرض كل التنبيهات</button>
            </aside>
          </section>

          <section className="recent-shipments">
            <div className="section-heading">
              <div><span className="eyebrow">حركة الشحن</span><h2>آخر الشحنات</h2></div>
              <Button variant="ghost" onClick={() => setActiveTab("shipments")}>عرض الجميع <ChevronLeft /></Button>
            </div>
            <ShipmentTable shipments={shipments.slice(0, 5)} onTrack={openTracking} />
          </section>
        </TabsContent>

        <TabsContent value="shipments" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">إدارة دورة الشحنة</span><h1>الشحنات</h1><p>من إنشاء بوليصة الشحن حتى إثبات التسليم والتحصيل.</p></div>
            <div className="page-quick-actions"><Button variant="outline" onClick={() => toast.success("تم تجهيز ملف الشحنات للتصدير")}><FileDown />تصدير</Button><Button variant="outline" onClick={() => window.print()}><Printer />طباعة</Button></div>
          </section>
          <section className="filter-deck">
            <div className="search-field"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="البحث برقم الشحنة أو العميل أو الوجهة" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SlidersHorizontal /><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="الكل">كل الحالات</SelectItem><SelectItem value="جديدة">جديدة</SelectItem><SelectItem value="في المستودع">في المستودع</SelectItem><SelectItem value="في الطريق">في الطريق</SelectItem><SelectItem value="تم التسليم">تم التسليم</SelectItem><SelectItem value="متأخرة">متأخرة</SelectItem></SelectContent></Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}><SelectTrigger><SelectValue placeholder="الخدمة" /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="الكل">كل الخدمات</SelectItem><SelectItem value="عادي">عادي</SelectItem><SelectItem value="سريع">سريع</SelectItem><SelectItem value="دولي">دولي</SelectItem></SelectContent></Select>
            <span className="result-count">{filteredShipments.length} نتيجة</span>
          </section>
          <ShipmentTable shipments={filteredShipments} onTrack={openTracking} />
        </TabsContent>

        <TabsContent value="tracking" className="workspace-page">
          <section className="page-intro tracking-intro">
            <div><span className="eyebrow">تتبّع لحظي</span><h1>أين وصلت الشحنة؟</h1><p>يجب إدخال رقم التتبع لمشاهدة المسار وآخر محطة وموعد الوصول.</p></div>
            <form className="tracking-search" onSubmit={handleTrack}>
              <MapPin /><Input value={trackingQuery} onChange={(event) => setTrackingQuery(event.target.value.toUpperCase())} placeholder="DEMO-SHP-001" dir="ltr" /><Button type="submit">تتبّع الآن</Button>
            </form>
          </section>
          {trackedShipment ? <TrackingPanel shipment={trackedShipment} /> : (
            <section className="tracking-result empty-state">
              <PackageOpen />
              <strong>لا توجد شحنة محددة</strong>
              <span>يمكن إنشاء شحنة جديدة أو إدخال رقم تتبع موجود.</span>
            </section>
          )}
        </TabsContent>

        <TabsContent value="fleet" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">الموارد الميدانية</span><h1>الأسطول المباشر</h1><p>حالة المركبات والسائقين والصيانة في الوقت الحقيقي.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح نموذج إضافة مركبة")}><Plus />إضافة مركبة</Button>
          </section>
          <section className="fleet-summary">
            <div><Truck /><span>إجمالي المركبات</span><strong>18</strong></div>
            <div><Navigation /><span>على الطريق</span><strong>11</strong></div>
            <div><Building2 /><span>في المحطة</span><strong>5</strong></div>
            <div className="warn"><Settings2 /><span>تحت الصيانة</span><strong>2</strong></div>
          </section>
          <section className="fleet-grid">
            {[
              { plate: "DEMO-VEH-001", driver: "سائق تجريبي 01", route: "دبي ← أبوظبي", load: 76, state: "في الطريق", distance: "64 كم" },
              { plate: "DEMO-VEH-002", driver: "سائق تجريبي 02", route: "دبي ← رأس الخيمة", load: 61, state: "متوقفة مؤقتًا", distance: "112 كم" },
              { plate: "DEMO-VEH-004", driver: "سائق تجريبي 04", route: "دبي ← عجمان", load: 82, state: "في الطريق", distance: "38 كم" },
              { plate: "DEMO-VEH-003", driver: "سائق تجريبي 03", route: "أبوظبي ← دبي", load: 44, state: "في المحطة", distance: "0 كم" },
              { plate: "DEMO-VEH-005", driver: "سائق تجريبي 05", route: "دبي ← الرياض", load: 92, state: "في الطريق", distance: "468 كم" },
              { plate: "DEMO-VEH-006", driver: "بدون سائق", route: "—", load: 0, state: "صيانة", distance: "0 كم" },
            ].map((vehicle) => (
              <article className="vehicle-card" key={vehicle.plate}>
                <div className="vehicle-top"><span className="vehicle-icon"><Truck /></span><span className={`vehicle-state ${vehicle.state.includes("الطريق") ? "moving" : vehicle.state === "صيانة" ? "maintenance" : "station"}`}>{vehicle.state}</span></div>
                <h3>{vehicle.plate}</h3><p>{vehicle.route}</p>
                <div className="vehicle-driver"><UserRound /><span><small>السائق</small><strong>{vehicle.driver}</strong></span></div>
                <div className="load-row"><span>الحمولة</span><strong>{vehicle.load}%</strong></div><Progress value={vehicle.load} />
                <footer><span><Navigation />{vehicle.distance}</span><button onClick={() => toast.info(`عرض تفاصيل ${vehicle.plate}`)}>التفاصيل <ChevronLeft /></button></footer>
              </article>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="pickups" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">قبل بدء الرحلة</span><h1>طلبات الاستلام</h1><p>تنظيم مواعيد الاستلام، توزيع السائقين وتحويل الطلب إلى شحنة.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح طلب استلام جديد")}><Plus />طلب استلام</Button>
          </section>
          <section className="pickup-summary">
            <article><span><ClipboardList /></span><div><small>طلبات اليوم</small><strong>32</strong></div></article>
            <article><span><Clock3 /></span><div><small>بانتظار السائق</small><strong>8</strong></div></article>
            <article><span><Truck /></span><div><small>قيد الاستلام</small><strong>11</strong></div></article>
            <article><span><CheckCircle2 /></span><div><small>اكتملت</small><strong>13</strong></div></article>
          </section>
          <section className="pickup-board">
            {[
              { lane: "مجدولة", count: 8, cards: [
                { id: "DEMO-PU-001", company: "منشأة تجريبية 01", time: "12:30 م", area: "منطقة تجريبية 01", boxes: "6 طرود" },
                { id: "DEMO-PU-002", company: "منشأة تجريبية 02", time: "1:15 م", area: "منطقة تجريبية 02", boxes: "14 طردًا" },
                { id: "DEMO-PU-003", company: "منشأة تجريبية 03", time: "2:00 م", area: "منطقة تجريبية 03", boxes: "4 طرود" },
              ] },
              { lane: "السائق في الطريق", count: 11, cards: [
                { id: "DEMO-PU-004", company: "منشأة تجريبية 04", time: "خلال 18 دقيقة", area: "منطقة تجريبية 04", boxes: "9 طرود" },
                { id: "DEMO-PU-005", company: "منشأة تجريبية 05", time: "خلال 27 دقيقة", area: "منطقة تجريبية 05", boxes: "12 طردًا" },
                { id: "DEMO-PU-006", company: "منشأة تجريبية 06", time: "خلال 34 دقيقة", area: "منطقة تجريبية 06", boxes: "7 طرود" },
              ] },
              { lane: "تم الاستلام", count: 13, cards: [
                { id: "DEMO-PU-007", company: "منشأة تجريبية 07", time: "تم 10:18 ص", area: "منطقة تجريبية 07", boxes: "8 طرود" },
                { id: "DEMO-PU-008", company: "منشأة تجريبية 08", time: "تم 10:44 ص", area: "منطقة تجريبية 08", boxes: "21 طردًا" },
                { id: "DEMO-PU-009", company: "منشأة تجريبية 09", time: "تم 11:05 ص", area: "منطقة تجريبية 09", boxes: "5 طرود" },
              ] },
            ].map((column, columnIndex) => (
              <article className={`pickup-column lane-${columnIndex + 1}`} key={column.lane}>
                <header><div><i /><strong>{column.lane}</strong></div><span>{column.count}</span></header>
                <div className="pickup-cards">
                  {column.cards.map((card) => (
                    <button className="pickup-card" key={card.id} onClick={() => toast.info(`تفاصيل الطلب ${card.id}`)}>
                      <div><span>{card.id}</span><small>{card.time}</small></div>
                      <strong>{card.company}</strong>
                      <p><MapPin />{card.area}</p>
                      <footer><Boxes />{card.boxes}<ChevronLeft /></footer>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="warehouses" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">شبكة المحطات</span><h1>المستودعات ومراكز الفرز</h1><p>السعة، البوابات، الوارد والصادر لكل مركز تشغيل.</p></div>
            <div className="page-quick-actions warehouse-actions">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="new-shipment-button compact-action"><Plus />شحنة جديدة</Button>
                </DialogTrigger>
                <DialogContent className="shipment-dialog" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إنشاء شحنة جديدة</DialogTitle>
                    <DialogDescription>يجب إدخال بيانات المرسل إليه وخط الشحنة، وسيتم إنشاء رقم تتبع تلقائيًا.</DialogDescription>
                  </DialogHeader>
                  <form id="new-shipment-form" className="shipment-form" onSubmit={handleCreateShipment}>
                    <div className="form-field"><Label htmlFor="customer">اسم العميل *</Label><Input id="customer" value={newShipment.customer} onChange={(e) => setNewShipment({ ...newShipment, customer: e.target.value })} placeholder="اسم العميل أو المنشأة" /></div>
                    <div className="form-field"><Label htmlFor="phone">رقم الهاتف *</Label><Input id="phone" value={newShipment.phone} onChange={(e) => setNewShipment({ ...newShipment, phone: e.target.value })} placeholder="+971" dir="ltr" /></div>
                    <div className="form-field"><Label htmlFor="origin">مدينة الانطلاق</Label><Input id="origin" value={newShipment.origin} onChange={(e) => setNewShipment({ ...newShipment, origin: e.target.value })} /></div>
                    <div className="form-field"><Label htmlFor="destination">الوجهة</Label><Input id="destination" value={newShipment.destination} onChange={(e) => setNewShipment({ ...newShipment, destination: e.target.value })} /></div>
                    <div className="form-field"><Label>نوع الخدمة</Label><Select value={newShipment.service} onValueChange={(value: Shipment["service"]) => setNewShipment({ ...newShipment, service: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="عادي">عادي</SelectItem><SelectItem value="سريع">سريع</SelectItem><SelectItem value="دولي">دولي</SelectItem></SelectContent></Select></div>
                    <div className="form-field"><Label htmlFor="weight">الوزن (كغ) *</Label><Input id="weight" type="number" min="0" step="0.1" value={newShipment.weight} onChange={(e) => setNewShipment({ ...newShipment, weight: e.target.value })} /></div>
                    <div className="form-field full"><Label htmlFor="amount">قيمة التحصيل عند التسليم (د.إ)</Label><Input id="amount" type="number" min="0" value={newShipment.amount} onChange={(e) => setNewShipment({ ...newShipment, amount: e.target.value })} /></div>
                  </form>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                    <Button type="submit" form="new-shipment-form" className="new-shipment-button" disabled={shipmentSaving}>{shipmentSaving ? <><LoaderCircle className="spin" />جاري إنشاء الشحنة...</> : "إنشاء الشحنة"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="compact-action" onClick={() => toast.info("ماسح الباركود جاهز")}><ScanLine />مسح باركود</Button>
              <Button variant="outline" className="compact-action" onClick={() => toast.info("ماسح المستودع جاهز")}><PackageOpen />مسح طرد</Button>
              <Button className="new-shipment-button compact-action" onClick={() => toast.success("تم فتح حركة نقل جديدة")}><Truck />حركة نقل</Button>
            </div>
          </section>
          <section className="hub-grid">
            {[
              { city: "مركز دبي الرئيسي", code: "DXB-01", capacity: 78, inbound: 116, outbound: 94, gates: "6 / 8" },
              { city: "محطة أبوظبي", code: "AUH-02", capacity: 61, inbound: 74, outbound: 81, gates: "4 / 6" },
              { city: "محطة الشارقة", code: "SHJ-03", capacity: 44, inbound: 53, outbound: 39, gates: "3 / 5" },
            ].map((hub) => (
              <article className="hub-card" key={hub.code}>
                <header><span><Warehouse /></span><div><strong>{hub.city}</strong><small>{hub.code}</small></div><i>نشط</i></header>
                <div className="capacity-ring" style={{ "--capacity": `${hub.capacity * 3.6}deg` } as React.CSSProperties}><span><strong>{hub.capacity}%</strong><small>السعة</small></span></div>
                <div className="hub-numbers"><span><small>وارد اليوم</small><strong>{hub.inbound}</strong></span><span><small>صادر اليوم</small><strong>{hub.outbound}</strong></span><span><small>بوابات تعمل</small><strong>{hub.gates}</strong></span></div>
                <Button variant="outline" onClick={() => toast.info(`فتح لوحة ${hub.city}`)}>فتح لوحة المركز <ChevronLeft /></Button>
              </article>
            ))}
          </section>
          <section className="module-panel">
            <div className="section-heading"><div><span className="eyebrow">حركة البوابات</span><h2>آخر عمليات الفرز والتحميل</h2></div><span className="live-chip"><i /> مباشر</span></div>
            <Table dir="rtl">
              <TableHeader><TableRow><TableHead>الوقت</TableHead><TableHead>المركز</TableHead><TableHead>البوابة</TableHead><TableHead>العملية</TableHead><TableHead>المركبة</TableHead><TableHead>عدد الطرود</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ["11:42 ص", "مركز تجريبي 01", "G-04", "تحميل مسار تجريبي", "DEMO-VEH-001", "24", "قيد التنفيذ"],
                  ["11:28 ص", "مركز تجريبي 02", "G-02", "تفريغ وارد تجريبي", "DEMO-VEH-002", "18", "مكتمل"],
                  ["11:05 ص", "مركز تجريبي 03", "G-05", "تحميل مسار تجريبي", "DEMO-VEH-003", "31", "مكتمل"],
                  ["10:46 ص", "مركز تجريبي 01", "G-01", "تفريغ طلبات تجريبية", "DEMO-VEH-004", "16", "مكتمل"],
                ].map((row) => <TableRow key={`${row[0]}-${row[2]}`}>{row.map((cell, index) => <TableCell key={index}>{index === 6 ? <span className={cell === "مكتمل" ? "mini-state done" : "mini-state running"}>{cell}</span> : cell}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="drivers" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">الفريق الميداني</span><h1>السائقون والمندوبون</h1><p>الورديات، الأداء، المركبات والمهام الحالية.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح نموذج إضافة سائق")}><Plus />إضافة سائق</Button>
          </section>
          <section className="driver-grid">
            {[
              { initials: "01", name: "سائق تجريبي 01", phone: "رقم تجريبي 01", state: "على الطريق", vehicle: "DEMO-VEH-001", delivered: 18, rating: 98 },
              { initials: "02", name: "سائق تجريبي 02", phone: "رقم تجريبي 02", state: "توقف مؤقت", vehicle: "DEMO-VEH-002", delivered: 14, rating: 91 },
              { initials: "03", name: "سائق تجريبي 03", phone: "رقم تجريبي 03", state: "على الطريق", vehicle: "DEMO-VEH-003", delivered: 21, rating: 97 },
              { initials: "04", name: "سائق تجريبي 04", phone: "رقم تجريبي 04", state: "في المحطة", vehicle: "DEMO-VEH-004", delivered: 16, rating: 95 },
              { initials: "05", name: "سائق تجريبي 05", phone: "رقم تجريبي 05", state: "رحلة دولية", vehicle: "DEMO-VEH-005", delivered: 9, rating: 96 },
              { initials: "06", name: "سائق تجريبي 06", phone: "رقم تجريبي 06", state: "خارج الوردية", vehicle: "—", delivered: 17, rating: 93 },
            ].map((driver) => (
              <article className="driver-card" key={driver.name}>
                <header><span>{driver.initials}</span><div><strong>{driver.name}</strong><small>{driver.phone}</small></div><i className={driver.state === "توقف مؤقت" ? "driver-state warn" : driver.state === "خارج الوردية" ? "driver-state off" : "driver-state"}>{driver.state}</i></header>
                <div className="driver-route"><Truck /><div><small>المركبة الحالية</small><strong>{driver.vehicle}</strong></div></div>
                <div className="driver-kpis"><span><small>تسليمات اليوم</small><strong>{driver.delivered}</strong></span><span><small>مؤشر الأداء</small><strong>{driver.rating}%</strong></span></div>
                <Progress value={driver.rating} />
                <footer><Button variant="ghost" onClick={() => toast.info(`الاتصال بـ ${driver.name}`)}><Phone />اتصال</Button><Button variant="ghost" onClick={() => toast.info(`موقع ${driver.name}`)}><MapPinned />الموقع</Button></footer>
              </article>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="customers" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">إدارة العلاقات</span><h1>العملاء والحسابات التجارية</h1><p>الشحنات، العقود، الحدود الائتمانية ومستحقات التحصيل.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح نموذج عميل جديد")}><Plus />عميل جديد</Button>
          </section>
          <section className="customer-summary">
            <article><Users /><div><small>إجمالي العملاء</small><strong>248</strong></div><span>+12 هذا الشهر</span></article>
            <article><BadgeCheck /><div><small>حسابات تجارية</small><strong>84</strong></div><span>33.8% من العملاء</span></article>
            <article><CircleDollarSign /><div><small>ذمم مستحقة</small><strong>42,850 د.إ</strong></div><span>ضمن المدة 89%</span></article>
          </section>
          <section className="module-panel">
            <div className="module-toolbar"><div className="search-field"><Search /><Input placeholder="البحث باسم العميل أو رقم الهاتف" /></div><Button variant="outline" onClick={() => toast.success("تم تصدير قائمة العملاء")}><FileDown />تصدير</Button></div>
            <Table dir="rtl">
              <TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>نوع الحساب</TableHead><TableHead>الشحنات</TableHead><TableHead>آخر شحنة</TableHead><TableHead>الذمة</TableHead><TableHead>الحالة</TableHead><TableHead>التواصل</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ["عميل تجريبي 01", "رقم تجريبي 01", "تجاري", "146", "اليوم", "1,000 د.إ (تجريبي)", "نشط"],
                  ["عميل تجريبي 02", "رقم تجريبي 02", "تجاري", "98", "اليوم", "0 د.إ (تجريبي)", "نشط"],
                  ["عميل تجريبي 03", "رقم تجريبي 03", "تجاري", "73", "أمس", "750 د.إ (تجريبي)", "نشط"],
                  ["عميل تجريبي 04", "رقم تجريبي 04", "تجاري", "61", "اليوم", "500 د.إ (تجريبي)", "نشط"],
                  ["عميل تجريبي 05", "رقم تجريبي 05", "فردي", "18", "منذ يومين", "0 د.إ (تجريبي)", "نشط"],
                ].map((row) => <TableRow key={row[0]}><TableCell><strong className="customer-name">{row[0]}</strong><span className="cell-subtext">{row[1]}</span></TableCell><TableCell>{row[2]}</TableCell><TableCell>{row[3]}</TableCell><TableCell>{row[4]}</TableCell><TableCell className="money-cell">{row[5]}</TableCell><TableCell><span className="mini-state done">{row[6]}</span></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => toast.info(`فتح حساب ${row[0]}`)}>فتح الحساب <ChevronLeft /></Button></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="accounts" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">الإدارة المالية المتكاملة</span><h1>الحسابات والمالية</h1><p>الإيرادات، المصروفات، الصندوق والبنوك والذمم وتسويات الدفع عند التسليم.</p></div>
            <div className="page-quick-actions"><Button variant="outline" onClick={() => toast.info("تم فتح قيد محاسبي جديد")}><Plus />قيد جديد</Button><Button variant="outline" onClick={() => toast.success("تم إنشاء كشف اليوم")}><ReceiptText />إقفال اليوم</Button></div>
          </section>
          <section className="metrics-grid finance-metrics">
            <StatCard label="إيراد اليوم" value="28,460 د.إ" hint="+8.4% عن الأمس" tone="green" icon={Banknote} />
            <StatCard label="تحصيل COD" value="18,640 د.إ" hint="27 شحنة" tone="brown" icon={WalletCards} />
            <StatCard label="مصروفات التشغيل" value="6,280 د.إ" hint="وقود وصيانة" tone="amber" icon={ReceiptText} />
            <StatCard label="ضريبة القيمة المضافة" value="1,109 د.إ" hint="صافي مستحق اليوم" tone="blue" icon={CircleDollarSign} />
          </section>
          <section className="finance-layout">
            <article className="module-panel revenue-panel">
              <div className="section-heading"><div><span className="eyebrow">آخر 7 أيام</span><h2>الإيرادات اليومية</h2></div><strong className="total-revenue">172,930 د.إ</strong></div>
              <div className="revenue-chart">
                {[58, 71, 66, 84, 76, 92, 81].map((height, index) => <div key={index}><span style={{ height: `${height}%` }}><i>{[18.2, 22.1, 20.4, 26.8, 23.7, 28.5, 25.1][index]}K</i></span><small>{["خ", "ج", "س", "ح", "ث", "ن", "أ"][index]}</small></div>)}
              </div>
            </article>
            <article className="module-panel settlement-panel">
              <div className="section-heading"><div><span className="eyebrow">الدفع عند التسليم</span><h2>تسويات السائقين</h2></div><button onClick={() => toast.info("عرض جميع التسويات")}>عرض الكل</button></div>
              {[
                ["سائق تجريبي 01", "8 شحنات تجريبية", "1,000 د.إ (تجريبي)", "جاهزة"],
                ["سائق تجريبي 02", "7 شحنات تجريبية", "900 د.إ (تجريبي)", "جاهزة"],
                ["سائق تجريبي 03", "6 شحنات تجريبية", "800 د.إ (تجريبي)", "تمت"],
                ["سائق تجريبي 04", "4 شحنات تجريبية", "600 د.إ (تجريبي)", "مراجعة"],
              ].map((row) => <div className="settlement-row" key={row[0]}><span className="avatar-small">{row[0].slice(0, 1)}</span><div><strong>{row[0]}</strong><small>{row[1]}</small></div><b>{row[2]}</b><i className={row[3] === "تمت" ? "done" : row[3] === "مراجعة" ? "warn" : ""}>{row[3]}</i></div>)}
            </article>
          </section>
          <section className="accounting-lower-grid">
            <article className="module-panel account-balances">
              <div className="section-heading"><div><span className="eyebrow">الأرصدة الحالية</span><h2>الصندوق والحسابات البنكية</h2></div><Landmark /></div>
              {[
                ["صندوق تجريبي", "نقدي", "32,480 د.إ (تجريبي)", "محدّث الآن"],
                ["حساب بنكي تجريبي", "بنكي", "184,920 د.إ (تجريبي)", "محدّث 11:20 ص"],
                ["عهدة سائقين تجريبية", "عهد", "18,640 د.إ (تجريبي)", "27 حركة مفتوحة"],
                ["ذمم عملاء تجريبية", "مدين", "42,850 د.إ (تجريبي)", "12 فاتورة مستحقة"],
              ].map((account) => <button className="account-row" key={account[0]} onClick={() => toast.info(`فتح ${account[0]}`)}><span><WalletCards /></span><div><strong>{account[0]}</strong><small>{account[1]} · {account[3]}</small></div><b>{account[2]}</b><ChevronLeft /></button>)}
            </article>
            <article className="module-panel expenses-panel">
              <div className="section-heading"><div><span className="eyebrow">مصروفات التشغيل</span><h2>آخر المصروفات</h2></div><Button variant="ghost" size="sm" onClick={() => toast.info("إضافة مصروف جديد")}><Plus />مصروف</Button></div>
              {[
                ["وقود الأسطول التجريبي", "محطة تجريبية", "500 د.إ (تجريبي)", "اليوم"],
                ["صيانة دورية تجريبية", "DEMO-VEH-006", "400 د.إ (تجريبي)", "اليوم"],
                ["رسوم بوابات تجريبية", "مسار تجريبي", "150 د.إ (تجريبي)", "أمس"],
                ["مواد تغليف تجريبية", "مورد تجريبي", "250 د.إ (تجريبي)", "أمس"],
              ].map((expense) => <div className="expense-row" key={`${expense[0]}-${expense[3]}`}><span><ReceiptText /></span><div><strong>{expense[0]}</strong><small>{expense[1]} · {expense[3]}</small></div><b>{expense[2]}</b></div>)}
            </article>
          </section>
          <section className="module-panel accounting-table-panel">
            <div className="section-heading"><div><span className="eyebrow">القيود والفواتير</span><h2>الحركات المحاسبية الأخيرة</h2></div><div className="page-quick-actions"><Button variant="outline" size="sm" onClick={() => toast.success("تم تصدير دفتر اليومية")}><FileDown />تصدير</Button><Button variant="outline" size="sm" onClick={() => window.print()}><Printer />طباعة</Button></div></div>
            <Table dir="rtl"><TableHeader><TableRow><TableHead>رقم الحركة</TableHead><TableHead>التاريخ</TableHead><TableHead>البيان</TableHead><TableHead>الحساب</TableHead><TableHead>مدين</TableHead><TableHead>دائن</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>
              {[
                ["DEMO-JV-01", "تاريخ تجريبي", "تسوية سائق تجريبي 01", "عهدة تجريبية", "1,000 د.إ (تجريبي)", "—", "مرحّل"],
                ["DEMO-EX-01", "تاريخ تجريبي", "مصروف وقود تجريبي", "مصروف تجريبي", "500 د.إ (تجريبي)", "—", "مرحّل"],
                ["DEMO-INV-01", "تاريخ تجريبي", "فاتورة عميل تجريبي 01", "ذمم تجريبية", "—", "1,500 د.إ (تجريبي)", "مستحقة"],
                ["DEMO-RC-01", "تاريخ تجريبي", "تحصيل عميل تجريبي 02", "حساب تجريبي", "2,000 د.إ (تجريبي)", "—", "مرحّل"],
              ].map((row) => <TableRow key={row[0]}>{row.map((cell, index) => <TableCell key={index}>{index === 6 ? <span className={cell === "مستحقة" ? "mini-state warn" : "mini-state done"}>{cell}</span> : cell}</TableCell>)}</TableRow>)}
            </TableBody></Table>
          </section>
        </TabsContent>

        <TabsContent value="tax" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">ضريبة القيمة المضافة في الإمارات</span><h1>الإقرار الضريبي</h1><p>تجميع ضريبة المخرجات والمدخلات ومراجعة الفترة قبل تقديم الإقرار.</p></div>
            <div className="page-quick-actions"><Select defaultValue="q3"><SelectTrigger><CalendarDays /><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="q3">الربع الثالث 2026</SelectItem><SelectItem value="q2">الربع الثاني 2026</SelectItem><SelectItem value="h1">النصف الأول 2026</SelectItem><SelectItem value="year">السنة 2026</SelectItem></SelectContent></Select><Button className="new-shipment-button" onClick={() => toast.success("تم تجهيز مسودة الإقرار الضريبي")}><ClipboardCheck />تحضير الإقرار</Button></div>
          </section>
          <section className="tax-period-banner"><span><CirclePercent /></span><div><small>فترة ضريبية تجريبية</small><strong>فترة عرض غير حقيقية</strong><p>جميع القيم أدناه بيانات تجريبية</p></div><i>للعرض فقط</i></section>
          <section className="tax-summary-grid">
            <article><span><ReceiptText /></span><div><small>مبيعات خاضعة للضريبة</small><strong>286,400 د.إ</strong><p>قيمة تجريبية</p></div></article>
            <article><span><CircleDollarSign /></span><div><small>ضريبة المخرجات</small><strong>14,320 د.إ</strong><p>قيمة تجريبية</p></div></article>
            <article><span><FileCheck2 /></span><div><small>ضريبة مدخلات قابلة للاسترداد</small><strong>4,860 د.إ</strong><p>قيمة تجريبية</p></div></article>
            <article className="tax-payable"><span><Landmark /></span><div><small>صافي الضريبة المستحقة</small><strong>9,460 د.إ</strong><p>قيمة تجريبية</p></div></article>
          </section>
          <section className="tax-layout">
            <article className="module-panel tax-calculation">
              <div className="section-heading"><div><span className="eyebrow">ملخص الاحتساب</span><h2>حساب الضريبة المستحقة</h2></div><CirclePercent /></div>
              <div className="tax-equation"><div><span>ضريبة المخرجات</span><strong>14,320.00 د.إ</strong></div><i>−</i><div><span>ضريبة المدخلات</span><strong>4,860.00 د.إ</strong></div><i>+</i><div><span>تعديلات الفترة</span><strong>0.00 د.إ</strong></div><b>=</b><div className="tax-result"><span>صافي المستحق</span><strong>9,460.00 د.إ</strong></div></div>
              <div className="tax-breakdown"><span><small>إمارة دبي</small><strong>7,180 د.إ</strong></span><span><small>إمارة أبوظبي</small><strong>1,540 د.إ</strong></span><span><small>الإمارات الأخرى</small><strong>740 د.إ</strong></span></div>
            </article>
            <article className="module-panel filing-checklist">
              <div className="section-heading"><div><span className="eyebrow">قبل الاعتماد</span><h2>قائمة مراجعة الإقرار</h2></div><ClipboardCheck /></div>
              {[
                ["تمت مطابقة فواتير المبيعات", "286 فاتورة", true],
                ["تمت مراجعة فواتير المشتريات", "94 فاتورة", true],
                ["تمت مطابقة المصروفات القابلة للاسترداد", "38 حركة", true],
                ["مراجعة التعديلات والمبالغ المستبعدة", "تحتاج مراجعة", false],
              ].map((item) => <div className={item[2] ? "checklist-row complete" : "checklist-row"} key={item[0] as string}><span>{item[2] ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div></div>)}
              <Button variant="outline" onClick={() => toast.info("تم فتح مراجعة الإقرار")}>فتح المراجعة التفصيلية</Button>
            </article>
          </section>
          <section className="module-panel tax-history">
            <div className="section-heading"><div><span className="eyebrow">السجل الضريبي</span><h2>الإقرارات السابقة</h2></div><Button variant="outline" size="sm" onClick={() => toast.success("تم تصدير سجل الإقرارات")}><FileDown />تصدير</Button></div>
            <Table dir="rtl"><TableHeader><TableRow><TableHead>الفترة</TableHead><TableHead>المبيعات</TableHead><TableHead>ضريبة المخرجات</TableHead><TableHead>ضريبة المدخلات</TableHead><TableHead>صافي المستحق</TableHead><TableHead>تاريخ التقديم</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>
              {[
                ["فترة تجريبية 01", "264,180 د.إ (تجريبي)", "13,209 د.إ (تجريبي)", "4,420 د.إ (تجريبي)", "8,789 د.إ (تجريبي)", "تاريخ تجريبي", "مقدّم"],
                ["فترة تجريبية 02", "238,540 د.إ (تجريبي)", "11,927 د.إ (تجريبي)", "3,980 د.إ (تجريبي)", "7,947 د.إ (تجريبي)", "تاريخ تجريبي", "مقدّم"],
                ["فترة تجريبية 03", "219,760 د.إ (تجريبي)", "10,988 د.إ (تجريبي)", "3,660 د.إ (تجريبي)", "7,328 د.إ (تجريبي)", "تاريخ تجريبي", "مقدّم"],
              ].map((row) => <TableRow key={row[0]}>{row.map((cell, index) => <TableCell key={index}>{index === 6 ? <span className="mini-state done">{cell}</span> : cell}</TableCell>)}</TableRow>)}
            </TableBody></Table>
          </section>
        </TabsContent>

        <TabsContent value="customs" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">الشحن الدولي والوثائق</span><h1>التخليص الجمركي</h1><p>إدارة ملفات التخليص، المستندات، البنود الجمركية والرسوم حتى الإفراج.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح ملف تخليص جديد")}><Plus />ملف تخليص جديد</Button>
          </section>
          <section className="customs-summary">
            <article><FolderOpen /><div><small>ملفات مفتوحة</small><strong>17</strong></div><span>6 وارد · 11 صادر</span></article>
            <article><FileText /><div><small>بانتظار مستندات</small><strong>4</strong></div><span>تحتاج متابعة</span></article>
            <article><Stamp /><div><small>تحت المعاينة</small><strong>2</strong></div><span>الجمارك</span></article>
            <article><CheckCircle2 /><div><small>تم الإفراج اليوم</small><strong>11</strong></div><span>متوسط 5.2 ساعة</span></article>
          </section>
          <section className="customs-layout">
            <article className="module-panel customs-cases">
              <div className="section-heading"><div><span className="eyebrow">حالات التخليص</span><h2>الشحنات الدولية الحالية</h2></div><Globe2 /></div>
              <Table dir="rtl"><TableHeader><TableRow><TableHead>رقم الملف</TableHead><TableHead>الشحنة</TableHead><TableHead>المنفذ</TableHead><TableHead>البلد</TableHead><TableHead>رمز HS</TableHead><TableHead>الرسوم</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>
                {[
                  ["DEMO-CLR-01", "DEMO-SHP-006", "منفذ تجريبي 01", "السعودية", "8517.62", "1,000 د.إ (تجريبي)", "قيد المراجعة"],
                  ["DEMO-CLR-02", "DEMO-SHP-007", "منفذ تجريبي 02", "الصين", "9403.60", "2,000 د.إ (تجريبي)", "بانتظار مستند"],
                  ["DEMO-CLR-03", "DEMO-SHP-008", "منفذ تجريبي 03", "ألمانيا", "8471.30", "1,500 د.إ (تجريبي)", "تحت المعاينة"],
                  ["DEMO-CLR-04", "DEMO-SHP-009", "منفذ تجريبي 04", "الهند", "6204.62", "2,500 د.إ (تجريبي)", "تم الإفراج"],
                ].map((row) => <TableRow key={row[0]}><TableCell className="tracking-id">{row[0]}</TableCell><TableCell>{row[1]}</TableCell><TableCell>{row[2]}</TableCell><TableCell>{row[3]}</TableCell><TableCell className="hs-code">{row[4]}</TableCell><TableCell className="money-cell">{row[5]}</TableCell><TableCell><span className={row[6] === "تم الإفراج" ? "mini-state done" : row[6] === "بانتظار مستند" ? "mini-state warn" : "mini-state running"}>{row[6]}</span></TableCell></TableRow>)}
              </TableBody></Table>
            </article>
            <aside className="module-panel customs-documents">
              <div className="section-heading"><div><span className="eyebrow">DEMO-CLR-01</span><h2>مستندات الملف</h2></div><FileCheck2 /></div>
              {[
                ["الفاتورة التجارية", true],
                ["قائمة التعبئة", true],
                ["شهادة المنشأ", true],
                ["بوليصة الشحن", true],
                ["تصريح الاستيراد", false],
              ].map((doc) => <div className={doc[1] ? "customs-doc ready" : "customs-doc missing"} key={doc[0] as string}><span>{doc[1] ? <CheckCircle2 /> : <AlertTriangle />}</span><strong>{doc[0]}</strong><small>{doc[1] ? "مرفق" : "مطلوب"}</small></div>)}
              <Button variant="outline" onClick={() => toast.info("تم فتح رفع المستندات")}><FileText />إرفاق مستند</Button>
            </aside>
          </section>
          <section className="customs-lower-grid">
            <article className="module-panel duty-calculator"><div className="section-heading"><div><span className="eyebrow">تقدير تجريبي</span><h2>حاسبة الرسوم الجمركية</h2></div><CirclePercent /></div><div className="customs-form"><div className="form-field"><Label>قيمة البضاعة (د.إ)</Label><Input defaultValue="10000" dir="ltr" /></div><div className="form-field"><Label>الشحن والتأمين (د.إ)</Label><Input defaultValue="1000" dir="ltr" /></div><div className="form-field"><Label>نسبة الرسم</Label><Select defaultValue="5"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">0%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="10">10%</SelectItem></SelectContent></Select></div></div><div className="duty-result"><span>القيمة الجمركية <strong>11,000 د.إ (تجريبي)</strong></span><span>الرسوم التقديرية <strong>550 د.إ (تجريبي)</strong></span><b>الإجمالي قبل الضريبة 11,550 د.إ (تجريبي)</b></div></article>
            <article className="module-panel broker-panel"><div className="section-heading"><div><span className="eyebrow">شريك تخليص تجريبي</span><h2>المخلّص الجمركي</h2></div><BadgeCheck /></div><div className="broker-card"><span>م ت</span><div><strong>مخلّص تجريبي 01</strong><small>حساب عرض غير حقيقي</small></div><i>متاح</i></div><div className="broker-stats"><span><small>ملفات هذا الشهر</small><strong>48</strong></span><span><small>متوسط التخليص</small><strong>5.2 ساعة</strong></span><span><small>نسبة النجاح</small><strong>98.4%</strong></span></div><Button variant="outline" onClick={() => toast.info("تم فتح التواصل التجريبي")}><Phone />تواصل مع المخلّص</Button></article>
          </section>
        </TabsContent>

        <TabsContent value="reports" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">ذكاء الأعمال</span><h1>التقارير والتحليلات</h1><p>قياس الأداء التشغيلي والمالي وجودة التسليم.</p></div>
            <div className="page-quick-actions"><Select defaultValue="month"><SelectTrigger><CalendarDays /><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="week">هذا الأسبوع</SelectItem><SelectItem value="month">هذا الشهر</SelectItem><SelectItem value="quarter">هذا الربع</SelectItem><SelectItem value="year">هذه السنة</SelectItem></SelectContent></Select><Button onClick={() => toast.success("تم تجهيز التقرير الشامل")}><FileDown />تصدير التقرير</Button></div>
          </section>
          <section className="report-cards">
            {[
              { icon: PackageCheck, label: "تقرير التسليم", detail: "نسب النجاح والتأخير والإرجاع", value: "96.8%", tone: "green" },
              { icon: Truck, label: "تقرير الأسطول", detail: "الاستخدام والوقود والصيانة", value: "78%", tone: "blue" },
              { icon: WalletCards, label: "تقرير التحصيل", detail: "COD والتسويات والذمم", value: "94.2%", tone: "brown" },
              { icon: CircleDollarSign, label: "الإقرار الضريبي", detail: "المبيعات والمشتريات وضريبة 5%", value: "5%", tone: "amber" },
            ].map((report) => {
              const Icon = report.icon;
              return <button className={`report-card ${report.tone}`} key={report.label} onClick={() => toast.info(`فتح ${report.label}`)}><span><Icon /></span><div><strong>{report.label}</strong><small>{report.detail}</small></div><b>{report.value}</b><ChevronLeft /></button>;
            })}
          </section>
          <section className="report-layout">
            <article className="module-panel performance-panel">
              <div className="section-heading"><div><span className="eyebrow">مؤشرات الشهر</span><h2>جودة التشغيل</h2></div><Gauge /></div>
              {[
                ["التسليم في الموعد", 94, "+2.1%"],
                ["نجاح المحاولة الأولى", 89, "+1.4%"],
                ["دقة الفرز", 98, "+0.6%"],
                ["استخدام الأسطول", 78, "-1.2%"],
              ].map((metric) => <div className="performance-row" key={metric[0] as string}><div><span>{metric[0]}</span><strong>{metric[1]}%</strong><small className={(metric[2] as string).startsWith("-") ? "negative" : ""}>{metric[2]}</small></div><Progress value={metric[1] as number} /></div>)}
            </article>
            <article className="module-panel route-ranking">
              <div className="section-heading"><div><span className="eyebrow">حسب عدد الشحنات</span><h2>أفضل المسارات</h2></div><Navigation /></div>
              {[
                ["دبي ← أبوظبي", "418 شحنة", "97.2%"],
                ["دبي ← الشارقة", "356 شحنة", "96.5%"],
                ["أبوظبي ← العين", "214 شحنة", "95.8%"],
                ["دبي ← رأس الخيمة", "187 شحنة", "92.4%"],
              ].map((route, index) => <div className="ranking-row" key={route[0]}><span>{index + 1}</span><div><strong>{route[0]}</strong><small>{route[1]}</small></div><b>{route[2]}</b></div>)}
            </article>
          </section>
        </TabsContent>

        <TabsContent value="employees" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">الموارد البشرية والصلاحيات</span><h1>الموظفون</h1><p>ملفات الموظفين، الحضور والورديات والرواتب والإقامات وصلاحيات الدخول.</p></div>
            <Button className="new-shipment-button" onClick={() => toast.success("تم فتح ملف موظف جديد")}><Plus />موظف جديد</Button>
          </section>
          <section className="employee-summary">
            <article><BriefcaseBusiness /><div><small>إجمالي الموظفين</small><strong>24</strong></div><span>3 فروع</span></article>
            <article><Clock3 /><div><small>على رأس العمل</small><strong>17</strong></div><span>وردية اليوم</span></article>
            <article><BadgeDollarSign /><div><small>رواتب هذا الشهر</small><strong>146,800 د.إ</strong></div><span>الصرف 31 أغسطس</span></article>
            <article className="employee-alert"><AlertTriangle /><div><small>وثائق تنتهي قريبًا</small><strong>3</strong></div><span>إقامات ورخص</span></article>
          </section>
          <section className="team-layout">
            <article className="module-panel team-table-panel">
              <Table dir="rtl">
                <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>الوظيفة</TableHead><TableHead>الفرع</TableHead><TableHead>الوردية</TableHead><TableHead>الراتب</TableHead><TableHead>الحالة</TableHead><TableHead>الإجراء</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[
                    ["موظف تجريبي 01", "DEMO-EMP-001", "مدير العمليات", "فرع تجريبي 01", "8 ص — 5 م", "12,500 د.إ (تجريبي)", "حاضر"],
                    ["موظف تجريبي 02", "DEMO-EMP-002", "محاسبة", "فرع تجريبي 01", "9 ص — 6 م", "9,800 د.إ (تجريبي)", "حاضر"],
                    ["موظف تجريبي 03", "DEMO-EMP-003", "مشرف مستودع", "فرع تجريبي 02", "7 ص — 4 م", "8,400 د.إ (تجريبي)", "حاضر"],
                    ["موظف تجريبي 04", "DEMO-EMP-004", "خدمة العملاء", "فرع تجريبي 01", "9 ص — 6 م", "7,200 د.إ (تجريبي)", "إجازة"],
                    ["موظف تجريبي 05", "DEMO-EMP-005", "مسؤول تخليص", "فرع تجريبي 03", "8 ص — 5 م", "10,600 د.إ (تجريبي)", "حاضر"],
                  ].map((user) => <TableRow key={user[1]}><TableCell><strong className="customer-name">{user[0]}</strong><span className="cell-subtext">{user[1]}</span></TableCell><TableCell><span className="role-chip">{user[2]}</span></TableCell><TableCell>{user[3]}</TableCell><TableCell>{user[4]}</TableCell><TableCell className="money-cell">{user[5]}</TableCell><TableCell><span className={user[6] === "إجازة" ? "mini-state warn" : "mini-state done"}>{user[6]}</span></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => toast.info(`فتح ملف ${user[0]}`)}><FolderOpen />الملف</Button></TableCell></TableRow>)}
                </TableBody>
              </Table>
            </article>
            <aside className="module-panel security-panel">
              <span className="security-icon"><KeyRound /></span><h2>الدخول والصلاحيات</h2><p>لكل موظف رمز دخول من 6 أرقام وصلاحيات مستقلة مع سجل نشاط كامل.</p>
              <div><span>مستخدمون فعّالون</span><strong>12</strong></div><div><span>جلسات نشطة</span><strong>5</strong></div><div><span>أدوار معرفة</span><strong>7</strong></div>
              <Button variant="outline" onClick={() => toast.info("فتح إدارة الصلاحيات")}>إدارة الأدوار والصلاحيات</Button>
            </aside>
          </section>
          <section className="employee-lower-grid">
            <article className="module-panel payroll-panel"><div className="section-heading"><div><span className="eyebrow">مسير أغسطس</span><h2>الرواتب والاستحقاقات</h2></div><BadgeDollarSign /></div><div className="payroll-totals"><span><small>إجمالي الرواتب</small><strong>146,800 د.إ</strong></span><span><small>البدلات</small><strong>18,240 د.إ</strong></span><span><small>الخصومات</small><strong>3,180 د.إ</strong></span><span><small>صافي الصرف</small><strong>161,860 د.إ</strong></span></div><Button variant="outline" onClick={() => toast.success("تم تجهيز مسير الرواتب")}>تجهيز مسير الرواتب</Button></article>
            <article className="module-panel document-alerts"><div className="section-heading"><div><span className="eyebrow">تنبيهات الموارد البشرية</span><h2>وثائق تنتهي قريبًا</h2></div><AlertTriangle /></div>{[["موظف تجريبي 06", "رخصة قيادة", "بعد 18 يومًا"], ["موظف تجريبي 07", "الإقامة", "بعد 34 يومًا"], ["موظف تجريبي 08", "تصريح نقل دولي", "بعد 42 يومًا"]].map((item) => <div className="document-row" key={item[0]}><span><FileText /></span><div><strong>{item[0]}</strong><small>{item[1]}</small></div><b>{item[2]}</b></div>)}</article>
          </section>
        </TabsContent>

        <TabsContent value="settings" className="workspace-page">
          <section className="page-intro slim">
            <div><span className="eyebrow">ضبط النظام</span><h1>الإعدادات</h1><p>بيانات المنشأة، التشغيل الآلي، الإشعارات وتفضيلات الشحن.</p></div>
            <Button className="new-shipment-button" onClick={handleSaveSettings} disabled={settingsSaving}>{settingsSaving ? <><LoaderCircle className="spin" />جاري حفظ التغييرات...</> : <><Save />حفظ التغييرات</>}</Button>
          </section>
          <section className="settings-grid">
            <article className="settings-card company-settings">
              <header><span><Building2 /></span><div><strong>بيانات المنشأة</strong><small>تظهر على البوليصات والفواتير</small></div></header>
              <div className="settings-form"><div className="form-field"><Label>اسم المنشأة</Label><Input defaultValue={accountName} /></div><div className="form-field"><Label>الرقم الضريبي</Label><Input placeholder="الرقم الضريبي" dir="ltr" /></div><div className="form-field"><Label>البريد</Label><Input defaultValue={authSession.user.email || ""} dir="ltr" /></div><div className="form-field"><Label>الهاتف</Label><Input placeholder="رقم الهاتف" dir="rtl" /></div></div>
            </article>
            <article className="settings-card automation-settings">
              <header><span><Database /></span><div><strong>أتمتة العمليات</strong><small>قواعد التشغيل اليومية</small></div></header>
              <label className="setting-toggle"><span><strong>التوزيع التلقائي</strong><small>اختيار أقرب سائق متاح</small></span><Switch checked={autoAssign} onCheckedChange={setAutoAssign} /></label>
              <label className="setting-toggle"><span><strong>تحديثات العميل</strong><small>رسائل عند كل مرحلة</small></span><Switch checked={clientUpdates} onCheckedChange={setClientUpdates} /></label>
              <label className="setting-toggle"><span><strong>إثبات التسليم</strong><small>صورة وتوقيع أو رمز OTP</small></span><Switch checked={proofRequired} onCheckedChange={setProofRequired} /></label>
              <label className="setting-toggle"><span><strong>تنبيه سعة المستودع</strong><small>عند وصول السعة إلى 85%</small></span><Switch checked={capacityAlerts} onCheckedChange={setCapacityAlerts} /></label>
            </article>
            <article className="settings-card preferences-settings">
              <header><span><Settings2 /></span><div><strong>تفضيلات النظام</strong><small>اللغة والتنبيهات والطباعة</small></div></header>
              <div className="form-field"><Label>اللغة الرئيسية</Label><Select value={language} onValueChange={selectLanguage}><SelectTrigger><Languages /><SelectValue /></SelectTrigger><SelectContent dir={selectedLanguage.dir}>{languageOptions.map((option) => <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="form-field"><Label>طابعة البوليصات</Label><Select defaultValue="thermal"><SelectTrigger><Printer /><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="thermal">طابعة حرارية 4×6</SelectItem><SelectItem value="a4">طابعة A4</SelectItem></SelectContent></Select></div>
              <div className="preference-note"><MessageSquareText /><span><strong>قوالب الرسائل</strong><small>تم تفعيل 5 رسائل تلقائية للعملاء</small></span><button onClick={() => toast.info("فتح قوالب الرسائل")}>تعديل</button></div>
            </article>
            <article className="settings-card branch-settings">
              <header><span><Warehouse /></span><div><strong>الفروع ومراكز التشغيل</strong><small>ربط المخزون والحسابات بكل فرع</small></div></header>
              {[["مركز دبي الرئيسي", "DXB-01", "الفرع الرئيسي"], ["محطة أبوظبي", "AUH-02", "نشط"], ["محطة الشارقة", "SHJ-03", "نشط"]].map((branch) => <div className="branch-row" key={branch[1]}><span><Building2 /></span><div><strong>{branch[0]}</strong><small>{branch[1]}</small></div><i>{branch[2]}</i><button onClick={() => toast.info(`تعديل ${branch[0]}`)}>تعديل</button></div>)}
              <Button variant="outline" onClick={() => toast.info("إضافة فرع جديد")}><Plus />إضافة فرع</Button>
            </article>
            <article className="settings-card accounting-settings">
              <header><span><ReceiptText /></span><div><strong>إعدادات الحسابات والضريبة</strong><small>العملة والترقيم ونسبة الضريبة</small></div></header>
              <div className="settings-form"><div className="form-field"><Label>العملة</Label><Select defaultValue="aed"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="aed">درهم إماراتي (AED)</SelectItem><SelectItem value="usd">دولار أمريكي (USD)</SelectItem></SelectContent></Select></div><div className="form-field"><Label>ضريبة القيمة المضافة</Label><Input defaultValue="5%" dir="ltr" /></div><div className="form-field"><Label>بداية السنة المالية</Label><Select defaultValue="jan"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="jan">يناير</SelectItem><SelectItem value="jul">يوليو</SelectItem></SelectContent></Select></div><div className="form-field"><Label>بادئة الفاتورة</Label><Input defaultValue="VX-INV-" dir="ltr" /></div></div>
              <label className="setting-toggle"><span><strong>إنشاء قيد تلقائي بعد التسليم</strong><small>ترحيل الإيراد والتحصيل للحسابات</small></span><Switch defaultChecked /></label>
            </article>
            <article className="settings-card security-settings">
              <header><span><ShieldCheck /></span><div><strong>الأمان والنسخ الاحتياطي</strong><small>حماية البيانات وسجل النشاط</small></div></header>
              <label className="setting-toggle"><span><strong>نسخ احتياطي يومي</strong><small>حفظ نسخة مشفّرة كل 24 ساعة</small></span><Switch defaultChecked /></label>
              <label className="setting-toggle"><span><strong>رمز دخول من 6 أرقام</strong><small>مطلوب عند تبديل المستخدم</small></span><Switch defaultChecked /></label>
              <label className="setting-toggle"><span><strong>سجل النشاط</strong><small>تسجيل الإضافة والتعديل والحذف</small></span><Switch defaultChecked /></label>
              <div className="backup-status"><Database /><span><strong>آخر نسخة احتياطية ناجحة</strong><small>اليوم، 3:00 ص</small></span><i>سليمة</i></div>
            </article>
            <article className="settings-card subscription-settings">
              <header><span><BadgeCheck /></span><div><strong>الاشتراك</strong><small>حالة ترخيص النظام</small></div></header>
              <div className="plan-current"><span>VAREX SHIPPING</span><strong>التطبيق جاهز للربط</strong><p>سيتم ربط اختيار الباقة والدفع بموقع Shopify بعد إكمال التطبيقات.</p></div>
              <div className="plan-features"><span><CheckCircle2 />كل وحدات الشحن</span><span><CheckCircle2 />التتبع الحي</span><span><CheckCircle2 />مستخدمون غير محدودين</span></div>
              <Button variant="outline" onClick={() => toast.info("سيتم تفعيل الربط مع Shopify لاحقًا")}>إدارة الاشتراك لاحقًا</Button>
            </article>
          </section>
        </TabsContent>
      </Tabs>

      <footer className="system-footer">
        <div><ShieldCheck />البيانات محمية ومشفّرة</div>
        <span>VAREX Shipping · الإصدار 1.0.0</span>
        <button onClick={handleLogout} disabled={logoutBusy}>{logoutBusy ? <><LoaderCircle className="spin" />جاري تسجيل الخروج...</> : <><Power />تسجيل الخروج</>}</button>
      </footer>
    </main>
  );
}
