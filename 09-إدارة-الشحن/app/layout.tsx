import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VAREX Shipping Management",
  description: "نظام VAREX المتكامل لإدارة الشحن وتتبع الشحنات والأسطول.",
  icons: {
    icon: "/varex-shipping-logo.svg",
    shortcut: "/varex-shipping-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
