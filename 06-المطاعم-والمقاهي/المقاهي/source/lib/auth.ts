import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
export interface CafeAuthEnv{DB:D1Database;BETTER_AUTH_SECRET:string;VAREX_THEME_SYNC_SECRET:string}
export function createCafeAuth(runtimeEnv:CafeAuthEnv){
  if(!runtimeEnv.DB)throw new Error("Cafe authentication database is unavailable.");
  if(!runtimeEnv.BETTER_AUTH_SECRET||runtimeEnv.BETTER_AUTH_SECRET.length<32)throw new Error("Cafe authentication secret is unavailable.");
  return betterAuth({appName:"VAREX Café",baseURL:"https://varex-cafe.areejalloush1988.chatgpt.site",basePath:"/api/auth",secret:runtimeEnv.BETTER_AUTH_SECRET,database:drizzleAdapter(drizzle(runtimeEnv.DB,{schema}),{provider:"sqlite",schema}),trustedOrigins:["https://varex-cafe.areejalloush1988.chatgpt.site","https://app.varexapp.com"],emailAndPassword:{enabled:true,autoSignIn:false,requireEmailVerification:true,minPasswordLength:8,maxPasswordLength:128,revokeSessionsOnPasswordReset:true},emailVerification:{sendOnSignUp:false,sendOnSignIn:false},session:{expiresIn:60*60*24*30,updateAge:60*60*24},rateLimit:{enabled:true,window:60,max:30,storage:"database"},advanced:{cookiePrefix:"varex_cafe",useSecureCookies:true,database:{generateId:"uuid"}}});
}
export async function getCafeAuth(){const cloudflare=await import("cloudflare:workers");return createCafeAuth(cloudflare.env as unknown as CafeAuthEnv)}
