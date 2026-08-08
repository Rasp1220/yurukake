import SearchResults from "./SearchResults";

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  return <SearchResults query={query} />;
}
