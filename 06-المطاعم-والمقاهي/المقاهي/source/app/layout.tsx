import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://varex-cafe.chatgpt.site"),
  title: "VAREX Café Management | نظام إدارة المقاهي",
  description: "نظام VAREX لتشغيل المقاهي: مسار تحضير القهوة والمشروبات، محطات التحضير، الوصفات، الدُفعات، الهدر، الطاولات والضيوف.",
  applicationName: "VAREX Café Management",
  manifest: "/manifest.json",
  icons: { icon: "/varex-app-icon-192.png", apple: "/varex-app-icon-192.png" },
  openGraph: { title: "VAREX Café Management", description: "Coffee preparation, quick drinks, recipes, batches, waste, tables and guest care in one café operating system.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "VAREX Café Management", description: "Coffee preparation, quick drinks, recipes, batches, waste, tables and guest care in one café operating system.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
