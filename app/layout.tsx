import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"منصة اختبار المتدربين – الأمن العام", description:"منصة إدارة واختبار المتدربين" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}