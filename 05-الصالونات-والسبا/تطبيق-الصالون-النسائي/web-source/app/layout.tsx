import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://varex-womens-salon.areejalloush1988.chatgpt.site"),
  title: "تصميم نظام الصالون النسائي",
  description: "نظام VAREX المتكامل لإدارة الصالونات النسائية والمواعيد والعميلات والفريق.",
  icons: { icon: "/brand/varex-logo.png", shortcut: "/brand/varex-logo.png" },
  openGraph: {
    title: "VAREX | إدارة الصالون النسائي",
    description: "مواعيدك، فريقك، خدماتك وإيراداتك في مساحة واحدة أنيقة.",
    type: "website",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "VAREX إدارة الصالون النسائي" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VAREX | إدارة الصالون النسائي",
    description: "نظام إدارة صالون نسائي متكامل.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
