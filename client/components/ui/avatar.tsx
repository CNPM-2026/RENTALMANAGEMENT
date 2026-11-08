import { getBaseOriginUrl } from "@/lib/api";

const DEFAULT_AVATAR = "/images/default-avatar.svg";

function resolveAvatarUrl(url?: string | null) {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("/uploads/")) return `${getBaseOriginUrl()}${url}`;
  return url;
}

export function Avatar({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={resolveAvatarUrl(src)}
      alt={alt}
      className={className}
      onError={(event) => {
        if (event.currentTarget.src.endsWith(DEFAULT_AVATAR)) return;
        event.currentTarget.src = DEFAULT_AVATAR;
      }}
    />
  );
}
