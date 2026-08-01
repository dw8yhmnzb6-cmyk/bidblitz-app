import { useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildBidBlitzImageMeta } from '../../design/tokens';

export const ProductImageGallery = ({
  title,
  images = [],
  productCategory = 'general',
  productSubcategory = 'general',
  imageCategory = '',
  imageSource = 'catalog',
  imageVerified = true,
  aspectClassName = 'aspect-[16/10]',
  className,
  testId = 'product-image-gallery',
}) => {
  const gallery = useMemo(() => Array.from(new Set((images || []).filter(Boolean))).slice(0, 8), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState({});
  const meta = buildBidBlitzImageMeta({ title, productCategory, productSubcategory, imageCategory, imageSource, imageVerified });
  const visibleThumbs = gallery.slice(0, 4);
  const activeImage = gallery[activeIndex] || '';

  return (
    <div
      data-testid={testId}
      data-product-category={meta.product_category}
      data-product-subcategory={meta.product_subcategory}
      data-image-category={meta.image_category}
      data-image-source={meta.image_source}
      data-image-verified={meta.image_verified ? 'true' : 'false'}
      className={cn('space-y-3', className)}
    >
      <div className={cn('relative overflow-hidden rounded-[24px] border border-white/10 bg-[#07101D]', aspectClassName)}>
        {activeImage && !failed[activeImage] ? (
          <img
            src={activeImage}
            alt={title}
            loading="lazy"
            className="h-full w-full object-contain"
            onError={() => setFailed((prev) => ({ ...prev, [activeImage]: true }))}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/60">
            <ImageOff size={28} />
            <span className="text-sm font-semibold">Bild wird geladen</span>
          </div>
        )}
      </div>
      {visibleThumbs.length > 1 ? (
        <div className="grid grid-cols-4 gap-3" data-testid={`${testId}-thumbs`}>
          {visibleThumbs.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              data-testid={`${testId}-thumb-${index}`}
              className={cn(
                'relative aspect-square overflow-hidden rounded-[18px] border bg-[#07101D] transition-all',
                index === activeIndex ? 'border-[var(--bb-accent-cyan)] shadow-[var(--bb-shadow-glow)]' : 'border-white/10',
              )}
            >
              <img src={image} alt={`${title} ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
              {index === 3 && gallery.length > 4 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-black text-white">
                  +{gallery.length - 4}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};