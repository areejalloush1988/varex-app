import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cafeSettings } from "@/db/schema";
import { CAFE_THEME_COLORS,isCafeTheme,type CafeTheme } from "@/lib/cafe-theme";

export async function GET(request:Request){
  const requested=new URL(request.url).searchParams.get("theme");
  let theme:CafeTheme=isCafeTheme(requested)?requested:"orange";
  let version="default";
  if(!isCafeTheme(requested)){
    try{
      const row=await getDb().select({theme:cafeSettings.theme,updatedAt:cafeSettings.updatedAt}).from(cafeSettings).where(eq(cafeSettings.id,"main")).get();
      if(row&&isCafeTheme(row.theme)){theme=row.theme;version=String(row.updatedAt)}
    }catch{}
  }
  const color=CAFE_THEME_COLORS[theme];
  const manifest={
    id:"/cafe-system/",name:"VAREX Café Management",short_name:"VAREX Café",description:"نظام VAREX لإدارة وتشغيل المقاهي",lang:"ar",dir:"rtl",start_url:"/cafe-system/",scope:"/",display:"standalone",orientation:"any",theme_color:color,background_color:color,
    icons:[
      {src:`/icons/cafe/${theme}-192.png?v=${version}`,sizes:"192x192",type:"image/png",purpose:"any"},
      {src:`/icons/cafe/${theme}-512.png?v=${version}`,sizes:"512x512",type:"image/png",purpose:"any"},
      {src:`/icons/cafe/${theme}-512.png?v=${version}`,sizes:"512x512",type:"image/png",purpose:"maskable"},
    ],
  };
  return new Response(JSON.stringify(manifest),{headers:{"Content-Type":"application/manifest+json; charset=utf-8","Cache-Control":"no-store, max-age=0"}});
}
