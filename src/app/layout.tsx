import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

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
    <html lang="ja">
      <body>
        <NavBar />
        <main className="mx-auto min-h-[calc(100vh-57px)] max-w-7xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
