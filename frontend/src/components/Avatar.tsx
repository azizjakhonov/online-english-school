import { memo, useState } from 'react';

interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

/**
 * Displays a user avatar.
 * - If `url` is provided and loads successfully → shows the image.
 * - On broken URL or missing `url` → falls back to a letter circle using `name`.
 */
const Avatar = memo(function Avatar({
  url,
  name,
  size = 40,
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = Boolean(url) && !imgError;
  const initial = (name?.[0] ?? '?').toUpperCase();

  return (
    <div
      className={`rounded-full overflow-hidden bg-blue-100 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={url!}
          alt={name ?? 'avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="font-bold text-blue-600 select-none"
          style={{ fontSize: Math.max(size * 0.38, 10) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
});

export default Avatar;
