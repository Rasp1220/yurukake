import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import VideoSlider from "@/components/VideoSlider";
import RecommendedSection from "@/components/RecommendedSection";
import { AREAS } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 py-4">
      <section className="grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-12">
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl leading-tight sm:text-4xl">
              行きたい場所、
              <br className="hidden sm:block" />
              SNSからサクッと集めよう
            </h1>
            <p className="text-muted-foreground">
              エリアの紹介動画から気になるスポットを見つけて、お出かけリストに追加できます。
            </p>
          </div>
          <SearchBar />
          <ul className="flex flex-wrap gap-2" aria-label="エリアから探す">
            {AREAS.map((area) => (
              <li key={area.query}>
                <Button asChild variant="outline" size="sm" className="bg-card">
                  <Link href={`/search?q=${encodeURIComponent(area.query)}`}>{area.label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <Image
          src="/images/logo-top.png"
          alt="ゆるっとおでかけ"
          width={1717}
          height={582}
          priority
          className="order-first mx-auto w-full max-w-[16rem] md:order-none md:max-w-sm"
        />
      </section>

      <RecommendedSection />

      {AREAS.map((area) => (
        <VideoSlider key={area.query} areaLabel={area.label} query={area.query} />
      ))}
    </div>
  );
}
