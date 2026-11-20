"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Alert from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "confirmEmail">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < 6) {
      setStatus("error");
      setErrorMessage("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("パスワードが一致しません");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // If email confirmation is enabled in the Supabase project, there's no
    // session yet, and the user needs to click the link sent to their inbox.
    if (!data.session) {
      setStatus("confirmEmail");
      return;
    }

    router.push("/mypage");
    router.refresh();
  }

  if (status === "confirmEmail") {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-2xl font-bold text-slate-800">確認メールを送信しました</h1>
        <p className="mt-3 text-sm text-slate-500">
          {email} 宛に確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">新規登録</h1>
        <p className="mt-1 text-sm text-slate-500">
          アカウントを作成してお出かけスポットを登録しましょう。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <Label>
            メールアドレス
          </Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
          />
        </div>
        <div>
          <Label>
            パスワード
          </Label>
          <Input
            type="password"
            required
            minLength={6}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div>
          <Label>
            パスワード（確認）
          </Label>
          <Input
            type="password"
            required
            minLength={6}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {status === "error" && <Alert>{errorMessage}</Alert>}

        <Button
          type="submit"
          disabled={status === "loading"}
          className="mt-2 w-full"
        >
          {status === "loading" ? "登録中..." : "アカウントを作成"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
