"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PROFILE_TAGS } from "@/lib/constants";
import { getMyProfile, updateMyAvatar, updateMyProfile, uploadAvatar } from "@/lib/profiles";
import type { Profile } from "@/lib/types";

export default function ProfileContent() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function load() {
    try {
      const profileData = await getMyProfile();
      setProfile(profileData);
      setDisplayName(profileData.displayName ?? "");
      setTags(profileData.tags);
      setTwitterUrl(profileData.twitterUrl ?? "");
      setInstagramUrl(profileData.instagramUrl ?? "");
      setYoutubeUrl(profileData.youtubeUrl ?? "");
      setWebsiteUrl(profileData.websiteUrl ?? "");
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  const profileDirty =
    displayName.trim() !== (profile?.displayName ?? "") ||
    tags.length !== (profile?.tags.length ?? 0) ||
    tags.some((tag) => !profile?.tags.includes(tag)) ||
    twitterUrl.trim() !== (profile?.twitterUrl ?? "") ||
    instagramUrl.trim() !== (profile?.instagramUrl ?? "") ||
    youtubeUrl.trim() !== (profile?.youtubeUrl ?? "") ||
    websiteUrl.trim() !== (profile?.websiteUrl ?? "");

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        tags,
        twitterUrl: twitterUrl.trim(),
        instagramUrl: instagramUrl.trim(),
        youtubeUrl: youtubeUrl.trim(),
        websiteUrl: websiteUrl.trim(),
      });
      setProfile(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プロフィールの更新に失敗しました");
      setStatus("error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      const updated = await updateMyAvatar(url);
      setProfile(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プロフィール画像の更新に失敗しました");
      setStatus("error");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">プロフィール</h1>
        <p className="text-sm text-stone-500">
          ここで設定した表示名・画像・タグ・SNSリンクで、公開したブログの一覧ページに表示されます。
        </p>
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-stone-100">
            {profile?.avatarUrl && (
              <Image src={profile.avatarUrl} alt="" fill sizes="64px" className="object-cover" />
            )}
          </div>
          <label className="cursor-pointer rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50">
            {avatarUploading ? "アップロード中..." : profile?.avatarUrl ? "画像を変更" : "画像を選択"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={avatarUploading}
              onChange={handleAvatarChange}
            />
          </label>
        </div>
        <form onSubmit={handleProfileSave} className="flex flex-col gap-3">
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="表示名（例：はるか）"
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-wrap gap-2">
            {PROFILE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  tags.includes(tag)
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-orange-200 text-stone-600 hover:border-brand-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="url"
              value={twitterUrl}
              onChange={(event) => setTwitterUrl(event.target.value)}
              placeholder="X（Twitter）のURL"
              className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="url"
              value={instagramUrl}
              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="InstagramのURL"
              className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="YouTubeのURL"
              className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="WebサイトのURL"
              className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile || !profileDirty}
            className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {savingProfile ? "保存中..." : "保存"}
          </button>
        </form>
        {profile && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link
              href={`/blogger/${profile.userId}`}
              target="_blank"
              className="text-brand-600 hover:underline"
            >
              自分の公開ページを見る ↗
            </Link>
            <Link href="/bloggers" className="text-brand-600 hover:underline">
              ブロガーを探す ↗
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
