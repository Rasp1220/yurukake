import Image from "next/image";
import { Icon } from "@iconify/react";

/**
 * プロフィール画像。未設定のときは、表示名の頭文字（無ければ人物アイコン）を
 * フォールバックとして表示する。
 */
export default function AvatarImage({
  src,
  name,
  size,
  className = "",
}: {
  src: string | null;
  name: string | null;
  size: number;
  className?: string;
}) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase();

  return (
    <div
      className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-brand-600 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={name ?? ""} fill sizes={`${size}px`} className="object-cover" />
      ) : initial ? (
        <span className="font-bold" style={{ fontSize: size * 0.4 }}>
          {initial}
        </span>
      ) : (
        <Icon icon="mdi:account" style={{ width: size * 0.6, height: size * 0.6 }} />
      )}
    </div>
  );
}
