import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Kiwi_Maru, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const display = Kiwi_Maru({ weight: ["500"], subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "ゆるかけ | お出かけSNSキュレーション＆スマート案内",
  description:
    "SNSで見つけたお出かけスポットを集めて、マップとルートで効率よく巡ろう。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable}`}>
      <body>
        <NavBar />
        <main className="mx-auto min-h-[calc(100vh-57px)] max-w-7xl px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
