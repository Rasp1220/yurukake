import { Icon } from "@iconify/react";

type AlertVariant = "error" | "success" | "info";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
  info: "border-orange-200 bg-orange-50 text-stone-700",
};

const VARIANT_ICONS: Record<AlertVariant, string> = {
  error: "mdi:alert-circle-outline",
  success: "mdi:check-circle-outline",
  info: "mdi:information-outline",
};

/**
 * ブラウザ標準の`alert()`のような素っ気ない見た目ではなく、デザインに
 * 沿ったスタイルでエラー・成功・案内メッセージを表示する共通コンポーネント。
 * メッセージが空のときは何も描画しない。
 */
export default function Alert({
  variant = "error",
  children,
  className = "",
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <Icon icon={VARIANT_ICONS[variant]} className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
