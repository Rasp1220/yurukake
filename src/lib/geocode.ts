export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number }> {
  const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "住所の変換に失敗しました");
  }
  return res.json();
}
