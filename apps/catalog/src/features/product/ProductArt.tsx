import type { ArtKind } from '../../lib/art';

interface Props {
  kind: ArtKind;
  hex: string;
  label: string;
}

/** Ilustración de respaldo (misma que Placeholder.astro) para la galería de la isla. */
export function ProductArt({ kind, hex, label }: Props) {
  return (
    <svg viewBox="0 0 400 500" width="100%" height="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      <rect width="400" height="500" fill={kind === 'gems' ? '#F1ECE3' : '#EEE8DF'} />
      {kind === 'bottle' && (
        <>
          <ellipse cx="200" cy="420" rx="100" ry="12" fill="#25344F" opacity="0.08" />
          <rect x="150" y="72" width="100" height="70" rx="10" fill="#25344F" />
          <rect x="178" y="140" width="44" height="34" fill="#DDD7CE" />
          <rect x="128" y="170" width="144" height="250" rx="26" fill="#FFFFFF" opacity="0.6" />
          <rect x="140" y="182" width="120" height="226" rx="18" fill={hex} />
          <rect x="160" y="270" width="80" height="62" rx="4" fill="#F8F4EF" opacity="0.92" />
        </>
      )}
      {kind === 'lip' && (
        <>
          <rect x="165" y="236" width="70" height="170" rx="6" fill="#25344F" />
          <rect x="171" y="200" width="58" height="40" fill="#D9C7A6" />
          <path d="M178 200 L178 128 L222 104 L222 200 Z" fill={hex} />
        </>
      )}
      {kind === 'kit' && (
        <>
          <rect x="70" y="170" width="200" height="140" rx="14" fill="#25344F" />
          <circle cx="115" cy="215" r="20" fill="#C9A66B" />
          <circle cx="170" cy="215" r="20" fill="#8E5A5F" />
          <circle cx="225" cy="215" r="20" fill="#5C3A3F" />
          <circle cx="115" cy="268" r="20" fill="#E8C3B9" />
          <circle cx="170" cy="268" r="20" fill="#B5677A" />
          <circle cx="225" cy="268" r="20" fill="#3A2B2E" />
          <rect x="290" y="190" width="34" height="150" rx="5" fill="#25344F" />
          <rect x="294" y="160" width="26" height="34" fill="#9E3E52" />
        </>
      )}
      {kind === 'compact' && (
        <>
          <ellipse cx="200" cy="370" rx="120" ry="10" fill="#25344F" opacity="0.07" />
          <circle cx="200" cy="250" r="120" fill="#25344F" />
          <circle cx="200" cy="250" r="98" fill={hex} />
          <circle cx="170" cy="220" r="26" fill="#FFFFFF" opacity="0.18" />
        </>
      )}
      {kind === 'garment' && (
        <>
          <path d="M150 90 L180 90 C186 122 214 122 220 90 L250 90 L264 240 C264 310 248 350 234 400 L166 400 C152 350 136 310 136 240 Z" fill={hex} />
          <path d="M180 90 C186 122 214 122 220 90" stroke="#D3A5AA" strokeWidth="3" fill="none" />
        </>
      )}
      {kind === 'gems' && (
        <>
          <circle cx="140" cy="180" r="10" fill="#C9A66B" />
          <circle cx="200" cy="150" r="6" fill="#C9A66B" />
          <circle cx="250" cy="200" r="14" fill="#C9A66B" />
          <circle cx="170" cy="250" r="5" fill="#FFFFFF" />
          <circle cx="230" cy="280" r="8" fill="#C9A66B" />
          <path d="M200 330 l12 20 -12 20 -12 -20z" fill="#C9A66B" />
        </>
      )}
    </svg>
  );
}
