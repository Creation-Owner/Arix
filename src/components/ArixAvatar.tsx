import { useState } from 'react';

interface ArixAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ArixAvatar({ size = 'md', className = '' }: ArixAvatarProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-7 h-7 text-xs'
      : size === 'lg'
        ? 'w-12 h-12 text-base'
        : 'w-9 h-9 text-sm';

  if (failed) {
    return (
      <div
        className={`${dims} rounded-full bg-sky-500/20 text-sky-300 font-display font-semibold flex items-center justify-center shrink-0 border border-sky-400/30 ${className}`}
        aria-label="Arix AI"
      >
        A
      </div>
    );
  }

  return (
    <img
      src="/assets/aistudio/image_0c849c56.png"
      alt="Arix AI"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} rounded-full object-cover object-[45%_50%] shrink-0 border border-sky-400/30 bg-[#07142B] ${className}`}
    />
  );
}
