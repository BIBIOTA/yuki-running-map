import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Yuki's Running Map",
  description: "Yuki 的跑步路線分享地圖",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
