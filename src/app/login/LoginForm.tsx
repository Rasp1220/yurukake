"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Alert from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message === "Invalid login credentials"
          ? "メールアドレスまたはパスワードが正しくありません"
          : error.message,
      );
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ログイン</h1>
        <p className="mt-1 text-sm text-slate-500">
          ログインしてお出かけスポットを登録・管理しましょう。
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={128}
          />
        </div>

        {status === "error" && <Alert>{errorMessage}</Alert>}

        <Button
          type="submit"
          disabled={status === "loading"}
          className="mt-2 w-full"
        >
          {status === "loading" ? "ログイン中..." : "ログイン"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
