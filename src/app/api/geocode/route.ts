import { NextRequest, NextResponse } from "next/server";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "住所またはスポット名を入力してください" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーにGOOGLE_MAPS_SERVER_API_KEYが設定されていません" },
      { status: 500 },
    );
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", apiKey);

  const geoRes = await fetch(url.toString());
  const data = await geoRes.json();

  if (data.status !== "OK" || !data.results?.length) {
    return NextResponse.json(
      { error: `場所が見つかりませんでした（${data.status}）` },
      { status: 404 },
    );
  }

  const location = data.results[0].geometry.location;
  return NextResponse.json({ lat: location.lat, lng: location.lng });
}
