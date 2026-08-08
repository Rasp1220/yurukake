import SearchBar from "@/components/SearchBar";

const SUGGESTIONS = ["浅草 カフェ", "鎌倉 デート", "大阪 夜景", "京都 紅葉スポット"];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8 py-12 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-stone-800 sm:text-4xl">
          行きたい場所、SNSからサクッと集めよう
        </h1>
        <p className="text-stone-500">
          エリアやジャンルを入力すると、関連する紹介動画から気になるスポットを見つけて
          お出かけリストに追加できます。
        </p>
      </div>

      <div className="w-full max-w-xl">
        <SearchBar />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((keyword) => (
          <a
            key={keyword}
            href={`/search?q=${encodeURIComponent(keyword)}`}
            className="rounded-full border border-orange-200 bg-white px-4 py-1.5 text-sm text-stone-600 shadow-sm hover:border-brand-400 hover:text-brand-600"
          >
            {keyword}
          </a>
        ))}
      </div>
    </div>
  );
}
