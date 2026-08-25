import type {Metadata,Viewport} from "next";import "./globals.css";import PwaRegister from "./pwa-register";
export const metadata:Metadata={title:"VAREX لإدارة مقاولات البناء",description:"نظام احترافي متكامل لإدارة مشاريع المقاولات والبناء والتكاليف والعقود والمواقع.",manifest:"/manifest.webmanifest",applicationName:"VAREX Construction",appleWebApp:{capable:true,statusBarStyle:"default",title:"VAREX مقاولات"},icons:{icon:"/varex-construction-logo.png",apple:"/varex-construction-logo.png"}};
export const viewport:Viewport={themeColor:"#8792A2",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}<PwaRegister/></body></html>}
