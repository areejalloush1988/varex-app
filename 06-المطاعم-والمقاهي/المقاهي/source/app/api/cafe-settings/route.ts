import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cafeSettings } from "@/db/schema";
import { getCafeAuth } from "@/lib/auth";

const defaults={
  business:{name:"مقهى أورورا",branch:"دبي",currency:"درهم إماراتي",language:"العربية",trn:"100000000000003",phone:"+971 4 555 0190"},
  operations:{printing:true,alerts:true,routing:true,receipts:false},
  theme:"orange",
  users:[
    {name:"أريج علوش",role:"إدارة النظام",branch:"دبي",phone:"050 000 1201"},
    {name:"سامي حداد",role:"إدارة الوردية",branch:"دبي",phone:"050 000 1202"},
    {name:"رامي ناصر",role:"تشغيل الكاشير",branch:"دبي",phone:"050 000 1203"},
  ],
};

function fromRow(row:typeof cafeSettings.$inferSelect){
  let users=defaults.users;
  try{const parsed=JSON.parse(row.usersJson);if(Array.isArray(parsed))users=parsed}catch{}
  return {business:{name:row.name,branch:row.branch,currency:row.currency,language:row.language,trn:row.trn,phone:row.phone},operations:{printing:row.printing,alerts:row.alerts,routing:row.routing,receipts:row.receipts},theme:row.theme,users};
}

export async function GET(){
  const db=getDb();
  const row=await db.select().from(cafeSettings).where(eq(cafeSettings.id,"main")).get();
  return Response.json(row?fromRow(row):defaults,{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  const session=await (await getCafeAuth()).api.getSession({headers:request.headers});
  if(!session)return Response.json({error:"انتهت جلسة الحساب. يلزم تسجيل الدخول لحفظ الإعدادات."},{status:401});
  const body=await request.json() as typeof defaults;
  if(!body?.business?.name?.trim()||!body?.business?.branch?.trim())return Response.json({error:"اسم المقهى والفرع مطلوبان"},{status:400});
  const record={id:"main",name:String(body.business.name).trim(),branch:String(body.business.branch).trim(),currency:String(body.business.currency||defaults.business.currency),language:String(body.business.language||defaults.business.language),trn:String(body.business.trn||""),phone:String(body.business.phone||""),theme:String(body.theme||"orange"),printing:Boolean(body.operations?.printing),alerts:Boolean(body.operations?.alerts),routing:Boolean(body.operations?.routing),receipts:Boolean(body.operations?.receipts),usersJson:JSON.stringify(Array.isArray(body.users)?body.users:defaults.users),updatedAt:Date.now()};
  const db=getDb();
  await db.insert(cafeSettings).values(record).onConflictDoUpdate({target:cafeSettings.id,set:record}).run();
  return Response.json(fromRow(record),{headers:{"Cache-Control":"no-store"}});
}
