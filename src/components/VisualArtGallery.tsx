import React, { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { SALON_STUDIO_GALLERY, SalonGalleryShowcaseItem } from '../data/initialSalonData';
import { BusinessProfile, ServicePlate } from '../types/salon';
import { formatShortLocationLabel } from '../utils/salonPricingAndValidation';

const buildFallbackSvgDataUri = (
  themeVariant: ServicePlate['themeVariant'] | 'hero_interior',
  angleIndex: number,
  title: string,
  subtitle: string
): string => {
  const palettes: Record<
    string,
    { bg1: string; bg2: string; stone: string; accent: string; brass: string; ink: string }
  > = {
    hero_interior: {
      bg1: '#F6F0E6',
      bg2: '#E6DAC8',
      stone: '#EFE7DA',
      accent: '#9A7950',
      brass: '#B8894A',
      ink: '#292720',
    },
    scissors: {
      bg1: '#F7F2E9',
      bg2: '#E8DEC9',
      stone: '#EFE8DC',
      accent: '#7C4D32',
      brass: '#9A7950',
      ink: '#292720',
    },
    beard: {
      bg1: '#F3ECE1',
      bg2: '#E1D2BC',
      stone: '#EAE0D1',
      accent: '#6E4228',
      brass: '#9A7950',
      ink: '#292720',
    },
    champi: {
      bg1: '#F8F3E8',
      bg2: '#E7DAC2',
      stone: '#F1E9D8',
      accent: '#8E6234',
      brass: '#9A7950',
      ink: '#292720',
    },
    neck_massage: {
      bg1: '#F4EFE6',
      bg2: '#DFD4C3',
      stone: '#ECE5D8',
      accent: '#5E4B3C',
      brass: '#9A7950',
      ink: '#292720',
    },
    keratin: {
      bg1: '#FAF5EC',
      bg2: '#E9DFCF',
      stone: '#F3ECE0',
      accent: '#8C5A3C',
      brass: '#9A7950',
      ink: '#292720',
    },
    facial: {
      bg1: '#F9F3EB',
      bg2: '#E8D8C8',
      stone: '#F2E7DC',
      accent: '#9A5B42',
      brass: '#9A7950',
      ink: '#292720',
    },
    groom: {
      bg1: '#F5EFE4',
      bg2: '#DFD0B8',
      stone: '#EAE0CE',
      accent: '#784B2A',
      brass: '#9A7950',
      ink: '#292720',
    },
    trim: {
      bg1: '#F7F3EB',
      bg2: '#E5DDD0',
      stone: '#EFEAE0',
      accent: '#6B5340',
      brass: '#9A7950',
      ink: '#292720',
    },
  };

  const p = palettes[themeVariant] || palettes.hero_interior;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.bg1}"/>
        <stop offset="100%" stop-color="${p.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bgGrad)"/>
    <rect x="28" y="28" width="744" height="444" rx="4" fill="none" stroke="${p.ink}" stroke-opacity="0.1" stroke-width="1"/>
    <circle cx="400" cy="220" r="110" fill="${p.stone}" stroke="${p.brass}" stroke-width="2"/>
    <text x="56" y="432" font-family="Georgia, serif" font-size="22" font-weight="500" fill="${p.ink}">${title.replace(/&/g, '&amp;')}</text>
    <text x="56" y="454" font-family="sans-serif" font-size="13" fill="#79756C">${subtitle.replace(/&/g, '&amp;')}</text>
    <text x="744" y="448" text-anchor="end" font-family="monospace" font-size="12" fill="${p.accent}">OPS SALON · HYDERABAD</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

interface HeroShowcaseProps {
  businessProfile?: BusinessProfile;
  onBookNow?: () => void;
  onExplorePackages?: () => void;
}

export const HeroSalonArtwork: React.FC<HeroShowcaseProps> = ({ businessProfile }) => {
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [fallbackActive, setFallbackActive] = useState<boolean>(false);

  const locationLabel = businessProfile
    ? formatShortLocationLabel(businessProfile)
    : 'Hyderabad, Telangana';

  const slides = SALON_STUDIO_GALLERY.map((item, index) => ({
    code: `OPS / 00${index + 1}`,
    title: index === 0 ? 'Your time. Your style.' : item.title,
    subtitle:
      index === 0
        ? `${item.subtitle} · ${locationLabel}`
        : item.subtitle,
    imageUrl: item.imageUrl,
    variant: 'hero_interior' as const,
  }));

  const current = slides[activeSlide] || slides[0];
  const resolvedSrc = fallbackActive
    ? buildFallbackSvgDataUri(current.variant, activeSlide, current.title, current.subtitle)
    : current.imageUrl;

  return (
    <div className="relative min-w-0 w-full">
      <div className="relative h-[360px] sm:h-[460px] lg:h-[520px] w-full overflow-hidden rounded-[3px] border border-[#E7DED1] bg-white p-3 flex items-center justify-center">
        <img
          key={`hero-slide-${activeSlide}-${resolvedSrc}`}
          src={resolvedSrc}
          alt={`${businessProfile?.salonName || 'OPS Salon'} — ${current.title}`}
          referrerPolicy="no-referrer"
          onError={() => setFallbackActive(true)}
          className="w-full h-full object-contain object-center"
        />

        {/* Floating Editorial Caption */}
        <div className="absolute bottom-4 left-4 right-4 bg-[#FAF7F2]/95 backdrop-blur-xs border border-[#E7DED1] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <strong className="block font-serif-display text-lg font-medium text-[#292720] leading-snug">
              {current.title}
            </strong>
            <span className="block text-xs text-[#79756C]">{current.subtitle}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {slides.map((s, idx) => (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setFallbackActive(false);
                  setActiveSlide(idx);
                }}
                aria-label={`Show salon gallery plate ${idx + 1}`}
                className={`px-2 py-1 text-[11px] font-mono-tabular border transition-colors cursor-pointer ${
                  activeSlide === idx
                    ? 'bg-[#292720] text-white border-[#292720]'
                    : 'bg-white text-[#79756C] border-[#E7DED1] hover:border-[#9A7950]'
                }`}
              >
                0{idx + 1}
              </button>
            ))}
            <span className="hidden sm:inline text-[11px] font-mono-tabular text-[#79756C] pl-1">
              {current.code}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SalonStudioInteriorGalleryProps {
  onBookStudioVisit?: () => void;
}

export const SalonStudioInteriorGallery: React.FC<SalonStudioInteriorGalleryProps> = ({
  onBookStudioVisit,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxItem, setLightboxItem] = useState<SalonGalleryShowcaseItem | null>(null);

  const categories = [
    'All',
    'Architecture & Suites',
    'Grooming Stations',
    'Relaxation & Lounge',
  ];

  const filteredItems =
    selectedCategory === 'All'
      ? SALON_STUDIO_GALLERY
      : SALON_STUDIO_GALLERY.filter((item) => item.category === selectedCategory);

  return (
    <section className="py-16 sm:py-24 border-t border-[#E7DED1] bg-[#FAF7F2]">
      <div className="ops-container space-y-9">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[650px]">
            <div className="ops-eyebrow">Inside OPS Salon · Studio Gallery</div>
            <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2.5 mb-3">
              Architectural spaces built for unhurried craft.
            </h2>
            <p className="text-[#79756C] text-sm sm:text-base m-0">
              Explore our walnut grooming hall, arched brass mirror suites, royal gold-mirror
              suite, and private relaxation stations — scaled cleanly with zero cropping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#292720] text-white border-[#292720]'
                    : 'bg-white text-[#79756C] border-[#E7DED1] hover:border-[#9A7950] hover:text-[#292720]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              onClick={() => setLightboxItem(item)}
              className="group ops-card overflow-hidden cursor-pointer flex flex-col justify-between transition-all duration-300 hover:shadow-[0_14px_32px_rgba(41,39,32,0.08)]"
            >
              <div className="relative h-[250px] w-full overflow-hidden bg-white p-2.5 border-b border-[#E7DED1] flex items-center justify-center">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain object-center"
                />
                <div className="absolute top-3 left-3 bg-[#FAF7F2]/95 border border-[#E7DED1] px-2.5 py-1 text-[10px] font-mono-tabular font-semibold text-[#292720]">
                  {item.code}
                </div>
                <div className="absolute bottom-3 right-3 bg-[#292720]/85 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9A7950]">
                    {item.category}
                  </span>
                  <h3 className="font-serif-display text-xl text-[#292720] mt-1.5 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#79756C] leading-relaxed m-0">{item.subtitle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {onBookStudioVisit && (
          <div className="pt-2 flex justify-end">
            <button type="button" onClick={onBookStudioVisit} className="ops-btn text-xs">
              <span>Book a Flagship Studio Session</span>
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-[#292720]/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="bg-[#FAF7F2] border border-[#E7DED1] max-w-4xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-[320px] sm:h-[480px] w-full bg-white p-4 border-b border-[#E7DED1] flex items-center justify-center">
              <img
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain object-center"
              />
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="Close studio gallery preview"
                className="absolute top-4 right-4 bg-[#FAF7F2] text-[#292720] border border-[#E7DED1] p-2 hover:bg-[#292720] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono-tabular uppercase tracking-[1.6px] text-[#9A7950] font-bold">
                  {lightboxItem.code} · {lightboxItem.category}
                </span>
                <h3 className="font-serif-display text-2xl text-[#292720] mt-1">
                  {lightboxItem.title}
                </h3>
                <p className="text-xs text-[#79756C] mt-1 m-0">{lightboxItem.subtitle}</p>
              </div>
              {onBookStudioVisit && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxItem(null);
                    onBookStudioVisit();
                  }}
                  className="ops-btn text-xs"
                >
                  <span>Reserve This Experience</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

interface ServiceMultiImageCardProps {
  plates: [ServicePlate, ServicePlate, ServicePlate];
  serviceName: string;
}

export const ServiceMultiImageGallery: React.FC<ServiceMultiImageCardProps> = ({
  plates,
  serviceName,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const currentPlate = plates[selectedIdx] || plates[0];
  const fallbackSrc = buildFallbackSvgDataUri(
    currentPlate.themeVariant,
    currentPlate.angleIndex,
    currentPlate.label,
    currentPlate.caption
  );

  const imgSrc =
    currentPlate.imageUrl && !failedUrls[`${currentPlate.id}:${currentPlate.imageUrl}`]
      ? currentPlate.imageUrl
      : fallbackSrc;

  return (
    <div className="relative bg-white border-b border-[#E7DED1]">
      <div className="relative h-[230px] sm:h-[245px] w-full overflow-hidden bg-white p-2.5 flex items-center justify-center">
        <img
          key={`${serviceName}-plate-${selectedIdx}-${currentPlate.id}-${imgSrc}`}
          src={imgSrc}
          alt={`${serviceName} — ${currentPlate.label}: ${currentPlate.caption}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() =>
            setFailedUrls((prev) => ({
              ...prev,
              [`${currentPlate.id}:${currentPlate.imageUrl}`]: true,
            }))
          }
          className="w-full h-full object-contain object-center"
        />

        {/* Top-left Plate Counter Badge */}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#FAF7F2]/95 border border-[#E7DED1] text-[10px] font-mono-tabular font-semibold text-[#292720]">
          PLATE 0{selectedIdx + 1} / 03
        </div>
      </div>

      {/* Multi-Image Switcher Bar with 01, 02, 03 buttons */}
      <div className="px-3.5 py-2 bg-[#FAF7F2] border-t border-[#E7DED1] flex items-center justify-between gap-2 min-w-0">
        <span
          className="text-[11px] text-[#292720] font-medium min-w-0 truncate"
          title={currentPlate.caption}
        >
          {currentPlate.label}
        </span>
        <div
          className="flex items-center gap-1 shrink-0"
          role="group"
          aria-label="Service image plates"
        >
          {plates.map((plate, index) => (
            <button
              key={plate.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIdx(index);
              }}
              aria-label={`View ${serviceName} image ${index + 1}: ${plate.label}`}
              className={`px-2.5 py-1 text-[11px] font-mono-tabular border transition-colors cursor-pointer ${
                selectedIdx === index
                  ? 'bg-[#292720] text-white border-[#292720] font-semibold'
                  : 'bg-white text-[#79756C] border-[#E7DED1] hover:border-[#9A7950] hover:text-[#292720]'
              }`}
              title={`${plate.label} — ${plate.caption}`}
            >
              0{index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
