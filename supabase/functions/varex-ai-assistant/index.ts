import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://varexapp.com","https://www.varexapp.com","https://areejalloush1988.github.io"]);
const requests = new Map<string,{ startedAt:number; count:number }>();

function corsHeaders(request:Request){
  const origin=request.headers.get("origin")||"";
  const local=/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return{"Access-Control-Allow-Origin":allowedOrigins.has(origin)||local?origin:"https://varexapp.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};
}
function json(request:Request,body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(request),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
function env(name:string){const value=Deno.env.get(name);if(!value)throw new Error(`Missing ${name}`);return value}
function projectPublicKey(){
  const dictionary=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(dictionary){
    try{
      const keys=JSON.parse(dictionary) as Record<string,unknown>;
      const value=keys.default||Object.values(keys).find(item=>typeof item==="string"&&item);
      if(typeof value==="string"&&value)return value;
    }catch{/* Use the regular environment variables below. */}
  }
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")||env("SUPABASE_ANON_KEY");
}
function rateLimited(userId:string){const now=Date.now(),windowMs=60_000,limit=20,current=requests.get(userId);if(!current||now-current.startedAt>=windowMs){requests.set(userId,{startedAt:now,count:1});return false}current.count+=1;return current.count>limit}
function cleanHistory(value:unknown){const cleaned:Array<{role:"assistant"|"user";content:string}>=[];if(!Array.isArray(value))return cleaned;for(const item of value.slice(-6)){const row=item&&typeof item==="object"?item as Record<string,unknown>:{};const role=row.role==="assistant"?"assistant":"user";const content=String(row.content||"").trim().slice(0,1200);if(content)cleaned.push({role,content})}return cleaned}
function outputText(data:Record<string,unknown>){if(typeof data.output_text==="string")return data.output_text.trim();const output=Array.isArray(data.output)?data.output:[];const parts:string[]=[];for(const item of output){if(!item||typeof item!=="object")continue;const content=Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[];for(const block of content){if(!block||typeof block!=="object")continue;const text=(block as Record<string,unknown>).text;if(typeof text==="string")parts.push(text)}}return parts.join("\n").trim()}

Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders(request)});
  if(request.method!=="POST")return json(request,{success:false,code:"METHOD_NOT_ALLOWED",message:"طريقة الطلب غير مسموحة."},405);
  try{
    const authorization=request.headers.get("authorization")||"",token=authorization.replace(/^Bearer\s+/i,"").trim();
    if(!token)return json(request,{success:false,code:"AUTH_REQUIRED",message:"يلزم تسجيل الدخول لاستخدام المساعد."},401);
    const supabaseUrl=env("SUPABASE_URL"),publicKey=projectPublicKey();
    const supabase=createClient(supabaseUrl,publicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const{data,error}=await supabase.auth.getUser(token),user=data?.user;
    if(error||!user?.id)return json(request,{success:false,code:"INVALID_SESSION",message:"جلسة المستخدم غير صالحة."},401);
    if(rateLimited(user.id))return json(request,{success:false,code:"RATE_LIMITED",message:"تم إرسال طلبات كثيرة. يرجى الانتظار دقيقة."},429);
    const body=await request.json().catch(()=>({})),message=String(body?.message||"").trim();
    if(!message||message.length>1200)return json(request,{success:false,code:"INVALID_MESSAGE",message:"يجب أن يكون السؤال بين 1 و1200 حرف."},400);
    const history=cleanHistory(body?.history),openaiKey=env("OPENAI_API_KEY"),model=Deno.env.get("OPENAI_VAREX_MODEL")||"gpt-5.6-luna";
    const input=[...history,{role:"user",content:message}];
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,store:false,instructions:"أنت مساعد VAREX العربي داخل نظام إدارة الأعمال. ساعد المستخدم في تشغيل نقطة البيع والمخزون والمشتريات والفواتير والطابعة والباركود والموظفين والصلاحيات والتقارير والضريبة والإعدادات. اشرح بخطوات قصيرة وواضحة. لا تطلب كلمة مرور أو بيانات بطاقة أو مفاتيح سرية. لا تدّع أنك نفذت عملية داخل النظام. لا تقدم حكماً ضريبياً أو قانونياً نهائياً، واطلب مراجعة مختص عندما يلزم. لا تفترض أنك تستطيع قراءة بيانات المنشأة؛ استخدم فقط المعلومات التي كتبها المستخدم في المحادثة.",input,reasoning:{effort:"low"},max_output_tokens:600})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("VAREX AI provider error",{status:response.status,requestId:response.headers.get("x-request-id")});return json(request,{success:false,code:"AI_PROVIDER_ERROR",message:"المساعد غير متاح مؤقتاً."},503)}
    const answer=outputText(payload as Record<string,unknown>);
    if(!answer)return json(request,{success:false,code:"EMPTY_RESPONSE",message:"لم تصل إجابة صالحة."},502);
    return json(request,{success:true,answer,model});
  }catch(error){console.error("VAREX AI assistant error",error);return json(request,{success:false,code:"AI_SERVICE_ERROR",message:"المساعد غير متاح مؤقتاً."},500)}
});
