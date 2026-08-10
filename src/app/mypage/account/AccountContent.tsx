"use client";

import { useEffect, useState } from "react";
import MyPageTabs from "@/components/MyPageTabs";
import Alert from "@/components/Alert";
import { getCurrentEmail, updateAccountEmail, updateAccountPassword } from "@/lib/account";

export default function AccountContent() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function load() {
    try {
      const email = await getCurrentEmail();
      setCurrentEmail(email);
      setNewEmail(email ?? "");
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEmailSave(event: React.FormEvent) {
    event.preventDefault();
    setEmailMessage("");
    setEmailError("");
    setSavingEmail(true);
    try {
      await updateAccountEmail(newEmail.trim());
      setEmailMessage(
        "確認メールを新旧どちらのアドレスにも送信しました。両方のメール内のリンクをクリックすると変更が反映されます。",
      );
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "メールアドレスの変更に失敗しました");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePasswordSave(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("パスワードは6文字以上で入力してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("パスワードが一致しません");
      return;
    }
    setSavingPassword(true);
    try {
      await updateAccountPassword(newPassword);
      setPasswordMessage("パスワードを変更しました。");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "パスワードの変更に失敗しました");
    } finally {
      setSavingPassword(false);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-6">
      <MyPageTabs />

      <div>
        <h1 className="text-2xl font-bold text-stone-800">アカウント情報</h1>
        <p className="text-sm text-stone-500">
          ログインに使うメールアドレスとパスワードを変更できます（公開プロフィールには表示されません）。
        </p>
      </div>

      {status === "error" && <Alert>{errorMessage}</Alert>}

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleEmailSave}
          className="mb-4 flex flex-col gap-2 border-b border-stone-100 pb-4"
        >
          <label className="text-xs font-medium text-stone-600">メールアドレス</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              maxLength={255}
              className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={
                savingEmail || !newEmail.trim() || newEmail.trim() === (currentEmail ?? "")
              }
              className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {savingEmail ? "変更中..." : "メールアドレスを変更"}
            </button>
          </div>
          {emailMessage && (
            <Alert variant="success" className="text-xs">
              {emailMessage}
            </Alert>
          )}
          {emailError && <Alert className="text-xs">{emailError}</Alert>}
        </form>

        <form onSubmit={handlePasswordSave} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-600">新しいパスワード</label>
          <input
            type="password"
            required
            minLength={6}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="6文字以上"
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="password"
            required
            minLength={6}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="新しいパスワード（確認）"
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {savingPassword ? "変更中..." : "パスワードを変更"}
          </button>
          {passwordMessage && (
            <Alert variant="success" className="text-xs">
              {passwordMessage}
            </Alert>
          )}
          {passwordError && <Alert className="text-xs">{passwordError}</Alert>}
        </form>
      </section>
    </div>
  );
}
