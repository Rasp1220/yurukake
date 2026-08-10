import { redirect } from "next/navigation";

// マイページ単体の画面は廃止し、プロフィール・ブロガー情報・プランの3つに
// 分割した。ナビの「マイページ」もここへ来るため、既定でプロフィールへ送る。
export default function MyPage() {
  redirect("/mypage/profile");
}
