import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Post Builder — Canva-style carousel generator",
  description:
    "Turn competitor posts (screenshots, pasted text, or an Instagram URL) into ready-to-post 1080×1080 carousels in your own template.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
