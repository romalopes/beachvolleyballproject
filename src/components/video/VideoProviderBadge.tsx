/** Tiny provider tag ("YouTube", "Instagram", …) used on video cards. */
export default function VideoProviderBadge({ label }: { label: string }) {
  return <span className="video-provider-badge">{label}</span>;
}
