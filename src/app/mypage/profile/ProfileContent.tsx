"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import MyPageTabs from "@/components/MyPageTabs";
import Alert from "@/components/Alert";
import AvatarImage from "@/components/AvatarImage";
import { MAX_LENGTH, MAX_PROFILE_LINKS, PROFILE_TAGS } from "@/lib/constants";
import { getMyProfile, updateMyAvatar, updateMyProfile, uploadAvatar } from "@/lib/profiles";
import type { Profile, ProfileLink } from "@/lib/types";

const EMPTY_LINK: ProfileLink = { label: "", url: "" };

function normalizeLinkUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function ProfileContent() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [twitterUsername, setTwitterUsername] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [youtubeUsername, setYoutubeUsername] = useState("");
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function load() {
    try {
      const profileData = await getMyProfile();
      applyProfile(profileData);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  function applyProfile(profileData: Profile) {
    setProfile(profileData);
    setDisplayName(profileData.displayName ?? "");
    setBio(profileData.bio ?? "");
    setTags(profileData.tags);
    setTwitterUsername(profileData.twitterUsername ?? "");
    setInstagramUsername(profileData.instagramUsername ?? "");
    setYoutubeUsername(profileData.youtubeUsername ?? "");
    setLinks(profileData.links.length > 0 ? profileData.links : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  function updateLink(index: number, patch: Partial<ProfileLink>) {
    setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  function addLink() {
    setLinks((current) =>
      current.length >= MAX_PROFILE_LINKS ? current : [...current, { ...EMPTY_LINK }],
    );
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  const linksEqual =
    links.length === (profile?.links.length ?? 0) &&
    links.every((link, i) => {
      const other = profile?.links[i];
      return other && link.label === other.label && link.url === other.url;
    });

  const profileDirty =
    displayName.trim() !== (profile?.displayName ?? "") ||
    bio.trim() !== (profile?.bio ?? "") ||
    tags.length !== (profile?.tags.length ?? 0) ||
    tags.some((tag) => !profile?.tags.includes(tag)) ||
    twitterUsername.trim() !== (profile?.twitterUsername ?? "") ||
    instagramUsername.trim() !== (profile?.instagramUsername ?? "") ||
    youtubeUsername.trim() !== (profile?.youtubeUsername ?? "") ||
    !linksEqual;

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        tags,
        twitterUsername: twitterUsername.trim(),
        instagramUsername: instagramUsername.trim(),
        youtubeUsername: youtubeUsername.trim(),
        links: links
          .map((link) => ({ label: link.label.trim(), url: normalizeLinkUrl(link.url) }))
          .filter((link) => link.url),
      });
      applyProfile(updated);
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
      applyProfile(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プロフィール画像の更新に失敗しました");
      setStatus("error");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarReset() {
    setAvatarUploading(true);
    try {
      const updated = await updateMyAvatar(null);
      applyProfile(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プロフィール画像のリセットに失敗しました");
      setStatus("error");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-6">
      <MyPageTabs />

      <div>
        <h1 className="text-2xl font-bold text-stone-800">プロフィール編集</h1>
        <p className="text-sm text-stone-500">
          ここで設定した表示名・画像・タグ・SNSリンクで、公開したブログの一覧ページに表示されます。
        </p>
      </div>

      {status === "error" && <Alert>{errorMessage}</Alert>}

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <AvatarImage src={profile?.avatarUrl ?? null} name={displayName} size={64} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50">
              {avatarUploading ? "処理中..." : profile?.avatarUrl ? "画像を変更" : "画像を選択"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={avatarUploading}
                onChange={handleAvatarChange}
              />
            </label>
            {profile?.avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarReset}
                disabled={avatarUploading}
                className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-60"
              >
                リセット
              </button>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-stone-400">
          正方形の256×256pxにリサイズ・圧縮してアップロードされます（JPEG）。
        </p>
        <form onSubmit={handleProfileSave} className="flex flex-col gap-3">
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="表示名（例：はるか）"
            maxLength={MAX_LENGTH.PROFILE}
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <div>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="プロフィール一言（例：週末は関東近郊のカフェ巡りをしています）"
              maxLength={MAX_LENGTH.PROFILE}
              rows={2}
              className="w-full resize-none rounded-2xl border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-right text-xs text-stone-400">
              {bio.length}/{MAX_LENGTH.PROFILE}
            </p>
          </div>

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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center rounded-full border border-orange-200 bg-white pl-4 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <SnsPrefix icon="ri:twitter-x-fill" prefix="x.com/" />
              <input
                type="text"
                value={twitterUsername}
                onChange={(event) => setTwitterUsername(event.target.value)}
                placeholder="ユーザー名"
                maxLength={MAX_LENGTH.PROFILE}
                className="w-full rounded-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex items-center rounded-full border border-orange-200 bg-white pl-4 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <SnsPrefix icon="mdi:instagram" prefix="instagram.com/" />
              <input
                type="text"
                value={instagramUsername}
                onChange={(event) => setInstagramUsername(event.target.value)}
                placeholder="ユーザー名"
                maxLength={MAX_LENGTH.PROFILE}
                className="w-full rounded-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex items-center rounded-full border border-orange-200 bg-white pl-4 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <SnsPrefix icon="mdi:youtube" prefix="youtube.com/@" />
              <input
                type="text"
                value={youtubeUsername}
                onChange={(event) => setYoutubeUsername(event.target.value)}
                placeholder="ユーザー名"
                maxLength={MAX_LENGTH.PROFILE}
                className="w-full rounded-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-stone-600">
              リンク（Webサイト・ポートフォリオなど、最大{MAX_PROFILE_LINKS}件）
            </p>
            {links.map((link, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(event) => updateLink(index, { label: event.target.value })}
                  placeholder="ラベル（例：ポートフォリオ）"
                  maxLength={MAX_LENGTH.PROFILE}
                  className="w-28 flex-shrink-0 rounded-full border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-36"
                />
                <input
                  type="text"
                  value={link.url}
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                  placeholder="URL（例：example.com）"
                  maxLength={MAX_LENGTH.PROFILE}
                  className="w-full min-w-0 rounded-full border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  aria-label="このリンクを削除"
                  className="flex-shrink-0 rounded-full border border-stone-200 p-2 text-stone-400 hover:border-red-300 hover:text-red-500"
                >
                  <Icon icon="mdi:close" className="h-4 w-4" />
                </button>
              </div>
            ))}
            {links.length < MAX_PROFILE_LINKS && (
              <button
                type="button"
                onClick={addLink}
                className="self-start rounded-full border border-dashed border-orange-300 px-4 py-1.5 text-xs font-medium text-brand-600 hover:bg-orange-50"
              >
                + リンクを追加
              </button>
            )}
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
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              自分の公開ページを見る
              <Icon icon="mdi:open-in-new" className="h-3.5 w-3.5" />
            </Link>
            <Link href="/search" className="text-brand-600 hover:underline">
              ブログをさがす
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SnsPrefix({ icon, prefix }: { icon: string; prefix: string }) {
  return (
    <span className="flex flex-shrink-0 items-center gap-1 text-xs text-stone-400">
      <Icon icon={icon} className="h-4 w-4" />
      {prefix}
    </span>
  );
}
