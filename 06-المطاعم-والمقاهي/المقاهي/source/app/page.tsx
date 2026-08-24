"use client";

import { useEffect, useState, type CSSProperties } from "react";

type View = "live" | "compose" | "floor" | "recipes" | "prep" | "batches" | "finance" | "tax" | "waste" | "guests" | "insights" | "settings";
type Stage = "قائمة الانتظار" | "الإسبريسو" | "الحليب والخلط" | "اللمسات الأخيرة" | "جاهز للتسليم";

type Ticket = {
  id: string;
  customer: string;
  drink: string;
  details: string;
  age: string;
  stage: Stage;
  channel: "صالة" | "سفري" | "توصيل";
};

type ConfirmRequest = { title: string; message: string; confirmLabel?: string; onConfirm: () => void };
type ConfirmAction = (request: ConfirmRequest) => void;
type Material = { id:string; name:string; category:string; quantity:number; unit:string; cost:number; salePrice:number; vatRate:number; supplier:string; batch:string; location:string };
type LedgerEntry = { id:string; type:"revenue"|"expense"; title:string; category:string; amount:number; vat:number; date:string; source:string; method:string };
type BusinessSettings={name:string;branch:string;currency:string;language:string;trn:string;phone:string};
type OperationSettings={printing:boolean;alerts:boolean;routing:boolean;receipts:boolean};
type SystemUser={name:string;role:string;branch:string;phone:string};

const stages: Stage[] = ["قائمة الانتظار", "الإسبريسو", "الحليب والخلط", "اللمسات الأخيرة", "جاهز للتسليم"];

const themes = [
  { id: "orange", label: "برتقالي محروق", color: "#C75A1B" },
  { id: "coffee", label: "بني القهوة", color: "#8A4B2A" },
  { id: "olive", label: "أخضر زيتوني", color: "#6F7A3D" },
  { id: "teal", label: "أخضر بترولي", color: "#2F6F68" },
  { id: "plum", label: "برقوقي", color: "#76506F" },
  { id: "navy", label: "كحلي", color: "#243B67" },
  { id: "royal", label: "أزرق ملكي", color: "#2F5FA7" },
  { id: "berry", label: "توتي", color: "#9A3E68" },
  { id: "maroon", label: "عنابي", color: "#7A2639" },
  { id: "graphite", label: "جرافيتي", color: "#4B5057" },
  { id: "emerald", label: "زمردي", color: "#2F7A56" },
  { id: "forest", label: "أخضر غابة", color: "#3F6842" },
  { id: "mint", label: "نعناعي داكن", color: "#4F8D78" },
  { id: "cyan", label: "سماوي داكن", color: "#287C91" },
  { id: "sky", label: "أزرق سماوي", color: "#4B86B4" },
  { id: "indigo", label: "نيلي", color: "#4B4F9A" },
  { id: "violet", label: "بنفسجي", color: "#6C4AA1" },
  { id: "lavender", label: "لافندر", color: "#8A6CAD" },
  { id: "magenta", label: "أرجواني", color: "#A43D82" },
  { id: "rose", label: "وردي داكن", color: "#B44F65" },
  { id: "coral", label: "مرجاني", color: "#C65F4A" },
  { id: "brick", label: "طوبي", color: "#A44832" },
  { id: "red", label: "أحمر دافئ", color: "#B43B32" },
  { id: "gold", label: "ذهبي داكن", color: "#B88422" },
  { id: "mustard", label: "خردلي", color: "#A87A18" },
  { id: "sand", label: "رملي", color: "#A66E45" },
  { id: "caramel", label: "كراميل", color: "#B86B31" },
  { id: "steel", label: "أزرق فولاذي", color: "#567488" },
  { id: "slate", label: "رمادي أردوازي", color: "#5E6878" },
  { id: "charcoal", label: "فحمي", color: "#343A40" },
] as const;

type Theme = (typeof themes)[number]["id"];
type SystemSettings={business:BusinessSettings;operations:OperationSettings;theme:Theme;users:SystemUser[]};

const defaultSystemSettings:SystemSettings={
  business:{name:"مقهى أورورا",branch:"دبي",currency:"درهم إماراتي",language:"العربية",trn:"100000000000003",phone:"+971 4 555 0190"},
  operations:{printing:true,alerts:true,routing:true,receipts:false},
  theme:"orange",
  users:[{name:"أريج علوش",role:"إدارة النظام",branch:"دبي",phone:"050 000 1201"},{name:"سامي حداد",role:"إدارة الوردية",branch:"دبي",phone:"050 000 1202"},{name:"رامي ناصر",role:"تشغيل الكاشير",branch:"دبي",phone:"050 000 1203"}],
};

const nav: { id: View; label: string; caption: string; icon: string }[] = [
  { id: "live", label: "التشغيل الحي", caption: "مسار المشروبات", icon: "pulse" },
  { id: "compose", label: "منشئ المشروب", caption: "طلب حسب الوصفة", icon: "sliders" },
  { id: "floor", label: "الصالة والطاولات", caption: "خريطة الضيوف", icon: "floor" },
  { id: "recipes", label: "مختبر الوصفات", caption: "التكلفة والمعايير", icon: "recipe" },
  { id: "prep", label: "تحضير الوردية", caption: "مهام وتجهيزات", icon: "checklist" },
  { id: "batches", label: "المواد والمخزن", caption: "المخزون والدُفعات", icon: "beans" },
  { id: "finance", label: "الحسابات والتقارير", caption: "الإيرادات والأرباح", icon: "wallet" },
  { id: "tax", label: "الإقرار الضريبي", caption: "ضريبة القيمة المضافة", icon: "tax" },
  { id: "waste", label: "الهدر والجودة", caption: "ضبط الفاقد", icon: "drop" },
  { id: "guests", label: "الضيوف والولاء", caption: "العلاقات والنقاط", icon: "guests" },
  { id: "insights", label: "أداء المقهى", caption: "السرعة والجودة", icon: "chart" },
  { id: "settings", label: "الإعدادات", caption: "النظام والتشغيل", icon: "settings" },
];

const initialTickets: Ticket[] = [
  { id: "C-218", customer: "مايا", drink: "سبانيش لاتيه", details: "بارد · وسط · حليب شوفان", age: "01:12", stage: "قائمة الانتظار", channel: "سفري" },
  { id: "C-217", customer: "طاولة 07", drink: "فلات وايت ×2", details: "ساخن · دبل شوت", age: "02:46", stage: "الإسبريسو", channel: "صالة" },
  { id: "C-216", customer: "عمر", drink: "ماتشا لاتيه", details: "بارد · كبير · فانيلا", age: "04:08", stage: "الحليب والخلط", channel: "توصيل" },
  { id: "C-215", customer: "طاولة 03", drink: "V60 إثيوبيا", details: "15g · 250ml · ساخن", age: "05:34", stage: "اللمسات الأخيرة", channel: "صالة" },
  { id: "C-214", customer: "ليلى", drink: "كولد برو", details: "وسط · بدون إضافات", age: "06:01", stage: "جاهز للتسليم", channel: "سفري" },
  { id: "C-213", customer: "طاولة 11", drink: "كابتشينو", details: "ساخن · وسط · قرفة", age: "07:25", stage: "جاهز للتسليم", channel: "صالة" },
];

const recipeOptions = [
  { name: "سبانيش لاتيه", code: "SL", base: "إسبريسو + حليب", time: "3:30", price: 26 },
  { name: "فلات وايت", code: "FW", base: "دبل ريستريتو", time: "2:40", price: 20 },
  { name: "V60 إثيوبيا", code: "V6", base: "ترشيح يدوي", time: "4:10", price: 27 },
  { name: "ماتشا لاتيه", code: "MT", base: "ماتشا + حليب", time: "3:00", price: 28 },
  { name: "كولد برو", code: "CB", base: "نقع 18 ساعة", time: "1:20", price: 24 },
];

const floorTables = [
  { id: "01", seats: 2, status: "متاحة", guest: "" }, { id: "02", seats: 4, status: "مشغولة", guest: "22 د" },
  { id: "03", seats: 2, status: "مشغولة", guest: "18 د" }, { id: "04", seats: 6, status: "محجوزة", guest: "5:00 م" },
  { id: "05", seats: 4, status: "متاحة", guest: "" }, { id: "06", seats: 2, status: "تنظيف", guest: "" },
  { id: "07", seats: 4, status: "مشغولة", guest: "11 د" }, { id: "08", seats: 6, status: "متاحة", guest: "" },
  { id: "09", seats: 2, status: "محجوزة", guest: "5:30 م" }, { id: "10", seats: 4, status: "متاحة", guest: "" },
  { id: "11", seats: 4, status: "مشغولة", guest: "7 د" }, { id: "12", seats: 2, status: "متاحة", guest: "" },
];

const initialMaterials:Material[]=[
  {id:"ETH-0426",name:"بن إثيوبيا غوجي",category:"بن القهوة",quantity:1.8,unit:"كجم",cost:92,salePrice:0,vatRate:5,supplier:"Aurora Roasters",batch:"0426",location:"مخزن التحضير"},
  {id:"MLK-0818",name:"حليب شوفان",category:"ألبان وبدائل",quantity:8,unit:"علبة",cost:14,salePrice:0,vatRate:5,supplier:"Fresh Supply",batch:"0818",location:"الثلاجة 1"},
  {id:"SYR-0809",name:"صوص فانيلا",category:"نكهات",quantity:6,unit:"عبوة",cost:28,salePrice:0,vatRate:5,supplier:"Coffee Supply",batch:"0809",location:"رف النكهات"},
  {id:"CUP-0822",name:"أكواب ورقية وسط",category:"تغليف",quantity:320,unit:"قطعة",cost:.72,salePrice:0,vatRate:5,supplier:"Pack UAE",batch:"0822",location:"المستودع"},
];

const initialLedger:LedgerEntry[]=[
  {id:"REV-1008",type:"revenue",title:"مبيعات الصالة",category:"مبيعات",amount:8420,vat:421,date:"24-08-2026",source:"الكاشير",method:"بطاقة"},
  {id:"REV-1007",type:"revenue",title:"طلبات السفري",category:"مبيعات",amount:6180,vat:309,date:"23-08-2026",source:"الكاشير",method:"نقدي"},
  {id:"REV-1006",type:"revenue",title:"طلبات التوصيل",category:"مبيعات",amount:4260,vat:213,date:"22-08-2026",source:"التوصيل",method:"إلكتروني"},
  {id:"EXP-0804",type:"expense",title:"توريد بن القهوة",category:"مشتريات مخزون",amount:3680,vat:184,date:"22-08-2026",source:"المواد والمخزن",method:"تحويل"},
  {id:"EXP-0803",type:"expense",title:"حليب ومواد باردة",category:"مشتريات مخزون",amount:2120,vat:106,date:"21-08-2026",source:"المواد والمخزن",method:"بطاقة"},
  {id:"EXP-0802",type:"expense",title:"إيجار الفرع",category:"مصروفات تشغيل",amount:5800,vat:290,date:"20-08-2026",source:"الحسابات",method:"تحويل"},
  {id:"EXP-0801",type:"expense",title:"كهرباء ومياه",category:"خدمات",amount:920,vat:46,date:"19-08-2026",source:"الحسابات",method:"تحويل"},
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:1.75, strokeLinecap:"round" as const, strokeLinejoin:"round" as const, "aria-hidden":true };
  switch(name){
    case "pulse": return <svg {...p}><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>;
    case "sliders": return <svg {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>;
    case "floor": return <svg {...p}><path d="M4 10h16M6 10V6h12v4M7 10l-2 9M17 10l2 9"/></svg>;
    case "recipe": return <svg {...p}><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/></svg>;
    case "checklist": return <svg {...p}><path d="m4 6 2 2 3-4M11 6h9M4 13l2 2 3-4M11 13h9M4 20l2-2 2 2M11 20h9"/></svg>;
    case "beans": return <svg {...p}><path d="M16.5 3.5c3 2 4 5.7 2.3 9.4-1.8 3.9-6.3 6.8-10.2 6.6-3.8-.2-5.7-3.2-4.1-6.8 1.7-3.7 6-6.8 9.8-6.8"/><path d="M6 17c4-1 5-5 5-9"/></svg>;
    case "drop": return <svg {...p}><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/><path d="M9 15c.5 1.2 1.4 1.8 2.7 2"/></svg>;
    case "guests": return <svg {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"/></svg>;
    case "chart": return <svg {...p}><path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/></svg>;
    case "wallet": return <svg {...p}><path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13v3"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/></svg>;
    case "tax": return <svg {...p}><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/><path d="m15 14 3 3M18 14l-3 3"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
    case "download": return <svg {...p}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>;
    case "switch": return <svg {...p}><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="m18 7-3 3M6 17l3-3"/></svg>;
    case "logout": return <svg {...p}><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>;
    case "bell": return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
    case "palette": return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.3-4c-.8-.6-.4-1.8.6-1.8H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17.2" cy="11" r="1"/></svg>;
    case "sound": return <svg {...p}><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/></svg>;
    case "sound-off": return <svg {...p}><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="m16 10 5 5M21 10l-5 5"/></svg>;
    case "moon": return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "arrow": return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "check": return <svg {...p}><path d="m5 12 4 4L19 6"/></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "spark": return <svg {...p}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></svg>;
    case "thermo": return <svg {...p}><path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/></svg>;
    case "timer": return <svg {...p}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>;
    default: return null;
  }
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

let systemAudioContext: AudioContext | null = null;
function playSystemClick(){
  try{
    const AudioEngine=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioEngine)return;
    systemAudioContext=systemAudioContext||new AudioEngine();
    if(systemAudioContext.state==="suspended")void systemAudioContext.resume();
    const now=systemAudioContext.currentTime;
    const oscillator=systemAudioContext.createOscillator();
    const gain=systemAudioContext.createGain();
    oscillator.type="triangle";
    oscillator.frequency.setValueAtTime(620,now);
    oscillator.frequency.exponentialRampToValueAtTime(360,now+.026);
    gain.gain.setValueAtTime(.026,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.03);
    oscillator.connect(gain);gain.connect(systemAudioContext.destination);
    oscillator.start(now);oscillator.stop(now+.032);
  }catch{}
}

export default function Home(){
  const [view,setView]=useState<View>("live");
  const [systemSettings,setSystemSettings]=useState<SystemSettings>(defaultSystemSettings);
  const [settingsSaving,setSettingsSaving]=useState(false);
  const [settingsSavingLabel,setSettingsSavingLabel]=useState("جاري الحفظ...");
  const [loggingOut,setLoggingOut]=useState(false);
  const [themeMenu,setThemeMenu]=useState(false);
  const [drinkModal,setDrinkModal]=useState(false);
  const [confirmBox,setConfirmBox]=useState<ConfirmRequest|null>(null);
  const [tickets,setTickets]=useState<Ticket[]>(initialTickets);
  const [materials,setMaterials]=useState<Material[]>(initialMaterials);
  const [ledger,setLedger]=useState<LedgerEntry[]>(initialLedger);
  const [toast,setToast]=useState("");
  const [selectedRecipe,setSelectedRecipe]=useState(recipeOptions[0]);
  const [temperature,setTemperature]=useState("بارد");
  const [size,setSize]=useState("وسط");
  const [milk,setMilk]=useState("شوفان");
  const [shots,setShots]=useState(2);
  const [syrup,setSyrup]=useState("بدون");
  const [channel,setChannel]=useState<Ticket["channel"]>("سفري");
  const [soundEnabled,setSoundEnabled]=useState(true);
  const [clock,setClock]=useState<Date|null>(null);

  useEffect(()=>{let active=true;fetch("/api/cafe-settings",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error("settings");return response.json() as Promise<SystemSettings>}).then(saved=>{if(!active)return;const theme=themes.some(item=>item.id===saved.theme)?saved.theme:"orange";setSystemSettings({...defaultSystemSettings,...saved,business:{...defaultSystemSettings.business,...saved.business},operations:{...defaultSystemSettings.operations,...saved.operations},theme,users:Array.isArray(saved.users)?saved.users:defaultSystemSettings.users})}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{
    const restore=window.setTimeout(()=>{
      setSoundEnabled(localStorage.getItem("varex_cafe_system_sound")!=="off");
      setClock(new Date());
    },0);
    const timer=window.setInterval(()=>setClock(new Date()),1000);
    return()=>{window.clearTimeout(restore);window.clearInterval(timer)};
  },[]);
  useEffect(()=>{
    const onClick=()=>{if(soundEnabled)playSystemClick()};
    document.addEventListener("click",onClick,true);
    return()=>document.removeEventListener("click",onClick,true);
  },[soundEnabled]);

  const current=nav.find(x=>x.id===view)!;
  const appearance=themes.find(item=>item.id===systemSettings.theme)??themes[0];
  const timeText=clock?new Intl.DateTimeFormat("ar-AE",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(clock):"--:--";
  const dateText=clock?new Intl.DateTimeFormat("ar-AE",{timeZone:"Asia/Dubai",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(clock):"";
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2200)}
  async function saveSystemSettings(next:SystemSettings=systemSettings,message="تم حفظ الإعدادات وربطها بالنظام",busyLabel="جاري الحفظ..."){
    const started=Date.now();
    setSettingsSavingLabel(busyLabel);
    setSettingsSaving(true);
    try{const response=await fetch("/api/cafe-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});if(!response.ok)throw new Error("save");const saved=await response.json() as SystemSettings;const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>window.setTimeout(resolve,remaining));setSystemSettings({...next,...saved,theme:themes.some(item=>item.id===saved.theme)?saved.theme:next.theme});notify(message);return true}catch{const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>window.setTimeout(resolve,remaining));notify("تعذر حفظ الإعدادات، يرجى إعادة المحاولة");return false}finally{setSettingsSaving(false)}
  }
  async function logout(){
    if(loggingOut)return;
    const started=Date.now();setLoggingOut(true);
    try{await fetch("/api/auth/sign-out",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"})}catch{}
    const remaining=Math.max(0,2200-(Date.now()-started));if(remaining)await new Promise(resolve=>window.setTimeout(resolve,remaining));
    window.location.replace("/login.html");
  }
  function confirm(request:ConfirmRequest){setConfirmBox(request)}
  function acceptConfirm(){const action=confirmBox?.onConfirm;setConfirmBox(null);action?.()}
  function advance(id:string){
    setTickets(items=>items.map(t=>{
      if(t.id!==id)return t;
      const index=stages.indexOf(t.stage);
      return {...t,stage:stages[Math.min(stages.length-1,index+1)]};
    }));
  }
  function launchDrink(){
    const id=`C-${219+tickets.length-initialTickets.length}`;
    setTickets(items=>[{id,customer:"طلب جديد",drink:selectedRecipe.name,details:`${temperature} · ${size} · حليب ${milk} · ${shots} شوت`,age:"00:00",stage:"قائمة الانتظار",channel},...items]);
    setDrinkModal(false);notify("وصلت الوصفة إلى مسار التحضير");setView("live");
  }

  return <div className="cafe-os" style={{"--ember":appearance.color} as CSSProperties}>
    {toast&&<div className="toast"><Icon name="check" size={17}/>{toast}</div>}
    {drinkModal&&<div className="modal-layer" role="dialog" aria-modal="true" aria-label="إنشاء مشروب"><section className="command-modal drink-command"><header><span><Icon name="spark"/></span><div><small>أمر جديد</small><h2>إنشاء مشروب</h2><p>تحديد الوصفة والتخصيص وقناة الطلب قبل إطلاق مسار التحضير.</p></div></header><div className="command-grid"><label>المشروب<select value={selectedRecipe.name} onChange={e=>setSelectedRecipe(recipeOptions.find(item=>item.name===e.target.value)??recipeOptions[0])}>{recipeOptions.map(item=><option key={item.name}>{item.name}</option>)}</select></label><label>الحرارة<select value={temperature} onChange={e=>setTemperature(e.target.value)}><option>ساخن</option><option>بارد</option></select></label><label>الحجم<select value={size} onChange={e=>setSize(e.target.value)}><option>صغير</option><option>وسط</option><option>كبير</option></select></label><label>نوع الحليب<select value={milk} onChange={e=>setMilk(e.target.value)}><option>كامل الدسم</option><option>قليل الدسم</option><option>شوفان</option><option>لوز</option></select></label><label>شوتات الإسبريسو<select value={shots} onChange={e=>setShots(Number(e.target.value))}>{[1,2,3,4].map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>النكهة<select value={syrup} onChange={e=>setSyrup(e.target.value)}><option>بدون</option><option>فانيلا</option><option>كراميل</option><option>بندق</option></select></label><label className="wide">قناة الطلب<div className="modal-channel">{(["صالة","سفري","توصيل"] as Ticket["channel"][]).map(item=><button className={channel===item?"active":""} key={item} onClick={()=>setChannel(item)}>{item}</button>)}</div></label></div><footer><button className="secondary" onClick={()=>confirm({title:"إلغاء إنشاء المشروب",message:"هل تريد إلغاء بيانات المشروب الحالية؟",confirmLabel:"تأكيد الإلغاء",onConfirm:()=>setDrinkModal(false)})}>إلغاء</button><button onClick={launchDrink}><Icon name="pulse" size={16}/>تأكيد وإطلاق المسار</button></footer></section></div>}
    {confirmBox&&<div className="modal-layer confirm-layer" role="alertdialog" aria-modal="true" aria-label={confirmBox.title}><section className="confirm-modal"><span><Icon name="check"/></span><h2>{confirmBox.title}</h2><p>{confirmBox.message}</p><footer><button className="secondary" onClick={()=>setConfirmBox(null)}>إلغاء</button><button onClick={acceptConfirm}>{confirmBox.confirmLabel??"تأكيد"}</button></footer></section></div>}
    <header className="rail">
      <button className="varex-brand" onClick={()=>setView("live")}>
        <img className="approved-varex-logo" src="/varex-approved-transparent-512.png" alt="VAREX Business Management System"/>
        <span className="brand-copy"><b>VAREX</b><small>BUSINESS MANAGEMENT SYSTEM</small></span>
      </button>
      <div className="cafe-identity"><i>CAFÉ OS</i><strong>{systemSettings.business.name}</strong><span><em/> فرع {systemSettings.business.branch} · الوردية مفتوحة</span></div>
      <nav>{nav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>setView(item.id)}><span><Icon name={item.icon}/></span><b>{item.label}<small>{item.caption}</small></b></button>)}</nav>
      <div className="rail-bottom"><button className="owner"><span>AA</span><b><strong>أريج علوش</strong><small>إدارة النظام</small></b></button><div className="account-actions"><button disabled={loggingOut} onClick={()=>confirm({title:"تبديل المستخدم",message:"هل تريد الانتقال إلى شاشة اختيار المستخدم؟",confirmLabel:"متابعة",onConfirm:()=>notify("تم فتح اختيار المستخدم")})}><Icon name="switch" size={15}/><span>تبديل المستخدم</span></button><button className="logout" disabled={loggingOut} onClick={()=>confirm({title:"تسجيل الخروج",message:"هل تريد إنهاء الجلسة الحالية وتسجيل الخروج؟",confirmLabel:"تسجيل الخروج",onConfirm:()=>{void logout()}})}><Icon name="logout" size={15}/><span>{loggingOut?"جاري تسجيل الخروج...":"تسجيل الخروج"}</span></button></div><p>VAREX Café v1.0</p></div>
    </header>

    <main className="stage">
      <header className="shift-bar">
        <div className="shift-title"><span className="mobile-brand">VAREX CAFÉ</span><Badge tone="live"><i/> الوردية مفتوحة</Badge><div><small>وردية المساء</small><strong>04:22 PM</strong></div></div>
        <div className="crew"><span className="crew-label">فريق التحضير الآن</span><i>MH</i><i>RA</i><i>SK</i><b>3 في الفريق</b></div>
        <div className="shift-actions">
          <a className="download-app-control" href="/cafe-download.html" title="تحميل تطبيق المقاهي"><Icon name="download"/><span>تحميل التطبيق</span></a>
          <button onClick={()=>confirm({title:"لغة النظام",message:"هل تريد فتح خيارات لغة النظام؟",confirmLabel:"فتح اللغات",onConfirm:()=>setView("settings")})}>{systemSettings.business.language} <span>{systemSettings.business.language==="العربية"?"AR":"EN"}</span></button>
          <div className="theme-control">
            <button aria-label="تغيير المظهر العام" onClick={()=>setThemeMenu(x=>!x)}><Icon name="palette"/></button>
            {themeMenu&&<div className="theme-popover" aria-label="ألوان المظهر">{themes.map(item=><button key={item.id} className={systemSettings.theme===item.id?"selected":""} onClick={()=>{const next={...systemSettings,theme:item.id};setSystemSettings(next);setThemeMenu(false);void saveSystemSettings(next,"تم حفظ لون المظهر")}}><i style={{background:item.color}}/><span>{item.label}</span></button>)}</div>}
          </div>
          <button className={`sound-control ${soundEnabled?"":"off"}`} aria-pressed={soundEnabled} aria-label={soundEnabled?"إيقاف صوت النقر":"تشغيل صوت النقر"} title={soundEnabled?"إيقاف صوت النقر":"تشغيل صوت النقر"} onClick={()=>setSoundEnabled(current=>{const next=!current;localStorage.setItem("varex_cafe_system_sound",next?"on":"off");if(next)window.setTimeout(playSystemClick,0);return next})}><Icon name={soundEnabled?"sound":"sound-off"}/><span>{soundEnabled?"الصوت":"صامت"}</span></button>
          <div className="system-clock" role="status" aria-label={`الوقت ${timeText}، التاريخ ${dateText}`}><Icon name="clock"/><span><b>{timeText}</b><small>{dateText}</small></span></div>
          <button className="alerts" aria-label="الإشعارات" onClick={()=>confirm({title:"مركز الإشعارات",message:"هل تريد فتح تنبيهات الطلبات والجودة؟",confirmLabel:"فتح الإشعارات",onConfirm:()=>notify("تم فتح مركز الإشعارات")})}><Icon name="bell"/><i/></button>
        </div>
      </header>

      <section className="page-intro">
        <div><span>{current.caption}</span><h1>{current.label}</h1><p>{view==="live"?"متابعة كل كوب من لحظة الطلب حتى التسليم، مع عرض محطات تحضير القهوة لحظة بلحظة.":pageDescription(view)}</p></div>
        {view!=="compose"&&<button className="compose-cta" onClick={()=>setDrinkModal(true)}><Icon name="spark"/><span>إنشاء مشروب</span><small>وصفة جديدة للمقهى</small></button>}
      </section>

      {view==="live"&&<LiveFlow tickets={tickets} advance={advance} onOpenPrep={()=>setView("prep")} confirm={confirm}/>} 
      {view==="compose"&&<Composer recipe={selectedRecipe} setRecipe={setSelectedRecipe} temperature={temperature} setTemperature={setTemperature} size={size} setSize={setSize} milk={milk} setMilk={setMilk} shots={shots} setShots={setShots} syrup={syrup} setSyrup={setSyrup} channel={channel} setChannel={setChannel} launch={()=>setDrinkModal(true)}/>} 
      {view==="floor"&&<Floor confirm={confirm} notify={notify}/>} 
      {view==="recipes"&&<RecipeLab confirm={confirm} notify={notify}/>} 
      {view==="prep"&&<PrepShift notify={notify} confirm={confirm}/>} 
      {view==="batches"&&<Batches materials={materials} setMaterials={setMaterials} ledger={ledger} setLedger={setLedger} confirm={confirm} notify={notify}/>} 
      {view==="finance"&&<Finance ledger={ledger} setLedger={setLedger} materials={materials} confirm={confirm} notify={notify}/>} 
      {view==="tax"&&<TaxReturn ledger={ledger} confirm={confirm} notify={notify}/>} 
      {view==="waste"&&<Waste notify={notify} confirm={confirm} setLedger={setLedger}/>} 
      {view==="guests"&&<Guests confirm={confirm} notify={notify}/>} 
      {view==="insights"&&<Insights/>}
      {view==="settings"&&<Settings confirm={confirm} notify={notify} settings={systemSettings} setSettings={setSystemSettings} saveSettings={saveSystemSettings} saving={settingsSaving} savingLabel={settingsSavingLabel}/>}
    </main>
  </div>
}

function pageDescription(view:View){
  const map:Record<View,string>={live:"",compose:"اختيار الوصفة ثم تعديل الحجم والحليب والشوتات، مع توجيه المشروب إلى المحطة الصحيحة تلقائياً.",floor:"ربط الضيوف بطلباتهم مع متابعة زمن الجلسة ومستوى الخدمة.",recipes:"معايير التحضير، المقادير، وقت الاستخلاص والتكلفة الحقيقية لكل كوب.",prep:"قائمة تجهيز مرتبطة بالوردية، مع الكمية المطلوبة والمتبقية وتوقيت الصلاحية.",batches:"متابعة مواد المقهى ومنتجات المستودع والدُفعات والكميات المتبقية وحالة المخزون.",finance:"حساب الإيرادات والمصاريف وصافي الربح وضريبة القيمة المضافة من سجل مالي مترابط.",tax:"إقرار ضريبة القيمة المضافة محسوب مباشرة من الإيرادات والمصاريف المسجلة.",waste:"تسجيل الفاقد الناتج عن الضبط أو التحضير أو انتهاء الصلاحية، مع توضيح السبب.",guests:"تفضيلات الضيوف، الحساسية، المشروب المعتاد، النقاط والزيارات.",insights:"الأداء من منظور المقهى: زمن التحضير، جودة الاستخلاص، الضغط والهدر.",settings:"إعدادات المقهى والتشغيل والمستخدمين والطباعة والتنبيهات."};return map[view];
}

function LiveFlow({tickets,advance,onOpenPrep,confirm}:{tickets:Ticket[];advance:(id:string)=>void;onOpenPrep:()=>void;confirm:ConfirmAction}){
  return <div className="live-workspace">
    <section className="flow-area">
      <div className="flow-head"><div><Badge tone="live"><i/> حي الآن</Badge><h2>مسار الأكواب</h2></div><div className="flow-summary"><span><b>{tickets.length}</b> في المسار</span><span><b>04:18</b> متوسط التحضير</span><span><b>2</b> بانتظار التسليم</span></div></div>
      <div className="brew-flow">{stages.map((stage,index)=><div className={`flow-lane lane-${index}`} key={stage}><div className="lane-head"><span>0{index+1}</span><b>{stage}</b><em>{tickets.filter(t=>t.stage===stage).length}</em></div><div className="lane-orders">{tickets.filter(t=>t.stage===stage).map(t=><article className="cup-ticket" key={t.id}><div className="ticket-top"><strong>{t.id}</strong><Badge tone={t.channel==="صالة"?"table":t.channel==="توصيل"?"delivery":"neutral"}>{t.channel}</Badge></div><h3>{t.drink}</h3><p>{t.details}</p><div className="ticket-foot"><span>{t.customer}</span><small><Icon name="timer" size={13}/>{t.age}</small></div>{index<stages.length-1&&<button onClick={()=>confirm({title:index===0?"إرسال للمحطة":index===3?"جاهز للتسليم":"إنهاء المرحلة",message:`هل تريد تحديث الطلب ${t.id} ونقله إلى المرحلة التالية؟`,confirmLabel:"تأكيد المرحلة",onConfirm:()=>advance(t.id)})}>{index===0?"إرسال للمحطة":index===3?"جاهز للتسليم":"إنهاء المرحلة"}<Icon name="arrow" size={14}/></button>}</article>)}</div></div>)}</div>
    </section>
    <aside className="live-side">
      <section className="station-console"><div className="section-title"><span>المحطات</span><h2>نبض التحضير</h2></div>{[
        {name:"ماكينة الإسبريسو",status:"تعمل",note:"92°C · ضغط 9",icon:"thermo"},
        {name:"مطحنة الإسبريسو",status:"تحتاج ضبط",note:"آخر ضبط 3:35 م",icon:"sliders"},
        {name:"ركن الترشيح",status:"متاح",note:"طلب واحد",icon:"timer"},
        {name:"المحطة الباردة",status:"تعمل",note:"3 طلبات",icon:"drop"}
      ].map((x,i)=><div className={`station-row station-${i}`} key={x.name}><span><Icon name={x.icon}/></span><p><strong>{x.name}</strong><small>{x.note}</small></p><b>{x.status}</b></div>)}</section>
      <section className="readiness"><div className="section-title"><span>جاهزية الوردية</span><h2>قبل موجة المساء</h2></div>{[
        {n:"بن الإسبريسو",v:"1.8 كجم",p:78},{n:"حليب الشوفان",v:"8 علب",p:42},{n:"كولد برو",v:"4.2 لتر",p:64},{n:"ثلج المحطة",v:"ممتلئ",p:92}
      ].map(x=><div className="readiness-row" key={x.n}><p><span>{x.n}</span><b>{x.v}</b></p><i><em style={{width:`${x.p}%`}}/></i></div>)}<button onClick={onOpenPrep}>فتح قائمة التحضير <Icon name="arrow" size={14}/></button></section>
      <section className="quality-note"><span><Icon name="spark"/></span><div><small>ملاحظة الجودة</small><strong>الاستخلاص أسرع بـ 3 ثوانٍ</strong><p>يُرجى فحص درجة الطحن قبل الطلب التالي.</p></div></section>
    </aside>
  </div>
}

function Composer(props:any){
  const {recipe,setRecipe,temperature,setTemperature,size,setSize,milk,setMilk,shots,setShots,syrup,setSyrup,channel,setChannel,launch}=props;
  const options=(items:string[],value:string,setter:(x:string)=>void)=><div className="choice-row">{items.map(x=><button className={x===value?"active":""} key={x} onClick={()=>setter(x)}>{x}</button>)}</div>;
  return <div className="composer-grid">
    <section className="recipe-shelf"><div className="search"><Icon name="search"/><input placeholder="البحث باسم المشروب أو الكود"/></div><span className="shelf-title">وصفات المقهى</span>{recipeOptions.map((r:any)=><button className={recipe.name===r.name?"active":""} key={r.name} onClick={()=>setRecipe(r)}><i>{r.code}</i><p><strong>{r.name}</strong><small>{r.base} · {r.time}</small></p><b>{r.price} د.إ</b></button>)}</section>
    <section className="build-sheet"><header><div><span>بطاقة بناء المشروب</span><h2>{recipe.name}</h2><p>ستُطبع هذه التعليمات مباشرة في محطة التحضير.</p></div><Badge tone="recipe">{recipe.code}</Badge></header>
      <div className="build-section"><label><b>01</b> الحرارة</label>{options(["ساخن","بارد"],temperature,setTemperature)}</div>
      <div className="build-section"><label><b>02</b> الحجم</label>{options(["صغير","وسط","كبير"],size,setSize)}</div>
      <div className="build-section"><label><b>03</b> نوع الحليب</label>{options(["كامل الدسم","قليل الدسم","شوفان","لوز"],milk,setMilk)}</div>
      <div className="build-section inline-build"><label><b>04</b> شوتات الإسبريسو</label><div className="counter"><button onClick={()=>setShots(Math.max(1,shots-1))}>−</button><strong>{shots}</strong><button onClick={()=>setShots(Math.min(4,shots+1))}>+</button></div></div>
      <div className="build-section"><label><b>05</b> النكهة</label>{options(["بدون","فانيلا","كراميل","بندق"],syrup,setSyrup)}</div>
      <div className="prep-note"><Icon name="recipe"/><input placeholder="ملاحظة للتحضير: حرارة الحليب، الرسم، الحساسية..."/></div>
    </section>
    <aside className="route-card"><span className="route-kicker">مسار التنفيذ</span><h2>ملخص الكوب</h2><div className="spec-card"><i>{recipe.code}</i><strong>{recipe.name}</strong><span>{temperature} · {size}</span><span>{milk} · {shots} شوت</span><span>{syrup==="بدون"?"بدون نكهة":`نكهة ${syrup}`}</span></div><label>قناة الطلب</label><div className="channel-choice">{["صالة","سفري","توصيل"].map(c=><button className={channel===c?"active":""} onClick={()=>setChannel(c)} key={c}>{c}</button>)}</div><div className="route-path"><span><i>1</i> طباعة بطاقة الكوب</span><span><i>2</i> توجيه لمحطة الإسبريسو</span><span><i>3</i> خصم الوصفة من الدُفعات</span></div><div className="route-total"><span>سعر المشروب</span><strong>{recipe.price+(size==="كبير"?3:0)+(milk==="شوفان"||milk==="لوز"?3:0)} د.إ</strong></div><button className="launch" onClick={launch}><Icon name="pulse"/><span>إطلاق إلى مسار التحضير</span></button></aside>
  </div>
}

function Floor({confirm,notify}:{confirm:ConfirmAction;notify:(x:string)=>void}){
  const [tables,setTables]=useState(floorTables);
  const [selected,setSelected]=useState("03");
  const [tableEditor,setTableEditor]=useState<{mode:"add"|"edit";id?:string}|null>(null);
  const [tableDraft,setTableDraft]=useState({seats:4,status:"متاحة",guest:""});
  const [sessionEditor,setSessionEditor]=useState<"open"|"transfer"|null>(null);
  const [sessionDraft,setSessionDraft]=useState({guestName:"",guests:2,target:"01",note:""});
  const current=tables.find(table=>table.id===selected)??tables[0];

  function openAddTable(){setTableDraft({seats:4,status:"متاحة",guest:""});setTableEditor({mode:"add"})}
  function openEditTable(){if(!current){notify("لا توجد طاولة محددة");return}setTableDraft({seats:current.seats,status:current.status,guest:current.guest});setTableEditor({mode:"edit",id:current.id})}
  function applyTableSave(){
    if(tableEditor?.mode==="edit"&&tableEditor.id){setTables(items=>items.map(item=>item.id===tableEditor.id?{...item,...tableDraft}:item));notify("تم تعديل بيانات الطاولة")}
    else{const next=Math.max(0,...tables.map(item=>Number(item.id)))+1;const id=String(next).padStart(2,"0");setTables(items=>[...items,{id,...tableDraft}]);setSelected(id);notify(`تم إضافة الطاولة ${id}`)}
    setTableEditor(null);
  }
  function saveTable(e:React.FormEvent){e.preventDefault();confirm({title:tableEditor?.mode==="edit"?"تعديل الطاولة":"إضافة طاولة",message:tableEditor?.mode==="edit"?`هل تريد حفظ التعديل على الطاولة ${tableEditor.id}؟`:`هل تريد إضافة طاولة جديدة بعد الطاولة ${tables.at(-1)?.id??"12"}؟`,confirmLabel:"حفظ الطاولة",onConfirm:applyTableSave})}
  function removeTable(){
    if(!current){notify("لا توجد طاولة محددة");return}
    confirm({title:"حذف الطاولة",message:`هل تريد حذف الطاولة ${current.id} من خريطة الصالة؟`,confirmLabel:"تأكيد الحذف",onConfirm:()=>{const remaining=tables.filter(item=>item.id!==current.id);setTables(remaining);setSelected(remaining[0]?.id??"");notify(`تم حذف الطاولة ${current.id}`)}})
  }
  function saveSession(e:React.FormEvent){e.preventDefault();if(sessionEditor==="transfer"&&sessionDraft.target===selected){notify("الطاولة الجديدة يجب أن تكون مختلفة");return}confirm({title:sessionEditor==="open"?"فتح جلسة الضيف":"نقل الجلسة",message:sessionEditor==="open"?`هل تريد فتح جلسة على الطاولة ${selected} لعدد ${sessionDraft.guests} ضيوف؟`:`هل تريد نقل الجلسة من الطاولة ${selected} إلى الطاولة ${sessionDraft.target}؟`,confirmLabel:"تأكيد العملية",onConfirm:()=>{if(sessionEditor==="open")setTables(items=>items.map(item=>item.id===selected?{...item,status:"مشغولة",guest:"0 د"}:item));else{setTables(items=>items.map(item=>item.id===selected?{...item,status:"متاحة",guest:""}:item.id===sessionDraft.target?{...item,status:"مشغولة",guest:"0 د"}:item));setSelected(sessionDraft.target)}setSessionEditor(null);notify(sessionEditor==="open"?"تم فتح جلسة الضيف":"تم نقل الجلسة إلى الطاولة الجديدة")}})}

  return <>
    {sessionEditor&&<div className="modal-layer table-editor-layer"><form className="command-modal table-command" onSubmit={saveSession}><header><span><Icon name="floor"/></span><div><small>الصالة والطاولات</small><h2>{sessionEditor==="open"?`فتح جلسة الطاولة ${selected}`:`نقل جلسة الطاولة ${selected}`}</h2><p>بيانات الضيف والطاولة المطلوبة وملاحظات الخدمة.</p></div></header><div className="command-grid"><label>اسم الضيف<input value={sessionDraft.guestName} onChange={e=>setSessionDraft(v=>({...v,guestName:e.target.value}))}/></label>{sessionEditor==="open"?<label>عدد الضيوف<input type="number" min="1" value={sessionDraft.guests} onChange={e=>setSessionDraft(v=>({...v,guests:Number(e.target.value)}))}/></label>:<label>الطاولة الجديدة<select value={sessionDraft.target} onChange={e=>setSessionDraft(v=>({...v,target:e.target.value}))}>{tables.filter(item=>item.id!==selected).map(item=><option key={item.id} value={item.id}>طاولة {item.id} · {item.status}</option>)}</select></label>}<label className="wide">ملاحظة الجلسة<input value={sessionDraft.note} onChange={e=>setSessionDraft(v=>({...v,note:e.target.value}))}/></label></div><footer><button type="button" className="secondary" onClick={()=>setSessionEditor(null)}>إلغاء</button><button type="submit">تأكيد العملية</button></footer></form></div>}
    {tableEditor&&<div className="modal-layer table-editor-layer" role="dialog" aria-modal="true" aria-label={tableEditor.mode==="edit"?"تعديل الطاولة":"إضافة طاولة"}><form className="command-modal table-command" onSubmit={saveTable}><header><span><Icon name="floor"/></span><div><small>إدارة الصالة</small><h2>{tableEditor.mode==="edit"?`تعديل الطاولة ${tableEditor.id}`:"إضافة طاولة جديدة"}</h2><p>تحديد عدد المقاعد وحالة الطاولة قبل الحفظ.</p></div></header><div className="command-grid"><label>عدد المقاعد<input type="number" min="1" max="20" value={tableDraft.seats} onChange={e=>setTableDraft(value=>({...value,seats:Number(e.target.value)}))}/></label><label>حالة الطاولة<select value={tableDraft.status} onChange={e=>setTableDraft(value=>({...value,status:e.target.value}))}><option>متاحة</option><option>مشغولة</option><option>محجوزة</option><option>تنظيف</option></select></label><label>تفاصيل الوقت<input value={tableDraft.guest} onChange={e=>setTableDraft(value=>({...value,guest:e.target.value}))} placeholder="مثال: 5:30 م أو 18 د"/></label></div><footer><button type="button" className="secondary" onClick={()=>confirm({title:"إلغاء بيانات الطاولة",message:"هل تريد إلغاء البيانات الحالية دون حفظ؟",confirmLabel:"تأكيد الإلغاء",onConfirm:()=>setTableEditor(null)})}>إلغاء</button><button type="submit">حفظ الطاولة</button></footer></form></div>}
    <div className="floor-layout"><section className="floor-plan"><div className="floor-zone zone-window"><span>الواجهة الزجاجية</span></div><div className="floor-zone zone-coffee"><span>محطة القهوة</span></div><div className="tables-canvas">{tables.map(t=><button key={t.id} className={`${selected===t.id?"selected":""} status-${t.status}`} onClick={()=>confirm({title:"تغيير الطاولة",message:`هل تريد الانتقال من الطاولة ${selected} إلى الطاولة ${t.id}؟`,confirmLabel:"تأكيد الطاولة",onConfirm:()=>setSelected(t.id)})}><small>طاولة</small><strong>{t.id}</strong><span>{t.seats} مقاعد</span><em>{t.status}{t.guest?` · ${t.guest}`:""}</em></button>)}</div></section><aside className="guest-session"><Badge tone="table">جلسة نشطة</Badge><h2>طاولة {selected||"—"}</h2><p>{current?.status==="مشغولة"?`3 ضيوف · بدأت منذ ${current.guest||"18 د"}`:"بيانات الطاولة قابلة للتعديل"}</p><div className="session-timeline"><span className="done"><i/>استقبال الضيف <b>04:02</b></span><span className="done"><i/>تسجيل الطلب <b>04:06</b></span><span className="active"><i/>التحضير في محطة القهوة <b>الآن</b></span><span><i/>التسليم للطاولة</span></div><div className="session-order"><span>الطلب المرتبط</span><strong>C-215</strong><p>V60 إثيوبيا · كابتشينو</p></div><button onClick={()=>setSessionEditor("open")}>فتح جلسة الضيف</button><button className="secondary" onClick={()=>setSessionEditor("transfer")}>نقل الجلسة</button><div className="table-admin"><button onClick={openAddTable}><Icon name="plus" size={14}/>إضافة طاولة</button><button onClick={openEditTable}>تعديل الطاولة</button><button className="delete" onClick={removeTable}>حذف الطاولة</button></div></aside></div>
  </>
}

function RecipeLab({confirm,notify}:{confirm:ConfirmAction;notify:(x:string)=>void}){
  const [recipes,setRecipes]=useState(recipeOptions.map(item=>({...item,cost:item.price*.32})));
  const [selected,setSelected]=useState(0);
  const [editOpen,setEditOpen]=useState(false);
  const [draft,setDraft]=useState(recipes[0]);
  const active=recipes[selected]??recipes[0];
  function openEditor(){setDraft(active);setEditOpen(true)}
  function saveRecipe(e:React.FormEvent){e.preventDefault();confirm({title:"تعديل الوصفة",message:`هل تريد حفظ وصفة ${draft.name} وسعرها ${draft.price} د.إ؟`,confirmLabel:"حفظ الوصفة",onConfirm:()=>{setRecipes(items=>items.map((item,index)=>index===selected?draft:item));setEditOpen(false);notify("تم تعديل الوصفة وربط السعر والتكلفة")}})}
  return <>
    {editOpen&&<div className="modal-layer recipe-editor-layer"><form className="command-modal recipe-command" onSubmit={saveRecipe}><header><span><Icon name="recipe"/></span><div><small>مختبر الوصفات</small><h2>تعديل الوصفة</h2><p>اسم المشروب والمكونات والسعر والتكلفة وزمن التحضير.</p></div></header><div className="command-grid"><label>اسم المشروب<input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))}/></label><label>الكود<input value={draft.code} onChange={e=>setDraft(v=>({...v,code:e.target.value}))}/></label><label>المكونات الأساسية<input value={draft.base} onChange={e=>setDraft(v=>({...v,base:e.target.value}))}/></label><label>زمن التحضير<input value={draft.time} onChange={e=>setDraft(v=>({...v,time:e.target.value}))}/></label><label>سعر البيع<input type="number" value={draft.price} onChange={e=>setDraft(v=>({...v,price:Number(e.target.value)}))}/></label><label>تكلفة الكوب<input type="number" step="0.01" value={draft.cost} onChange={e=>setDraft(v=>({...v,cost:Number(e.target.value)}))}/></label><div className="form-total"><span>هامش الربح</span><strong>{draft.price?((draft.price-draft.cost)/draft.price*100).toFixed(1):0}%</strong><small>ربح الكوب {(draft.price-draft.cost).toFixed(2)} د.إ</small></div></div><footer><button type="button" className="secondary" onClick={()=>setEditOpen(false)}>إلغاء</button><button type="submit">حفظ الوصفة</button></footer></form></div>}
    <div className="recipe-lab"><div className="lab-index"><div className="lab-search"><Icon name="search"/><input placeholder="بحث في الوصفات"/></div>{recipes.map((r,i)=><button className={i===selected?"active":""} onClick={()=>setSelected(i)} key={r.code}><span>{r.code}</span><p><strong>{r.name}</strong><small>الإصدار {i+2}.1 · نشطة</small></p><b>{r.price} د.إ</b></button>)}</div><section className="recipe-document"><header><div><Badge tone="recipe">وصفة معتمدة</Badge><h2>{active.name}</h2><p>{active.base} · {active.code}</p></div><button onClick={openEditor}>تعديل الوصفة</button></header><div className="recipe-metrics"><div><span>تكلفة الكوب</span><strong>{active.cost.toFixed(2)} د.إ</strong></div><div><span>سعر البيع</span><strong>{active.price.toFixed(2)} د.إ</strong></div><div><span>هامش الربح</span><strong>{((active.price-active.cost)/active.price*100).toFixed(1)}%</strong></div><div><span>زمن المعيار</span><strong>{active.time}</strong></div></div><div className="formula"><h3>تركيبة الحجم الوسط</h3>{[{n:"بن إسبريسو",q:"18 g",c:"2.65"},{n:"حليب",q:"180 ml",c:"2.10"},{n:"حليب مكثف",q:"25 ml",c:"1.45"},{n:"ثلج",q:"160 g",c:"0.22"},{n:"كوب وغطاء",q:"1 pc",c:"2.00"}].map((x,i)=><div key={x.n}><span>{String(i+1).padStart(2,"0")}</span><strong>{x.n}</strong><b>{x.q}</b><em>{x.c} د.إ</em></div>)}</div><div className="method"><h3>معيار التحضير</h3><ol><li><b>الاستخلاص</b><span>18g in · 36g out · 27–30 sec</span></li><li><b>الخلط</b><span>الحليب المكثف مع الإسبريسو قبل الثلج</span></li><li><b>البناء</b><span>ثلج، خليط الإسبريسو، ثم الحليب البارد</span></li><li><b>التسليم</b><span>غطاء محكم وملصق الحساسية</span></li></ol></div></section></div>
  </>
}

function PrepShift({notify,confirm}:{notify:(x:string)=>void;confirm:ConfirmAction}){
  const [done,setDone]=useState<number[]>([1,4]);
  const [tasks,setTasks]=useState([
    {id:1,n:"تحضير كولد برو",q:"8 لتر",time:"ينتهي 10:00 م"},
    {id:2,n:"تعبئة صوص الفانيلا",q:"6 عبوات",time:"قبل 4:30 م"},
    {id:3,n:"تقطيع كيك التمر",q:"24 قطعة",time:"قبل الذروة"},
    {id:4,n:"معايرة مطحنة 1",q:"18g / 28 sec",time:"تم 3:40 م"},
    {id:5,n:"تجهيز حليب الشوفان",q:"12 عبوة",time:"قبل 5:00 م"},
    {id:6,n:"فحص فلاتر V60",q:"80 فلتر",time:"متوفر"},
  ]);
  const [selectedTask,setSelectedTask]=useState(1);
  const [editor,setEditor]=useState<{mode:"add"|"edit";id?:number}|null>(null);
  const [draft,setDraft]=useState({n:"",q:"",time:""});
  const completed=tasks.filter(task=>done.includes(task.id)).length;

  function openAdd(){setDraft({n:"",q:"",time:""});setEditor({mode:"add"})}
  function openEdit(task:{id:number;n:string;q:string;time:string}){setDraft({n:task.n,q:task.q,time:task.time});setEditor({mode:"edit",id:task.id})}
  function applyTaskSave(){
    if(editor?.mode==="edit"&&editor.id){
      setTasks(items=>items.map(item=>item.id===editor.id?{...item,...draft}:item));
      notify("تم تعديل مهمة الوردية");
    }else{
      const id=Math.max(0,...tasks.map(item=>item.id))+1;
      setTasks(items=>[...items,{id,n:draft.n.trim(),q:draft.q.trim()||"غير محدد",time:draft.time.trim()||"دون موعد"}]);
      notify("تم إضافة مهمة جديدة");
    }
    setEditor(null);
  }
  function saveTask(e:React.FormEvent){
    e.preventDefault();
    if(!draft.n.trim()){notify("اسم المهمة مطلوب");return}
    confirm({title:editor?.mode==="edit"?"تعديل مهمة الوردية":"إضافة مهمة الوردية",message:editor?.mode==="edit"?`هل تريد حفظ التعديل على مهمة ${draft.n}؟`:`هل تريد إضافة مهمة ${draft.n} إلى الوردية؟`,confirmLabel:"حفظ المهمة",onConfirm:applyTaskSave});
  }
  function removeTask(id:number){setTasks(items=>{const remaining=items.filter(item=>item.id!==id);setSelectedTask(remaining[0]?.id??0);return remaining});setDone(items=>items.filter(item=>item!==id));notify("تم حذف مهمة الوردية")}
  function requestEdit(){const task=tasks.find(item=>item.id===selectedTask);if(!task){notify("لا توجد مهمة محددة");return}confirm({title:"تعديل مهمة الوردية",message:`هل تريد فتح تعديل مهمة ${task.n}؟`,confirmLabel:"فتح التعديل",onConfirm:()=>openEdit(task)})}
  function requestDelete(){const task=tasks.find(item=>item.id===selectedTask);if(!task){notify("لا توجد مهمة محددة");return}confirm({title:"حذف مهمة الوردية",message:`هل تريد حذف مهمة ${task.n} نهائياً؟`,confirmLabel:"تأكيد الحذف",onConfirm:()=>removeTask(task.id)})}

  return <div className="prep-board">
    <section className="prep-hero"><Badge tone="live">وردية المساء</Badge><h2>قائمة الجاهزية</h2><p>إكمال التجهيز قبل موجة الطلبات المتوقعة الساعة 5:30.</p><div><strong>{completed}/{tasks.length}</strong><span>تم الإنجاز</span><i><em style={{width:`${tasks.length?completed/tasks.length*100:0}%`}}/></i></div></section>
    <section className="prep-list">
      <header className="prep-list-head"><div><span>إدارة المهام</span><strong>{tasks.length} مهام · المهمة المحددة {selectedTask||"—"}</strong></div><div className="prep-head-actions"><button onClick={openAdd}><Icon name="plus" size={15}/>إضافة مهمة</button><button onClick={requestEdit}>تعديل</button><button className="delete" onClick={requestDelete}>حذف</button></div></header>
      {editor&&<form className="prep-editor" onSubmit={saveTask}><input value={draft.n} onChange={e=>setDraft(v=>({...v,n:e.target.value}))} placeholder="اسم المهمة"/><input value={draft.q} onChange={e=>setDraft(v=>({...v,q:e.target.value}))} placeholder="الكمية"/><input value={draft.time} onChange={e=>setDraft(v=>({...v,time:e.target.value}))} placeholder="الموعد"/><div><button type="submit">حفظ</button><button type="button" onClick={()=>confirm({title:"إلغاء التعديل",message:"هل تريد إلغاء البيانات الحالية دون حفظ؟",confirmLabel:"تأكيد الإلغاء",onConfirm:()=>setEditor(null)})}>إلغاء</button></div></form>}
      {tasks.map(task=><article className={`prep-task ${selectedTask===task.id?"selected":""}`} key={task.id} onClick={()=>setSelectedTask(task.id)}><button className={`task-toggle ${done.includes(task.id)?"done":""}`} onClick={()=>confirm({title:done.includes(task.id)?"إعادة المهمة":"اعتماد المهمة",message:done.includes(task.id)?`هل تريد إعادة مهمة ${task.n} إلى قائمة التنفيذ؟`:`هل تريد اعتماد إنجاز مهمة ${task.n}؟`,confirmLabel:"تأكيد الحالة",onConfirm:()=>{setDone(v=>v.includes(task.id)?v.filter(x=>x!==task.id):[...v,task.id]);notify(done.includes(task.id)?"أعيدت المهمة إلى القائمة":"تم اعتماد مهمة التحضير")}})}><span><Icon name="check"/></span><p><strong>{task.n}</strong><small>{task.time}</small></p><b>{task.q}</b></button></article>)}
    </section>
    <aside className="prep-forecast"><span>توقعات الذروة</span><h2>05:30 — 07:15</h2><div className="wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><p>الطلب المتوقع الأعلى</p><strong>سبانيش لاتيه بارد</strong><small>الحاجة إلى تجهيز 4 لترات حليب إضافية.</small></aside>
  </div>
}

function Batches({materials,setMaterials,ledger,setLedger,confirm,notify}:{materials:Material[];setMaterials:React.Dispatch<React.SetStateAction<Material[]>>;ledger:LedgerEntry[];setLedger:React.Dispatch<React.SetStateAction<LedgerEntry[]>>;confirm:ConfirmAction;notify:(x:string)=>void}){
  const [selected,setSelected]=useState(materials[0]?.id??"");
  const [editor,setEditor]=useState<"add"|"edit"|null>(null);
  const [doseOpen,setDoseOpen]=useState(false);
  const [draft,setDraft]=useState({name:"",category:"بن القهوة",quantity:1,unit:"كجم",cost:0,salePrice:0,vatRate:5,supplier:"",batch:"",location:"المستودع"});
  const [dose,setDose]=useState({input:18,output:36,time:28,grind:"متوسط ناعم",note:""});
  const active=materials.find(item=>item.id===selected)??materials[0];
  function openAdd(){setDraft({name:"",category:"بن القهوة",quantity:1,unit:"كجم",cost:0,salePrice:0,vatRate:5,supplier:"",batch:"",location:"المستودع"});setEditor("add")}
  function openEdit(){if(!active){notify("لا توجد مادة محددة");return}setDraft({name:active.name,category:active.category,quantity:active.quantity,unit:active.unit,cost:active.cost,salePrice:active.salePrice,vatRate:active.vatRate,supplier:active.supplier,batch:active.batch,location:active.location});setEditor("edit")}
  function applyMaterial(){
    if(editor==="edit"&&active){setMaterials(items=>items.map(item=>item.id===active.id?{...item,...draft}:item));notify("تم تعديل المادة والمخزون")}
    else{const id=`MAT-${String(materials.length+1).padStart(3,"0")}`;const material:Material={id,...draft};setMaterials(items=>[...items,material]);setSelected(id);const amount=draft.quantity*draft.cost;setLedger(items=>[{id:`EXP-MAT-${Date.now()}`,type:"expense",title:`شراء ${draft.name}`,category:"مشتريات مخزون",amount,vat:amount*draft.vatRate/100,date:"24-08-2026",source:"المواد والمخزن",method:"مورد"},...items]);notify("تم إضافة المادة وربط التكلفة بالحسابات والضريبة")}
    setEditor(null);
  }
  function saveMaterial(e:React.FormEvent){e.preventDefault();if(!draft.name.trim()||draft.quantity<=0){notify("اسم المادة والكمية مطلوبان");return}confirm({title:editor==="edit"?"تعديل المادة":"إضافة المادة",message:editor==="edit"?`هل تريد حفظ التعديل على ${draft.name}؟`:`هل تريد إضافة ${draft.name} وربط تكلفتها بالمصاريف والضريبة؟`,confirmLabel:"حفظ المادة",onConfirm:applyMaterial})}
  function removeMaterial(){if(!active)return;confirm({title:"حذف المادة",message:`هل تريد حذف ${active.name} من المخزن؟ سيبقى القيد المالي السابق محفوظاً.`,confirmLabel:"تأكيد الحذف",onConfirm:()=>{const remaining=materials.filter(item=>item.id!==active.id);setMaterials(remaining);setSelected(remaining[0]?.id??"");notify("تم حذف المادة من المخزن")}})}
  function saveDose(e:React.FormEvent){e.preventDefault();confirm({title:"تسجيل الجرعة التجريبية",message:`هل تريد حفظ نتيجة ${dose.input}g → ${dose.output}g خلال ${dose.time} ثانية؟`,confirmLabel:"حفظ الجرعة",onConfirm:()=>{setDoseOpen(false);notify("تم حفظ الجرعة التجريبية ضمن سجل المادة")}})}
  const stockValue=materials.reduce((sum,item)=>sum+item.quantity*item.cost,0);
  const linkedExpenses=ledger.filter(item=>item.source==="المواد والمخزن").reduce((sum,item)=>sum+item.amount,0);
  return <>
    {editor&&<div className="modal-layer inventory-editor-layer"><form className="command-modal inventory-command" onSubmit={saveMaterial}><header><span><Icon name="beans"/></span><div><small>المواد والمخزن</small><h2>{editor==="edit"?`تعديل ${active?.name}`:"إضافة مادة أو منتج"}</h2><p>بيانات الكمية والتكلفة والسعر والضريبة والدُفعة والموقع.</p></div></header><div className="command-grid inventory-form"><label>اسم المادة<input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))}/></label><label>التصنيف<select value={draft.category} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}><option>بن القهوة</option><option>ألبان وبدائل</option><option>نكهات</option><option>تغليف</option><option>حلويات ومخبوزات</option><option>مواد تنظيف</option></select></label><label>الكمية<input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={e=>setDraft(v=>({...v,quantity:Number(e.target.value)}))}/></label><label>الوحدة<select value={draft.unit} onChange={e=>setDraft(v=>({...v,unit:e.target.value}))}><option>كجم</option><option>جرام</option><option>لتر</option><option>علبة</option><option>عبوة</option><option>قطعة</option></select></label><label>تكلفة الوحدة<input type="number" min="0" step="0.01" value={draft.cost} onChange={e=>setDraft(v=>({...v,cost:Number(e.target.value)}))}/></label><label>سعر البيع<input type="number" min="0" step="0.01" value={draft.salePrice} onChange={e=>setDraft(v=>({...v,salePrice:Number(e.target.value)}))}/></label><label>نسبة الضريبة<select value={draft.vatRate} onChange={e=>setDraft(v=>({...v,vatRate:Number(e.target.value)}))}><option value="5">5%</option><option value="0">0%</option></select></label><label>المورد<input value={draft.supplier} onChange={e=>setDraft(v=>({...v,supplier:e.target.value}))}/></label><label>رقم الدُفعة<input value={draft.batch} onChange={e=>setDraft(v=>({...v,batch:e.target.value}))}/></label><label>موقع التخزين<input value={draft.location} onChange={e=>setDraft(v=>({...v,location:e.target.value}))}/></label><div className="form-total"><span>إجمالي التكلفة قبل الضريبة</span><strong>{(draft.quantity*draft.cost).toFixed(2)} د.إ</strong><small>الضريبة {(draft.quantity*draft.cost*draft.vatRate/100).toFixed(2)} د.إ</small></div></div><footer><button type="button" className="secondary" onClick={()=>confirm({title:"إلغاء بيانات المادة",message:"هل تريد إلغاء البيانات الحالية دون حفظ؟",confirmLabel:"تأكيد الإلغاء",onConfirm:()=>setEditor(null)})}>إلغاء</button><button type="submit">حفظ وربط الحسابات</button></footer></form></div>}
    {doseOpen&&<div className="modal-layer inventory-editor-layer"><form className="command-modal dose-command" onSubmit={saveDose}><header><span><Icon name="timer"/></span><div><small>اختبار الدُفعة</small><h2>جرعة إسبريسو تجريبية</h2><p>نتيجة الاستخلاص ومعيار الطحن للمادة النشطة.</p></div></header><div className="command-grid"><label>الجرعة الداخلة<input type="number" value={dose.input} onChange={e=>setDose(v=>({...v,input:Number(e.target.value)}))}/></label><label>الناتج بالجرام<input type="number" value={dose.output} onChange={e=>setDose(v=>({...v,output:Number(e.target.value)}))}/></label><label>الزمن بالثواني<input type="number" value={dose.time} onChange={e=>setDose(v=>({...v,time:Number(e.target.value)}))}/></label><label>درجة الطحن<input value={dose.grind} onChange={e=>setDose(v=>({...v,grind:e.target.value}))}/></label><label className="wide">ملاحظة<input value={dose.note} onChange={e=>setDose(v=>({...v,note:e.target.value}))}/></label></div><footer><button type="button" className="secondary" onClick={()=>setDoseOpen(false)}>إلغاء</button><button type="submit">حفظ الجرعة</button></footer></form></div>}
    <div className="inventory-page"><section className="batch-spotlight"><span>المادة النشطة على مطحنة 1</span><h2>{active?.id??"لا توجد مادة"}</h2><p>{active?.name} · {active?.supplier||"دون مورد"} · مصاريف مرتبطة {linkedExpenses.toLocaleString()} د.إ</p><div><span><b>{active?.quantity??0}</b> {active?.unit}</span><span><b>{active?.cost.toFixed(2)??"0"}</b> تكلفة الوحدة</span><span><b>{stockValue.toFixed(0)}</b> قيمة المخزون</span></div><button onClick={()=>setDoseOpen(true)}>تسجيل جرعة تجريبية</button></section><section className="batch-ledger inventory-ledger"><header><div><span>سجل المواد والمخزون</span><h2>{materials.length} مواد ومنتجات</h2></div><div className="inventory-actions"><button onClick={openAdd}><Icon name="plus"/>إضافة مادة</button><button onClick={openEdit}>تعديل</button><button className="delete" onClick={removeMaterial}>حذف</button></div></header>{materials.map(item=><button className={`batch-row material-row ${selected===item.id?"selected":""}`} key={item.id} onClick={()=>setSelected(item.id)}><span className="bean-code">{item.id}</span><p><strong>{item.name}</strong><small>{item.category} · دُفعة {item.batch||"—"} · {item.supplier||"دون مورد"}</small></p><b>{item.quantity} {item.unit}</b><span>{item.location}</span><Badge tone={item.quantity<=5?"warning":"live"}>{item.quantity<=5?"منخفض":"متوفر"}</Badge></button>)}</section></div>
  </>
}

function Finance({ledger,setLedger,materials,confirm,notify}:{ledger:LedgerEntry[];setLedger:React.Dispatch<React.SetStateAction<LedgerEntry[]>>;materials:Material[];confirm:ConfirmAction;notify:(x:string)=>void}){
  const [selected,setSelected]=useState(ledger[0]?.id??"");
  const [editor,setEditor]=useState<"add"|"edit"|null>(null);
  const [draft,setDraft]=useState({type:"expense" as LedgerEntry["type"],title:"",category:"مصاريف تشغيل",amount:0,vatRate:5,date:"24-08-2026",source:"الحسابات",method:"تحويل"});
  const active=ledger.find(item=>item.id===selected);
  const revenue=ledger.filter(item=>item.type==="revenue").reduce((sum,item)=>sum+item.amount,0);
  const expenses=ledger.filter(item=>item.type==="expense").reduce((sum,item)=>sum+item.amount,0);
  const outputVat=ledger.filter(item=>item.type==="revenue").reduce((sum,item)=>sum+item.vat,0);
  const inputVat=ledger.filter(item=>item.type==="expense").reduce((sum,item)=>sum+item.vat,0);
  const profit=revenue-expenses;
  const stockValue=materials.reduce((sum,item)=>sum+item.quantity*item.cost,0);
  function openAdd(type:LedgerEntry["type"]){setDraft({type,title:"",category:type==="revenue"?"مبيعات":"مصاريف تشغيل",amount:0,vatRate:5,date:"24-08-2026",source:"الحسابات",method:"تحويل"});setEditor("add")}
  function openEdit(){if(!active){notify("لا يوجد قيد محدد");return}setDraft({type:active.type,title:active.title,category:active.category,amount:active.amount,vatRate:active.amount?Number((active.vat/active.amount*100).toFixed(0)):5,date:active.date,source:active.source,method:active.method});setEditor("edit")}
  function applyEntry(){const vat=draft.amount*draft.vatRate/100;if(editor==="edit"&&active){setLedger(items=>items.map(item=>item.id===active.id?{...item,...draft,vat}:item));notify("تم تعديل القيد وإعادة حساب التقارير والضريبة")}else{const id=`${draft.type==="revenue"?"REV":"EXP"}-${Date.now()}`;setLedger(items=>[{id,...draft,vat},...items]);setSelected(id);notify("تم إضافة القيد وربطه بالتقرير المالي والإقرار الضريبي")}setEditor(null)}
  function saveEntry(e:React.FormEvent){e.preventDefault();if(!draft.title.trim()||draft.amount<=0){notify("وصف القيد والمبلغ مطلوبان");return}confirm({title:editor==="edit"?"تعديل القيد المالي":"إضافة قيد مالي",message:`هل تريد حفظ ${draft.title} بقيمة ${draft.amount.toFixed(2)} د.إ؟`,confirmLabel:"حفظ القيد",onConfirm:applyEntry})}
  function removeEntry(){if(!active)return;confirm({title:"حذف القيد المالي",message:`هل تريد حذف ${active.title}؟ ستتغير الأرباح والضريبة مباشرة.`,confirmLabel:"تأكيد الحذف",onConfirm:()=>{const remaining=ledger.filter(item=>item.id!==active.id);setLedger(remaining);setSelected(remaining[0]?.id??"");notify("تم حذف القيد وإعادة حساب التقارير")}})}
  return <>
    {editor&&<div className="modal-layer finance-editor-layer"><form className="command-modal finance-command" onSubmit={saveEntry}><header><span><Icon name="wallet"/></span><div><small>الحسابات المالية</small><h2>{editor==="edit"?"تعديل القيد المالي":"إضافة إيراد أو مصروف"}</h2><p>المبلغ والضريبة ومصدر العملية وطريقة الدفع.</p></div></header><div className="command-grid"><label>نوع القيد<select value={draft.type} onChange={e=>setDraft(v=>({...v,type:e.target.value as LedgerEntry["type"]}))}><option value="revenue">إيراد</option><option value="expense">مصروف</option></select></label><label>الوصف<input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label><label>التصنيف<input value={draft.category} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}/></label><label>المبلغ قبل الضريبة<input type="number" min="0" step="0.01" value={draft.amount} onChange={e=>setDraft(v=>({...v,amount:Number(e.target.value)}))}/></label><label>نسبة الضريبة<select value={draft.vatRate} onChange={e=>setDraft(v=>({...v,vatRate:Number(e.target.value)}))}><option value="5">5%</option><option value="0">0%</option></select></label><label>التاريخ<input value={draft.date} onChange={e=>setDraft(v=>({...v,date:e.target.value}))}/></label><label>المصدر<input value={draft.source} onChange={e=>setDraft(v=>({...v,source:e.target.value}))}/></label><label>طريقة الدفع<select value={draft.method} onChange={e=>setDraft(v=>({...v,method:e.target.value}))}><option>نقدي</option><option>بطاقة</option><option>تحويل</option><option>إلكتروني</option></select></label><div className="form-total"><span>الضريبة المحسوبة</span><strong>{(draft.amount*draft.vatRate/100).toFixed(2)} د.إ</strong><small>الإجمالي شامل الضريبة {(draft.amount*(1+draft.vatRate/100)).toFixed(2)} د.إ</small></div></div><footer><button type="button" className="secondary" onClick={()=>confirm({title:"إلغاء القيد",message:"هل تريد إلغاء البيانات الحالية دون حفظ؟",confirmLabel:"تأكيد الإلغاء",onConfirm:()=>setEditor(null)})}>إلغاء</button><button type="submit">حفظ وربط التقارير</button></footer></form></div>}
    <div className="finance-page"><section className="finance-summary"><article><span>الإيرادات قبل الضريبة</span><strong>{revenue.toLocaleString()} د.إ</strong><small>{ledger.filter(item=>item.type==="revenue").length} قيود إيراد</small></article><article><span>المصاريف قبل الضريبة</span><strong>{expenses.toLocaleString()} د.إ</strong><small>{ledger.filter(item=>item.type==="expense").length} قيود مصروف</small></article><article className="profit"><span>صافي الربح</span><strong>{profit.toLocaleString()} د.إ</strong><small>{revenue?Math.round(profit/revenue*100):0}% هامش صافي</small></article><article><span>ضريبة مستحقة</span><strong>{(outputVat-inputVat).toLocaleString()} د.إ</strong><small>مخرجات {outputVat} · مدخلات {inputVat}</small></article><article><span>قيمة المخزون</span><strong>{stockValue.toLocaleString()} د.إ</strong><small>{materials.length} مواد ومنتجات</small></article></section><section className="finance-grid"><article className="profit-loss"><header><div><span>قائمة الدخل</span><h2>الإيرادات والأرباح والمصاريف</h2></div><Badge tone="live">مترابط لحظياً</Badge></header><div><p><span>إجمالي الإيرادات</span><b>{revenue.toLocaleString()} د.إ</b></p><p><span>إجمالي المصاريف</span><b>− {expenses.toLocaleString()} د.إ</b></p><p><span>صافي الربح قبل الضريبة</span><b>{profit.toLocaleString()} د.إ</b></p><p><span>ضريبة القيمة المضافة المستحقة</span><b>− {(outputVat-inputVat).toLocaleString()} د.إ</b></p><p className="total"><span>صافي النتيجة</span><strong>{(profit-(outputVat-inputVat)).toLocaleString()} د.إ</strong></p></div></article><article className="finance-breakdown"><header><span>التوزيع المالي</span><h2>حسب المصدر</h2></header>{["مبيعات","مشتريات مخزون","مصاريف تشغيل","خدمات"].map(category=>{const total=ledger.filter(item=>item.category===category).reduce((sum,item)=>sum+item.amount,0);return <div key={category}><span>{category}</span><i><em style={{width:`${Math.min(100,total/Math.max(revenue,expenses)*100)}%`}}/></i><b>{total.toLocaleString()} د.إ</b></div>})}</article></section><section className="finance-ledger"><header><div><span>دفتر القيود</span><h2>كل الحركات المالية</h2></div><div><button onClick={()=>openAdd("revenue")}><Icon name="plus"/>إضافة إيراد</button><button onClick={()=>openAdd("expense")}>إضافة مصروف</button><button onClick={openEdit}>تعديل</button><button className="delete" onClick={removeEntry}>حذف</button></div></header><div className="ledger-head"><span>المرجع</span><span>البيان</span><span>النوع</span><span>قبل الضريبة</span><span>الضريبة</span><span>التاريخ</span></div>{ledger.map(item=><button className={`ledger-row ${selected===item.id?"selected":""}`} key={item.id} onClick={()=>setSelected(item.id)}><span>{item.id.slice(0,12)}</span><p><strong>{item.title}</strong><small>{item.category} · {item.source}</small></p><Badge tone={item.type==="revenue"?"live":"warning"}>{item.type==="revenue"?"إيراد":"مصروف"}</Badge><b>{item.amount.toLocaleString()} د.إ</b><span>{item.vat.toLocaleString()} د.إ</span><span>{item.date}</span></button>)}</section></div>
  </>
}

function TaxReturn({ledger,confirm,notify}:{ledger:LedgerEntry[];confirm:ConfirmAction;notify:(x:string)=>void}){
  const [period,setPeriod]=useState("الربع الثالث 2026");
  const [declarationOpen,setDeclarationOpen]=useState(false);
  const [draft,setDraft]=useState({trn:"100000000000003",from:"01-07-2026",to:"30-09-2026",box1:"دبي",notes:""});
  const revenues=ledger.filter(item=>item.type==="revenue");
  const expenses=ledger.filter(item=>item.type==="expense");
  const taxableRevenue=revenues.reduce((sum,item)=>sum+item.amount,0);
  const taxableExpense=expenses.reduce((sum,item)=>sum+item.amount,0);
  const outputVat=revenues.reduce((sum,item)=>sum+item.vat,0);
  const inputVat=expenses.reduce((sum,item)=>sum+item.vat,0);
  const due=outputVat-inputVat;
  function submitDeclaration(e:React.FormEvent){e.preventDefault();confirm({title:"حفظ مسودة الإقرار الضريبي",message:`هل تريد حفظ إقرار ${period} بقيمة مستحقة ${due.toFixed(2)} د.إ؟`,confirmLabel:"حفظ المسودة",onConfirm:()=>{setDeclarationOpen(false);notify("تم حفظ مسودة الإقرار وربطها بالسجلات المالية")}})}
  return <>
    {declarationOpen&&<div className="modal-layer tax-editor-layer"><form className="command-modal tax-command" onSubmit={submitDeclaration}><header><span><Icon name="tax"/></span><div><small>ضريبة القيمة المضافة</small><h2>إعداد مسودة الإقرار</h2><p>البيانات القانونية وفترة الإقرار والقيم المحسوبة من الحسابات.</p></div></header><div className="command-grid"><label>الرقم الضريبي TRN<input value={draft.trn} onChange={e=>setDraft(v=>({...v,trn:e.target.value}))}/></label><label>من تاريخ<input value={draft.from} onChange={e=>setDraft(v=>({...v,from:e.target.value}))}/></label><label>إلى تاريخ<input value={draft.to} onChange={e=>setDraft(v=>({...v,to:e.target.value}))}/></label><label>الإمارة<select value={draft.box1} onChange={e=>setDraft(v=>({...v,box1:e.target.value}))}><option>دبي</option><option>أبوظبي</option><option>الشارقة</option><option>عجمان</option></select></label><label className="wide">ملاحظات<input value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))}/></label><div className="form-total"><span>صافي الضريبة المستحقة</span><strong>{due.toFixed(2)} د.إ</strong><small>مخرجات {outputVat.toFixed(2)} − مدخلات {inputVat.toFixed(2)}</small></div></div><footer><button type="button" className="secondary" onClick={()=>setDeclarationOpen(false)}>إلغاء</button><button type="submit">حفظ مسودة الإقرار</button></footer></form></div>}
    <div className="tax-page"><section className="tax-period"><div><span>فترة الإقرار</span><h2>{period}</h2><p>آخر موعد للتقديم: 28 أكتوبر 2026</p></div><select value={period} onChange={e=>setPeriod(e.target.value)}><option>الربع الثالث 2026</option><option>الربع الثاني 2026</option><option>النصف الثاني 2026</option><option>السنة 2026</option></select></section><section className="tax-summary"><article><span>المبيعات الخاضعة</span><strong>{taxableRevenue.toLocaleString()} د.إ</strong><small>{revenues.length} قيود مرتبطة</small></article><article><span>ضريبة المخرجات</span><strong>{outputVat.toLocaleString()} د.إ</strong><small>على الإيرادات</small></article><article><span>المشتريات الخاضعة</span><strong>{taxableExpense.toLocaleString()} د.إ</strong><small>{expenses.length} قيود مرتبطة</small></article><article><span>ضريبة المدخلات</span><strong>{inputVat.toLocaleString()} د.إ</strong><small>قابلة للاسترداد</small></article><article className="due"><span>صافي الضريبة</span><strong>{due.toLocaleString()} د.إ</strong><small>{due>=0?"مبلغ مستحق":"رصيد دائن"}</small></article></section><section className="tax-grid"><article className="tax-boxes"><header><span>تفاصيل الإقرار</span><h2>الخانات المحسوبة</h2></header>{[{box:"01",label:"توريدات خاضعة للضريبة في دبي",value:taxableRevenue,vat:outputVat},{box:"09",label:"مصاريف ومشتريات خاضعة",value:taxableExpense,vat:inputVat},{box:"10",label:"إجمالي الضريبة المستحقة",value:0,vat:outputVat},{box:"14",label:"الضريبة القابلة للاسترداد",value:0,vat:inputVat},{box:"15",label:"صافي الضريبة المستحقة",value:0,vat:due}].map(item=><div key={item.box}><span>{item.box}</span><p><strong>{item.label}</strong><small>القيمة {item.value.toLocaleString()} د.إ</small></p><b>{item.vat.toLocaleString()} د.إ</b></div>)}</article><article className="tax-checklist"><header><span>مراجعة الترابط</span><h2>جاهزية الإقرار</h2></header>{[{label:"إيرادات الكاشير",count:revenues.length},{label:"فواتير المواد والمخزن",count:expenses.filter(item=>item.source==="المواد والمخزن").length},{label:"المصاريف التشغيلية",count:expenses.filter(item=>item.source!=="المواد والمخزن").length},{label:"القيود ذات ضريبة 5%",count:ledger.filter(item=>item.vat>0).length}].map(item=><div key={item.label}><span><Icon name="check"/></span><p><strong>{item.label}</strong><small>{item.count} سجلات مكتملة</small></p></div>)}<button onClick={()=>setDeclarationOpen(true)}>إعداد الإقرار الضريبي</button></article></section></div>
  </>
}

function Waste({notify,confirm,setLedger}:{notify:(x:string)=>void;confirm:ConfirmAction;setLedger:React.Dispatch<React.SetStateAction<LedgerEntry[]>>}){
  const [open,setOpen]=useState(false);
  const [logs,setLogs]=useState(["شوت رقم C-202 سريع: 23 ثانية","رغوة الفلات وايت أعلى من المعيار","درجة الكولد برو ممتازة: 4.6/5","تمت معايرة مطحنة الترشيح"]);
  const [draft,setDraft]=useState({reason:"ضبط المطحنة",quantity:0,unit:"جرام",cost:0,note:""});
  function saveWaste(e:React.FormEvent){e.preventDefault();confirm({title:"تسجيل الهدر",message:`هل تريد تسجيل ${draft.quantity} ${draft.unit} بسبب ${draft.reason}؟`,confirmLabel:"حفظ السجل",onConfirm:()=>{setLogs(items=>[`${draft.reason}: ${draft.quantity} ${draft.unit}${draft.note?` · ${draft.note}`:""}`,...items]);if(draft.cost>0)setLedger(items=>[{id:`EXP-WST-${Date.now()}`,type:"expense",title:`هدر: ${draft.reason}`,category:"هدر وتشغيل",amount:draft.cost,vat:0,date:"24-08-2026",source:"الهدر والجودة",method:"تسوية",},...items]);setOpen(false);notify("تم تسجيل الهدر وربط تكلفته بالحسابات")}})}
  return <>
    {open&&<div className="modal-layer waste-editor-layer"><form className="command-modal waste-command" onSubmit={saveWaste}><header><span><Icon name="drop"/></span><div><small>الهدر والجودة</small><h2>تسجيل هدر جديد</h2><p>السبب والكمية والتكلفة وملاحظة الجودة.</p></div></header><div className="command-grid"><label>سبب الهدر<select value={draft.reason} onChange={e=>setDraft(v=>({...v,reason:e.target.value}))}><option>ضبط المطحنة</option><option>مشروب معاد</option><option>انتهاء صلاحية</option><option>انسكاب وتحضير</option></select></label><label>الكمية<input type="number" min="0" step="0.01" value={draft.quantity} onChange={e=>setDraft(v=>({...v,quantity:Number(e.target.value)}))}/></label><label>الوحدة<select value={draft.unit} onChange={e=>setDraft(v=>({...v,unit:e.target.value}))}><option>جرام</option><option>كجم</option><option>كوب</option><option>قطعة</option></select></label><label>التكلفة المالية<input type="number" min="0" step="0.01" value={draft.cost} onChange={e=>setDraft(v=>({...v,cost:Number(e.target.value)}))}/></label><label className="wide">الملاحظة<input value={draft.note} onChange={e=>setDraft(v=>({...v,note:e.target.value}))}/></label></div><footer><button type="button" className="secondary" onClick={()=>setOpen(false)}>إلغاء</button><button type="submit">حفظ وربط الحسابات</button></footer></form></div>}
    <div className="waste-page"><section className="waste-score"><span>هدر اليوم</span><strong>1.84%</strong><p>أقل من الحد المستهدف 2.5%</p><div className="waste-ring"><i/></div><button onClick={()=>setOpen(true)}><Icon name="plus"/>تسجيل هدر</button></section><section className="waste-reasons"><header><span>أين حدث الفاقد؟</span><h2>حسب السبب</h2></header>{[{n:"ضبط المطحنة",v:"420 g",p:38},{n:"مشروب معاد",v:"7 أكواب",p:27},{n:"انتهاء صلاحية",v:"1.2 kg",p:21},{n:"انسكاب وتحضير",v:"310 g",p:14}].map(x=><div key={x.n}><p><strong>{x.n}</strong><b>{x.v}</b></p><i><em style={{width:`${x.p}%`}}/></i><span>{x.p}%</span></div>)}</section><section className="quality-log"><header><span>سجل الجودة</span><h2>آخر الملاحظات</h2></header>{logs.slice(0,6).map((x,i)=><div key={`${x}-${i}`}><span className={i<2?"alert":"ok"}><Icon name={i<2?"drop":"check"}/></span><p>{x}<small>منذ {8+i*11} دقيقة</small></p></div>)}</section></div>
  </>
}

function Guests({confirm,notify}:{confirm:ConfirmAction;notify:(x:string)=>void}){
  const [guests,setGuests]=useState([{n:"سارة محمد",phone:"0501234567",fav:"سبانيش لاتيه · شوفان",visits:14,pts:1240,tag:"ذهبي",a:"SM"},{n:"خالد علي",phone:"0502345678",fav:"فلات وايت · دبل",visits:11,pts:960,tag:"منتظم",a:"KA"},{n:"ليلى حسن",phone:"0503456789",fav:"V60 · بدون سكر",visits:9,pts:780,tag:"ذهبي",a:"LH"},{n:"مايا يوسف",phone:"0504567890",fav:"ماتشا · لوز",visits:7,pts:540,tag:"جديد",a:"MY"}]);
  const [editor,setEditor]=useState<{mode:"add"|"edit";index?:number}|null>(null);
  const [draft,setDraft]=useState({n:"",phone:"",fav:"",visits:0,pts:0,tag:"جديد",a:"--"});
  function openAdd(){setDraft({n:"",phone:"",fav:"",visits:0,pts:0,tag:"جديد",a:"--"});setEditor({mode:"add"})}
  function openGuest(index:number){setDraft(guests[index]);setEditor({mode:"edit",index})}
  function saveGuest(e:React.FormEvent){e.preventDefault();if(!draft.n.trim()){notify("اسم الضيف مطلوب");return}confirm({title:editor?.mode==="edit"?"تعديل ملف الضيف":"إضافة ضيف",message:`هل تريد حفظ بيانات ${draft.n}؟`,confirmLabel:"حفظ الملف",onConfirm:()=>{const initials=draft.n.split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase();const value={...draft,a:initials||"--"};setGuests(items=>editor?.mode==="edit"&&editor.index!==undefined?items.map((item,index)=>index===editor.index?value:item):[...items,value]);setEditor(null);notify("تم حفظ ملف الضيف وبيانات الولاء")}})}
  return <>
    {editor&&<div className="modal-layer guest-editor-layer"><form className="command-modal guest-command" onSubmit={saveGuest}><header><span><Icon name="guests"/></span><div><small>الضيوف والولاء</small><h2>{editor.mode==="edit"?"تعديل ملف الضيف":"إضافة ضيف جديد"}</h2><p>بيانات التواصل والمشروب المعتاد والنقاط والزيارات.</p></div></header><div className="command-grid"><label>اسم الضيف<input value={draft.n} onChange={e=>setDraft(v=>({...v,n:e.target.value}))}/></label><label>رقم الهاتف<input value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))}/></label><label>المشروب المعتاد<input value={draft.fav} onChange={e=>setDraft(v=>({...v,fav:e.target.value}))}/></label><label>عدد الزيارات<input type="number" min="0" value={draft.visits} onChange={e=>setDraft(v=>({...v,visits:Number(e.target.value)}))}/></label><label>نقاط الولاء<input type="number" min="0" value={draft.pts} onChange={e=>setDraft(v=>({...v,pts:Number(e.target.value)}))}/></label><label>التصنيف<select value={draft.tag} onChange={e=>setDraft(v=>({...v,tag:e.target.value}))}><option>جديد</option><option>منتظم</option><option>ذهبي</option></select></label></div><footer><button type="button" className="secondary" onClick={()=>setEditor(null)}>إلغاء</button><button type="submit">حفظ الملف</button></footer></form></div>}
    <div className="guests-page"><section className="guest-search"><span>دفتر الضيوف</span><h2>{guests.length.toLocaleString()} ملفات ضيوف مترابطة</h2><div><Icon name="search"/><input placeholder="اسم الضيف، الهاتف، أو المشروب المعتاد"/></div><button onClick={openAdd}><Icon name="plus"/>إضافة ضيف</button></section><section className="guest-list">{guests.map((x,index)=><article key={`${x.n}-${index}`}><span>{x.a}</span><div><strong>{x.n}</strong><small>{x.fav} · {x.phone}</small></div><p>{x.visits} زيارة</p><b>{x.pts.toLocaleString()}<small> نقطة</small></b><Badge tone={x.tag==="ذهبي"?"recipe":"neutral"}>{x.tag}</Badge><button onClick={()=>openGuest(index)}><Icon name="arrow"/></button></article>)}</section><aside className="guest-pattern"><span>نمط اليوم</span><h2>73% يعودون لنفس المشروب</h2><p>اقتراح إضافات متوافقة بدلاً من تغيير الوصفة الأساسية.</p><div><strong>186</strong><span>حساب ضيف نشط هذا الأسبوع</span></div><div><strong>42K</strong><span>نقطة متداولة</span></div></aside></div>
  </>
}

function Settings({confirm,notify,settings,setSettings,saveSettings,saving,savingLabel}:{confirm:ConfirmAction;notify:(x:string)=>void;settings:SystemSettings;setSettings:React.Dispatch<React.SetStateAction<SystemSettings>>;saveSettings:(next?:SystemSettings,message?:string,busyLabel?:string)=>Promise<boolean>;saving:boolean;savingLabel:string}){
  const {business,operations:options,users}=settings;
  const [editor,setEditor]=useState<"business"|"users"|null>(null);
  const [businessDraft,setBusinessDraft]=useState(business);
  const emptyUser:SystemUser={name:"",role:"تشغيل الكاشير",branch:"دبي",phone:""};
  const [userDraft,setUserDraft]=useState(emptyUser);
  const [userIndex,setUserIndex]=useState<number|null>(null);
  const settingRows=[
    {id:"printing" as const,title:"طباعة بطاقة الكوب",note:"إرسال بطاقة الوصفة إلى محطة التحضير تلقائياً"},
    {id:"alerts" as const,title:"تنبيهات الجودة",note:"تنبيه عند خروج الزمن أو الوزن عن معيار الوصفة"},
    {id:"routing" as const,title:"توجيه الطلبات تلقائياً",note:"اختيار المحطة المناسبة حسب نوع المشروب"},
    {id:"receipts" as const,title:"إيصال رقمي",note:"اعتماد الإيصال الرقمي قبل الطباعة الورقية"},
  ];
  function requestToggle(item:(typeof settingRows)[number]){
    const next=!options[item.id];
    confirm({title:`${next?"تشغيل":"إيقاف"} ${item.title}`,message:`هل تريد ${next?"تشغيل":"إيقاف"} هذا الإعداد على جميع محطات المقهى؟`,confirmLabel:"تأكيد التغيير",onConfirm:()=>{setSettings(value=>({...value,operations:{...value.operations,[item.id]:next}}));notify("تم تعديل الخيار، زر حفظ الإعدادات يعتمد التغيير")}});
  }
  function saveBusiness(e:React.FormEvent){e.preventDefault();confirm({title:"حفظ بيانات المقهى",message:`هل تريد اعتماد بيانات ${businessDraft.name} وفرع ${businessDraft.branch}؟`,confirmLabel:"حفظ البيانات",onConfirm:()=>{const next={...settings,business:businessDraft};setSettings(next);void saveSettings(next,"تم حفظ بيانات المقهى وتحديث الترويسة","جاري حفظ بيانات المنشأة...").then(ok=>{if(ok)setEditor(null)})}})}
  function openUsers(){setUserIndex(null);setUserDraft(emptyUser);setEditor("users")}
  function selectUser(index:number){setUserIndex(index);setUserDraft(users[index])}
  function saveUser(e:React.FormEvent){e.preventDefault();if(!userDraft.name.trim()){notify("اسم المستخدم مطلوب");return}confirm({title:userIndex===null?"إضافة مستخدم":"تعديل المستخدم",message:`هل تريد حفظ بيانات ${userDraft.name} وصلاحية ${userDraft.role}؟`,confirmLabel:"حفظ المستخدم",onConfirm:()=>{const updated=userIndex===null?[...users,userDraft]:users.map((item,index)=>index===userIndex?userDraft:item);const next={...settings,users:updated};setSettings(next);void saveSettings(next,"تم حفظ المستخدم والصلاحيات","جاري الحفظ...").then(ok=>{if(ok){setUserIndex(null);setUserDraft(emptyUser);setEditor(null)}})}})}
  function removeUser(){if(userIndex===null)return;const current=users[userIndex];confirm({title:"حذف المستخدم",message:`هل تريد حذف حساب ${current.name} وإيقاف الوصول إلى النظام؟`,confirmLabel:"تأكيد الحذف",onConfirm:()=>{const next={...settings,users:users.filter((_,index)=>index!==userIndex)};setSettings(next);setUserIndex(null);setUserDraft(emptyUser);void saveSettings(next,"تم حذف المستخدم وإيقاف الصلاحيات")}})}
  return <>
    {editor==="business"&&<div className="modal-layer settings-editor-layer"><form className="command-modal settings-command" onSubmit={saveBusiness}><header><span><Icon name="settings"/></span><div><small>بيانات النشاط</small><h2>تعديل بيانات المقهى</h2><p>الهوية والفرع والبيانات الضريبية ووسائل التواصل.</p></div></header><div className="command-grid"><label>اسم النشاط<input required value={businessDraft.name} onChange={e=>setBusinessDraft(v=>({...v,name:e.target.value}))}/></label><label>الفرع<input required value={businessDraft.branch} onChange={e=>setBusinessDraft(v=>({...v,branch:e.target.value}))}/></label><label>العملة<select value={businessDraft.currency} onChange={e=>setBusinessDraft(v=>({...v,currency:e.target.value}))}><option>درهم إماراتي</option><option>ريال سعودي</option><option>دولار أمريكي</option></select></label><label>لغة التشغيل<select value={businessDraft.language} onChange={e=>setBusinessDraft(v=>({...v,language:e.target.value}))}><option>العربية</option><option>English</option></select></label><label>الرقم الضريبي TRN<input value={businessDraft.trn} onChange={e=>setBusinessDraft(v=>({...v,trn:e.target.value}))}/></label><label>رقم التواصل<input value={businessDraft.phone} onChange={e=>setBusinessDraft(v=>({...v,phone:e.target.value}))}/></label></div><footer><button type="button" className="secondary" disabled={saving} onClick={()=>setEditor(null)}>إلغاء</button><button type="submit" disabled={saving}>{saving?savingLabel:"حفظ البيانات"}</button></footer></form></div>}
    {editor==="users"&&<div className="modal-layer settings-editor-layer"><form className="command-modal settings-command" onSubmit={saveUser}><header><span><Icon name="guests"/></span><div><small>الوصول والأمان</small><h2>إدارة المستخدمين والصلاحيات</h2><p>إضافة حساب أو اختيار حساب موجود للتعديل والحذف.</p></div></header><div className="user-editor-list">{users.map((user,index)=><button type="button" className={userIndex===index?"active":""} key={`${user.name}-${index}`} onClick={()=>selectUser(index)}><span>{user.name}</span><small>{user.role} · {user.branch}</small></button>)}<button type="button" className={userIndex===null?"active add":"add"} onClick={()=>{setUserIndex(null);setUserDraft(emptyUser)}}><Icon name="plus"/>حساب جديد</button></div><div className="command-grid"><label>اسم المستخدم<input required value={userDraft.name} onChange={e=>setUserDraft(v=>({...v,name:e.target.value}))}/></label><label>الدور<select value={userDraft.role} onChange={e=>setUserDraft(v=>({...v,role:e.target.value}))}><option>إدارة النظام</option><option>إدارة الوردية</option><option>تشغيل الكاشير</option><option>محطة التحضير</option></select></label><label>الفرع<input value={userDraft.branch} onChange={e=>setUserDraft(v=>({...v,branch:e.target.value}))}/></label><label>رقم التواصل<input value={userDraft.phone} onChange={e=>setUserDraft(v=>({...v,phone:e.target.value}))}/></label></div><footer>{userIndex!==null&&<button type="button" className="danger" disabled={saving} onClick={removeUser}>حذف المستخدم</button>}<button type="button" className="secondary" disabled={saving} onClick={()=>setEditor(null)}>إلغاء</button><button type="submit" disabled={saving}>{saving?savingLabel:userIndex===null?"إضافة المستخدم":"حفظ التعديل"}</button></footer></form></div>}
    <div className="settings-page">
    <section className="settings-card identity-settings"><header><span><Icon name="settings"/></span><div><small>بيانات النشاط</small><h2>{business.name}</h2><p>فرع {business.branch} · CAFÉ OS · الوردية المسائية</p></div></header><div className="settings-fields"><label>اسم النشاط<input value={business.name} readOnly/></label><label>الفرع<input value={business.branch} readOnly/></label><label>العملة<input value={business.currency} readOnly/></label><label>لغة التشغيل<input value={business.language} readOnly/></label></div><button onClick={()=>{setBusinessDraft(business);setEditor("business")}}>تعديل بيانات المقهى</button></section>
    <section className="settings-card operation-settings"><header><span><Icon name="sliders"/></span><div><small>الأوامر والمحطات</small><h2>إعدادات التشغيل</h2><p>الطباعة والتنبيهات ومسار تنفيذ الطلب.</p></div></header><div className="setting-switches">{settingRows.map(item=><button key={item.id} onClick={()=>requestToggle(item)}><span><strong>{item.title}</strong><small>{item.note}</small></span><i className={options[item.id]?"on":""}><em/></i></button>)}</div></section>
    <section className="settings-card access-settings"><header><span><Icon name="guests"/></span><div><small>الوصول والأمان</small><h2>المستخدمون والصلاحيات</h2><p>إدارة أدوار فريق المقهى والجلسات النشطة.</p></div></header><div className="access-summary"><div><strong>{users.length}</strong><span>مستخدمون</span></div><div><strong>{new Set(users.map(user=>user.role)).size}</strong><span>أدوار تشغيل</span></div><div><strong>2</strong><span>جلسات نشطة</span></div></div><button onClick={openUsers}>إدارة المستخدمين</button><button className="secondary" disabled={saving} onClick={()=>confirm({title:"حفظ الإعدادات",message:"هل تريد حفظ بيانات المقهى والمظهر وخيارات التشغيل والمستخدمين وربطها بالنظام؟",confirmLabel:"حفظ الكل",onConfirm:()=>{void saveSettings(settings)}})}>{saving?savingLabel:"حفظ الإعدادات"}</button></section>
  </div>
  </>
}

function Insights(){return <div className="insights-page"><section className="speed-panel"><header><div><span>سرعة التحضير</span><h2>زمن الكوب خلال اليوم</h2></div><Badge tone="live">− 38 ثانية</Badge></header><div className="speed-main"><strong>04:18</strong><span>متوسط التحضير</span></div><div className="speed-chart">{[46,53,42,61,78,68,84,72,58,49,66,76].map((h,i)=><i key={i} className={i===6?"peak":""} style={{height:`${h}%`}}><span>{i===6?"05:40":""}</span></i>)}</div><div className="axis"><span>8 ص</span><span>12 ظ</span><span>4 م</span><span>8 م</span></div></section><section className="quality-panel"><span>جودة الاستخلاص</span><h2>92 / 100</h2><div className="quality-bars"><p><span>الوزن</span><i><em style={{width:"96%"}}/></i><b>96%</b></p><p><span>الزمن</span><i><em style={{width:"89%"}}/></i><b>89%</b></p><p><span>الحرارة</span><i><em style={{width:"94%"}}/></i><b>94%</b></p><p><span>إعادة التحضير</span><i><em style={{width:"86%"}}/></i><b>86%</b></p></div></section><section className="insight-strip"><div><Icon name="timer"/><span>أسرع محطة</span><strong>المحطة الباردة</strong><small>02:14 لكل طلب</small></div><div><Icon name="recipe"/><span>أكثر وصفة ثباتاً</span><strong>فلات وايت</strong><small>96% ضمن المعيار</small></div><div><Icon name="drop"/><span>أكبر فرصة تحسين</span><strong>ضبط المطحنة</strong><small>38% من الهدر</small></div><div><Icon name="guests"/><span>رضا الضيوف</span><strong>4.8 / 5</strong><small>من 86 تقييماً</small></div></section></div>}
