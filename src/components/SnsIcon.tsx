export type SnsPlatform = "twitter" | "instagram" | "youtube" | "website";

const PATHS: Record<SnsPlatform, JSX.Element> = {
  twitter: (
    <path d="M18.9 2.5h3.3l-7.2 8.3L23.4 21.5h-6.6l-5.2-6.8-6 6.8H2.3l7.7-8.8L2 2.5h6.8l4.7 6.2 5.4-6.2Zm-1.1 17h1.8L7.3 4.4H5.4l12.4 15.1Z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.1" />
    </>
  ),
  youtube: (
    <path d="M23 12s0-3.4-.4-5a3 3 0 0 0-2.1-2.1C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.5.4A3 3 0 0 0 1.4 7C1 8.6 1 12 1 12s0 3.4.4 5a3 3 0 0 0 2.1 2.1c1.6.4 8.5.4 8.5.4s6.9 0 8.5-.4A3 3 0 0 0 22.6 17c.4-1.6.4-5 .4-5ZM9.8 15.5v-7l6 3.5-6 3.5Z" />
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </>
  ),
};

export default function SnsIcon({
  platform,
  className,
}: {
  platform: SnsPlatform;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {PATHS[platform]}
    </svg>
  );
}
