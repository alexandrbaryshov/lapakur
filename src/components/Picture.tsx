import type { CSSProperties } from "react";
import { getImage, type MediaKey } from "../media";

export type PictureProps = {
  media: MediaKey;
  /**
   * `sizes` по реальной ширине вёрстки. Телефону (DPR до 3) должно доставаться не шире 800w —
   * бюджет считает «мобильной» картинку ≤ 800 px (interfaces.md, «Для таска 03»).
   */
  sizes: string;
  alt: string;
  /** Картинка первого экрана: eager + fetchpriority high. Иначе lazy + decoding async. */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
};

const firstUrl = (srcset: string) => srcset.split(",")[0].trim().split(/\s+/)[0];

/** `<picture>` из манифеста медиа: AVIF → WebP → JPEG/PNG, с размытым превью под непрозрачными кадрами. */
export function Picture({ media, sizes, alt, priority = false, className, imgClassName }: PictureProps) {
  const asset = getImage(media);
  const style: CSSProperties | undefined = asset.alpha
    ? undefined
    : asset.placeholder.startsWith("#")
      ? { backgroundColor: asset.placeholder }
      : { backgroundImage: `url("${asset.placeholder}")`, backgroundSize: "cover" };

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={asset.avif} sizes={sizes} />
      <source type="image/webp" srcSet={asset.webp} sizes={sizes} />
      <img
        src={firstUrl(asset.fallback)}
        srcSet={asset.fallback}
        sizes={sizes}
        width={asset.width}
        height={asset.height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "auto" : "async"}
        fetchPriority={priority ? "high" : undefined}
        className={imgClassName}
        style={style}
      />
    </picture>
  );
}
