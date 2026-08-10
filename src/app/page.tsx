import Image from "next/image";
import VideoSlider from "@/components/VideoSlider";
import RecommendedSection from "@/components/RecommendedSection";
import { AREAS } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 py-4">
      <Image
        src="/images/logo-top.png"
        alt="ゆるっとおでかけ"
        width={1717}
        height={582}
        priority
        className="mx-auto w-full max-w-md"
      />

      <div className="-mt-4 space-y-2 text-center">
        <h1 className="text-2xl font-bold text-stone-800 sm:text-3xl">
          行きたい場所、SNSからサクッと集めよう
        </h1>
        <p className="text-stone-500">
          エリアの紹介動画から気になるスポットを見つけて、お出かけリストに追加できます。
        </p>
      </div>

      <RecommendedSection />

      {AREAS.map((area) => (
        <VideoSlider key={area.query} areaLabel={area.label} query={area.query} />
      ))}
    </div>
  );
}
