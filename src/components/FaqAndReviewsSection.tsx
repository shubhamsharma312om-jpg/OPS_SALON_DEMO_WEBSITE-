import React, { useMemo, useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  HelpCircle,
  MessageSquarePlus,
  Search,
  ShieldCheck,
  Star,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { BusinessProfile, Employee, ServiceItem } from '../types/salon';
import { HYDERABAD_AREAS } from '../data/initialSalonData';

export interface ClientReview {
  id: string;
  clientName: string;
  locality: string;
  category:
    | 'Haircut & Styling'
    | 'Beard & Shave'
    | 'Custom Packages'
    | 'Spa & Massage'
    | 'Group & Home Visits';
  serviceSummary: string;
  stylistName: string;
  rating: number;
  visitDate: string;
  bookingRef?: string;
  comment: string;
  serviceMode: 'Flagship Studio' | 'Home Concierge';
}

const REVIEWS_STORAGE_KEY = 'ops_salon_hyd_reviews_v1';

const INITIAL_HYDERABAD_REVIEWS: ClientReview[] = [
  {
    id: 'rev-1',
    clientName: 'Vikramaditya Reddy',
    locality: 'Jubilee Hills',
    category: 'Custom Packages',
    serviceSummary: 'Executive Haircut + Royal Hot-Towel Beard Sculpt + Bhringraj Champi',
    stylistName: 'Aarav Kulkarni',
    rating: 5,
    visitDate: 'October 2026',
    bookingRef: 'NZM-8412',
    serviceMode: 'Flagship Studio',
    comment:
      'Combined three services in the Custom Package Builder and got the automatic 10% bundle discount right away. Aarav spent a full 115 minutes on the cut, zero-gap fade, and warm herbal head massage without rushing a single step. Easily the most refined grooming studio in Hyderabad.',
  },
  {
    id: 'rev-2',
    clientName: 'Rohan & Siddharth N.',
    locality: 'Banjara Hills',
    category: 'Group & Home Visits',
    serviceSummary: 'Multi-Member Booking (3 Guests) · Groom & Groomsmen Ritual',
    stylistName: 'Zainab Mirza & Kabir Singhania',
    rating: 5,
    visitDate: 'October 2026',
    bookingRef: 'NZM-8390',
    serviceMode: 'Home Concierge',
    comment:
      'Booked a 3-member home visit in Banjara Hills Road No. 12 ahead of a family wedding reception. Having individual stylist schedules locked in prevented any overlap, and we settled the entire invoice seamlessly via UPI QR once the session wrapped up.',
  },
  {
    id: 'rev-3',
    clientName: 'Pranav Chintalapudi',
    locality: 'HITEC City',
    category: 'Haircut & Styling',
    serviceSummary: 'Architectural Crop & Precision Taper Fade',
    stylistName: 'Aarav Kulkarni',
    rating: 5,
    visitDate: 'October 2026',
    bookingRef: 'NZM-8354',
    serviceMode: 'Flagship Studio',
    comment:
      'What stands out at OPS Salon is the real-time slot discipline. My 4:00 PM slot started on the dot, the 45-minute duration estimate was exact, and the shear-over-comb work holds its shape weeks later.',
  },
  {
    id: 'rev-4',
    clientName: 'Meera & Devansh Rao',
    locality: 'Gachibowli',
    category: 'Spa & Massage',
    serviceSummary: 'Kashmiri Saffron D-Tan Facial + Moroccan Argan Keratin Spa',
    stylistName: 'Ananya Deshmukh',
    rating: 5,
    visitDate: 'September 2026',
    bookingRef: 'NZM-8298',
    serviceMode: 'Flagship Studio',
    comment:
      'Ananya explained every step of the 60-minute Keratin Spa and Saffron Facial before starting. Zero pushy upselling, calm architectural interiors, and transparent GST-inclusive pricing in INR.',
  },
  {
    id: 'rev-5',
    clientName: 'Farhan Qureshi',
    locality: 'Kokapet',
    category: 'Beard & Shave',
    serviceSummary: 'Royal Straight-Razor Beard Sculpt & Cold Jade Compress',
    stylistName: 'Kabir Singhania',
    rating: 5,
    visitDate: 'September 2026',
    bookingRef: 'NZM-8241',
    serviceMode: 'Flagship Studio',
    comment:
      'Kabir’s geometry on the beard line and eucalyptus steam towel ritual is unmatched in West Hyderabad. Being able to inspect all three gallery plates before booking gave me complete clarity on the style.',
  },
  {
    id: 'rev-6',
    clientName: 'Karthikeya Varma',
    locality: 'Madhapur',
    category: 'Custom Packages',
    serviceSummary: 'Skin Fade + Charcoal Peel Ritual + Deep Tissue Neck & Shoulder Relief',
    stylistName: 'Rohan Varma',
    rating: 4.9,
    visitDate: 'September 2026',
    bookingRef: 'NZM-8195',
    serviceMode: 'Flagship Studio',
    comment:
      'After long workdays in Madhapur, the 30-minute neck and shoulder relief paired with a fresh taper fade and charcoal detox is my go-to monthly reset. Paid via PhonePe at the studio desk in seconds.',
  },
];

export type FaqCategory =
  | 'ALL'
  | 'Salon Policies'
  | 'Service Durations'
  | 'Payment Methods';

export interface FaqItem {
  id: string;
  code: string;
  category: Exclude<FaqCategory, 'ALL'>;
  question: string;
  answer: string;
  highlights: string[];
}

interface FaqAndReviewsProps {
  salonName: string;
  shortLocation: string;
  services: ServiceItem[];
  employees: Employee[];
  businessProfile: BusinessProfile;
  onNavigateToBook: () => void;
  onNavigateToServices: () => void;
  onNavigateToContact?: () => void;
}

export const ClientReviewsSection: React.FC<{
  salonName: string;
  shortLocation: string;
  services: ServiceItem[];
  employees: Employee[];
  onNavigateToBook: () => void;
}> = ({ salonName, shortLocation, services, employees, onNavigateToBook }) => {
  const [reviews, setReviews] = useState<ClientReview[]>(() => {
    try {
      const saved = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_HYDERABAD_REVIEWS;
  });

  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | ClientReview['category']
  >('ALL');
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Review form state
  const [clientName, setClientName] = useState('');
  const [locality, setLocality] = useState(HYDERABAD_AREAS[0]?.name || 'Jubilee Hills');
  const [category, setCategory] = useState<ClientReview['category']>('Custom Packages');
  const [serviceSummary, setServiceSummary] = useState('');
  const [stylistName, setStylistName] = useState(
    employees[0]?.name || 'Aarav Kulkarni'
  );
  const [rating, setRating] = useState<number>(5);
  const [serviceMode, setServiceMode] = useState<ClientReview['serviceMode']>(
    'Flagship Studio'
  );
  const [bookingRef, setBookingRef] = useState('');
  const [comment, setComment] = useState('');
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
    } catch {
      // ignore storage quota errors
    }
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (selectedCategory === 'ALL') return reviews;
    return reviews.filter((r) => r.category === selectedCategory);
  }, [reviews, selectedCategory]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !comment.trim()) return;

    const now = new Date();
    const monthYear = now.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });

    const newReview: ClientReview = {
      id: `rev-custom-${Date.now()}`,
      clientName: clientName.trim(),
      locality,
      category,
      serviceSummary:
        serviceSummary.trim() ||
        services[0]?.name ||
        'Bespoke Grooming & Styling Session',
      stylistName,
      rating,
      visitDate: monthYear,
      bookingRef: bookingRef.trim() ? bookingRef.trim().toUpperCase() : undefined,
      serviceMode,
      comment: comment.trim(),
    };

    setReviews((prev) => [newReview, ...prev]);
    setClientName('');
    setServiceSummary('');
    setBookingRef('');
    setComment('');
    setRating(5);
    setSubmittedNotice(
      `Thank you, ${newReview.clientName}. Your review for ${salonName} (${newReview.locality}) has been published.`
    );
    setShowReviewForm(false);
  };

  return (
    <section
      id="client-reviews"
      className="py-14 sm:py-20 bg-[#F3EDE2]/70 border-t border-[#E7DED1]"
    >
      <div className="ops-container space-y-10">
        {/* Section Header + Aggregate Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="ops-eyebrow">
              Client Voices · Verified Experiences Across {shortLocation}
            </div>
            <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2 mb-3">
              Trusted by discerning patrons across Hyderabad.
            </h2>
            <p className="text-[#79756C] text-sm sm:text-base m-0">
              Read verified feedback from studio appointments in Jubilee Hills and on-location
              grooming sessions across Banjara Hills, HITEC City, Gachibowli, and Kokapet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowReviewForm((v) => !v);
                setSubmittedNotice(null);
              }}
              className="ops-btn-outline text-xs py-2.5 px-4 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4 shrink-0" />
              <span>{showReviewForm ? 'Close Review Form' : 'Write a Review'}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToBook}
              className="ops-btn text-xs py-2.5 px-4 cursor-pointer"
            >
              <span>Book Your Session</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Architectural Rating Summary Bar */}
        <div className="ops-card p-6 bg-[#FAF7F2] grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="pr-4 border-r border-[#E7DED1]">
            <div className="flex items-baseline gap-2">
              <strong className="font-serif-display text-3xl text-[#292720] font-medium">
                {averageRating}
              </strong>
              <span className="text-xs font-mono-tabular text-[#9A7950]">
                ★ ★ ★ ★ ★
              </span>
            </div>
            <p className="text-xs text-[#79756C] mt-1 m-0">
              Average rating across {reviews.length} featured Hyderabad reviews
            </p>
          </div>

          <div className="pr-4 lg:border-r border-[#E7DED1]">
            <strong className="block font-serif-display text-3xl text-[#292720] font-medium">
              99.4%
            </strong>
            <p className="text-xs text-[#79756C] mt-1 m-0">
              On-time appointment starts with zero double-booking
            </p>
          </div>

          <div className="pr-4 border-r border-[#E7DED1]">
            <strong className="block font-serif-display text-3xl text-[#292720] font-medium">
              14 Zones
            </strong>
            <p className="text-xs text-[#79756C] mt-1 m-0">
              Jubilee Hills studio & home concierge across Hyderabad
            </p>
          </div>

          <div>
            <strong className="block font-serif-display text-3xl text-[#292720] font-medium">
              100%
            </strong>
            <p className="text-xs text-[#79756C] mt-1 m-0">
              Transparent INR (₹) pricing · UPI, Cards & NetBanking accepted
            </p>
          </div>
        </div>

        {submittedNotice && (
          <div className="p-4 bg-[#EDF1E8] border border-[#4C6545]/30 text-xs text-[#4C6545] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{submittedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmittedNotice(null)}
              className="text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Interactive Write-a-Review Drawer */}
        {showReviewForm && (
          <form
            onSubmit={handleReviewSubmit}
            className="ops-card p-6 sm:p-7 bg-[#FAF7F2] border border-[#9A7950] space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED1] pb-4">
              <div>
                <div className="ops-eyebrow">Share Your Patron Experience</div>
                <h3 className="font-serif-display text-2xl text-[#292720] mt-1">
                  Submit a Client Review for {salonName}
                </h3>
              </div>
              <span className="text-xs text-[#79756C]">
                Published immediately to the Hyderabad patron review board
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Aditya Rao"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Hyderabad Locality *
                </label>
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                >
                  {HYDERABAD_AREAS.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Service Category *
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ClientReview['category'])
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                >
                  <option value="Custom Packages">Custom Packages (3+ Services)</option>
                  <option value="Haircut & Styling">Haircut & Styling</option>
                  <option value="Beard & Shave">Beard & Shave</option>
                  <option value="Spa & Massage">Spa & Massage</option>
                  <option value="Group & Home Visits">Group & Home Visits</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Stylist Who Served You
                </label>
                <select
                  value={stylistName}
                  onChange={(e) => setStylistName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Services or Package Booked
                </label>
                <input
                  type="text"
                  value={serviceSummary}
                  onChange={(e) => setServiceSummary(e.target.value)}
                  placeholder="e.g. Executive Cut + Beard Sculpt + Champi"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Appointment Mode & Booking Ref (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={serviceMode}
                    onChange={(e) =>
                      setServiceMode(e.target.value as ClientReview['serviceMode'])
                    }
                    className="w-full px-2.5 py-2 text-xs bg-white border border-[#E7DED1]"
                  >
                    <option value="Flagship Studio">Flagship Studio</option>
                    <option value="Home Concierge">Home Concierge</option>
                  </select>
                  <input
                    type="text"
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    placeholder="Ref e.g. NZM-8401"
                    className="w-full px-2.5 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setRating(starValue)}
                      className={`px-3 py-1.5 text-xs font-mono-tabular border transition-colors cursor-pointer ${
                        rating >= starValue
                          ? 'bg-[#292720] text-[#D0B48B] border-[#292720]'
                          : 'bg-white text-[#79756C] border-[#E7DED1]'
                      }`}
                    >
                      {starValue} ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292720] mb-1">
                Your Review & Experience *
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts on the haircut precision, service duration, hygiene, or custom package value..."
                className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="ops-btn-outline text-xs py-2 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button type="submit" className="ops-btn text-xs py-2 px-5 cursor-pointer">
                <span>Publish Client Review</span>
              </button>
            </div>
          </form>
        )}

        {/* Interactive Category Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FAF7F2] border border-[#E7DED1]">
            {(
              [
                'ALL',
                'Custom Packages',
                'Haircut & Styling',
                'Beard & Shave',
                'Spa & Massage',
                'Group & Home Visits',
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#292720] text-white'
                    : 'text-[#79756C] hover:text-[#292720]'
                }`}
              >
                {cat === 'ALL' ? `All Reviews (${reviews.length})` : cat}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#79756C]">
            Showing {filteredReviews.length} of {reviews.length} patron reviews
          </div>
        </div>

        {/* Reviews Grid (Zero-Pill Clean Typographic Metadata) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.map((rev) => (
            <article
              key={rev.id}
              className="ops-card p-6 bg-[#FAF7F2] flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                {/* Unboxed metadata kicker */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#79756C]">
                  <span className="font-semibold uppercase tracking-[1.4px] text-[#9A7950]">
                    {rev.category} · {rev.serviceMode}
                  </span>
                  <span className="font-mono-tabular text-[#292720] font-semibold">
                    {'★'.repeat(Math.round(rev.rating))} {rev.rating.toFixed(1)}
                  </span>
                </div>

                <h3 className="font-serif-display text-xl text-[#292720] leading-snug">
                  {rev.serviceSummary}
                </h3>

                <p className="text-xs text-[#79756C] leading-relaxed m-0">
                  “{rev.comment}”
                </p>
              </div>

              <div className="pt-4 border-t border-[#E7DED1] space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[#292720]">{rev.clientName}</strong>
                  <span className="text-[#79756C] font-mono-tabular text-[11px]">
                    {rev.visitDate}
                  </span>
                </div>
                <div className="text-[11px] text-[#79756C] flex flex-wrap items-center gap-1.5">
                  <span>{rev.locality}, Hyderabad</span>
                  <span aria-hidden="true">·</span>
                  <span>Stylist: {rev.stylistName}</span>
                  {rev.bookingRef && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-[#9A7950]">
                        Ref {rev.bookingRef}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export const SalonFaqSection: React.FC<FaqAndReviewsProps> = ({
  salonName,
  shortLocation,
  services,
  businessProfile,
  onNavigateToBook,
  onNavigateToServices,
}) => {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([
    'faq-policy-1',
    'faq-duration-1',
    'faq-payment-1',
  ]);

  const minDuration = useMemo(
    () =>
      services.length > 0
        ? Math.min(...services.map((s) => s.durationMinutes))
        : 25,
    [services]
  );
  const maxDuration = useMemo(
    () =>
      services.length > 0
        ? Math.max(...services.map((s) => s.durationMinutes))
        : 75,
    [services]
  );

  const faqItems: FaqItem[] = useMemo(
    () => [
      // SALON POLICIES
      {
        id: 'faq-policy-1',
        code: '01',
        category: 'Salon Policies',
        question:
          'What is your cancellation, rescheduling, and arrival policy at OPS Salon?',
        answer: `${
          businessProfile.cancellationPolicy ||
          'Free cancellation or rescheduling is available up to 2 hours before your scheduled appointment slot.'
        } ${
          businessProfile.reschedulingPolicy ||
          'You may reschedule your slot online or via our WhatsApp concierge desk subject to stylist availability.'
        } We recommend arriving at our Jubilee Hills studio 5–10 minutes prior to your scheduled time so your consultation begins promptly.`,
        highlights: [
          'Free rescheduling up to 2 hours before appointment',
          '10-minute grace window for studio arrivals in Hyderabad traffic',
          'Instant slot updates via Booking Reference & Phone lookup',
        ],
      },
      {
        id: 'faq-policy-2',
        code: '02',
        category: 'Salon Policies',
        question:
          'How does OPS Salon prevent double-booking of stylists and time slots?',
        answer:
          'Every specialist on our roster maintains an individual shift calendar, weekly working days, break window, and real-time appointment ledger. The moment a patron reserves a stylist for a specific date and time slot, that slot is locked across both studio and home-concierge channels so no two customers can ever double-book the same specialist.',
        highlights: [
          'Real-time conflict detection per stylist, date, and time slot',
          'Automatic lockouts during stylist break hours and off-duty days',
          'Multi-member appointments can assign distinct stylists simultaneously',
        ],
      },
      {
        id: 'faq-policy-3',
        code: '03',
        category: 'Salon Policies',
        question:
          'Can I book an appointment for multiple family members or a wedding group (1 to 6 guests)?',
        answer:
          'Yes. Our booking system supports 1 to 6 members in a single reservation. You can record each member’s name, age, gender, individual services, and preferred stylist, and choose either our Flagship Studio in Jubilee Hills or Home / On-Location service across 14 Hyderabad localities (including Banjara Hills, HITEC City, Gachibowli, Kondapur, Madhapur, and Kokapet).',
        highlights: [
          '1 to 6 members supported per booking with individual stylist selection',
          'Available at Flagship Studio or Home / On-Location across Hyderabad',
          'Dedicated hygiene & disposable blade protocol for every guest',
        ],
      },

      // SERVICE DURATIONS
      {
        id: 'faq-duration-1',
        code: '04',
        category: 'Service Durations',
        question:
          'How long do individual salon services and custom packages take to complete?',
        answer: `Individual services at ${salonName} range from ${minDuration} minutes (such as Express Charcoal Detox or Neck & Shoulder Relief) to ${maxDuration} minutes (such as Moroccan Argan Keratin Hair Spa or Bridal/Groom Rituals). Signature architectural haircuts take 45 minutes and royal hot-towel beard sculpting takes 30 minutes. When you combine multiple services in the Custom Package Builder, our system automatically sums the exact total session duration before you confirm your slot.`,
        highlights: [
          `Single services: ${minDuration} mins to ${maxDuration} mins depending on ritual`,
          'Architectural Haircut: 45 mins · Hot-Towel Beard Sculpt: 30 mins',
          '3-service Custom Package typically spans 90 to 135 minutes',
        ],
      },
      {
        id: 'faq-duration-2',
        code: '05',
        category: 'Service Durations',
        question:
          'How does the automatic 10% Custom Package discount affect session duration and scheduling?',
        answer:
          'When you combine 3 or more eligible services in our Custom Package Builder (for example, Haircut + Beard Sculpt + Ayurvedic Bhringraj Head Massage), the system automatically applies a 10% bundle discount on the subtotal while preserving the full, unhurried duration of every included ritual. No steps are shortened or skipped on discounted packages.',
        highlights: [
          'Automatic 10% savings unlocked at 3+ combined services',
          'Full ritual steps and durations guaranteed with zero rush',
          'Live duration & INR price breakdown shown before booking',
        ],
      },
      {
        id: 'faq-duration-3',
        code: '06',
        category: 'Service Durations',
        question:
          'Does a Home / On-Location visit in Hyderabad take longer than a Studio appointment?',
        answer:
          'The treatment duration itself is identical to our Flagship Studio. For Home / On-Location appointments across Hyderabad, our specialists arrive 10–15 minutes early to set up portable sanitized tooling, capes, and lighting so your grooming ritual begins right on schedule. A nominal ₹350 home travel & kit logistics fee applies to on-location bookings.',
        highlights: [
          '10–15 minute advance setup by stylist at your Hyderabad address',
          'GPS coordinate & locality pin supported during checkout',
          'Flat ₹350 home concierge fee across all 14 Hyderabad zones',
        ],
      },

      // PAYMENT METHODS IN HYDERABAD
      {
        id: 'faq-payment-1',
        code: '07',
        category: 'Payment Methods',
        question:
          'What payment methods are accepted at OPS Salon in Hyderabad?',
        answer:
          'We accept all preferred digital and physical payment methods in Hyderabad: Instant UPI scan & pay (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and CRED UPI), all major Credit and Debit Cards (Visa, Mastercard, RuPay, and American Express), NetBanking/IMPS for wedding or corporate group packages, and Cash (INR ₹) at our Jubilee Hills studio desk.',
        highlights: [
          'UPI: Google Pay (GPay), PhonePe, Paytm, BHIM & CRED Scan-and-Pay',
          'Cards: Visa, Mastercard, RuPay & American Express (Tap / Chip & PIN)',
          'Cash (INR ₹) & NetBanking supported for both Studio and Home visits',
        ],
      },
      {
        id: 'faq-payment-2',
        code: '08',
        category: 'Payment Methods',
        question:
          'Do I need to pay an advance online to book, and are prices inclusive of GST?',
        answer:
          'No advance deposit is required for standard 1–3 member studio appointments — you can reserve your preferred stylist and time slot online and settle your bill after your grooming session is completed. All prices displayed on our Service Menu and Custom Package Builder are in Indian Rupees (₹) and inclusive of applicable taxes, with zero hidden charges.',
        highlights: [
          'Pay post-service at the studio desk or via stylist UPI QR on home visits',
          '100% transparent INR (₹) menu pricing inclusive of taxes',
          'Split payment across UPI and Card available for multi-member bookings',
        ],
      },
    ],
    [
      businessProfile.cancellationPolicy,
      businessProfile.reschedulingPolicy,
      maxDuration,
      minDuration,
      salonName,
    ]
  );

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqItems.filter((item) => {
      const matchesCat =
        activeCategory === 'ALL' || item.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.highlights.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [faqItems, activeCategory, searchQuery]);

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allFilteredOpen =
    filteredFaqs.length > 0 &&
    filteredFaqs.every((f) => openFaqIds.includes(f.id));

  const handleToggleAll = () => {
    if (allFilteredOpen) {
      setOpenFaqIds([]);
    } else {
      setOpenFaqIds(filteredFaqs.map((f) => f.id));
    }
  };

  return (
    <section
      id="salon-faq"
      className="py-14 sm:py-20 bg-[#FAF7F2] border-t border-[#E7DED1]"
    >
      <div className="ops-container space-y-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="ops-eyebrow">
              Frequently Asked Questions · {shortLocation}
            </div>
            <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2 mb-3">
              Salon policies, service durations & Hyderabad payment methods.
            </h2>
            <p className="text-[#79756C] text-sm sm:text-base m-0">
              Everything you need to know before your visit to {salonName} — from appointment
              cancellation windows and custom package durations to accepted UPI, card, and cash
              payment options in Hyderabad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleAll}
              className="ops-btn-outline text-xs py-2.5 px-4 cursor-pointer"
            >
              <span>{allFilteredOpen ? 'Collapse All Answers' : 'Expand All Answers'}</span>
            </button>
          </div>
        </div>

        {/* Three-Pillar Quick Reference Cards (Policies · Durations · Payments) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ops-card p-6 bg-white space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#9A7950] font-semibold uppercase tracking-wider">
              <span>01 · Salon Policies</span>
              <ShieldCheck className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="font-serif-display text-xl text-[#292720]">
              Zero Double-Booking & Flexible Rescheduling
            </h3>
            <p className="text-xs text-[#79756C] leading-relaxed m-0">
              Free rescheduling up to 2 hours prior. Real-time stylist schedule locks prevent slot
              conflicts across 1–6 member studio and home appointments.
            </p>
          </div>

          <div className="ops-card p-6 bg-white space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#9A7950] font-semibold uppercase tracking-wider">
              <span>02 · Service Durations</span>
              <Clock className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="font-serif-display text-xl text-[#292720]">
              {minDuration}–{maxDuration} Min Rituals & 10% Package Bundles
            </h3>
            <p className="text-xs text-[#79756C] leading-relaxed m-0">
              Every service displays its exact minute count. Combine 3+ services for an automatic
              10% discount while retaining full, unhurried ritual durations.
            </p>
          </div>

          <div className="ops-card p-6 bg-white space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#9A7950] font-semibold uppercase tracking-wider">
              <span>03 · Hyderabad Payments</span>
              <CreditCard className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="font-serif-display text-xl text-[#292720]">
              UPI, Cards, NetBanking & Cash Post-Service
            </h3>
            <p className="text-xs text-[#79756C] leading-relaxed m-0">
              Pay seamlessly via GPay, PhonePe, Paytm, BHIM, Visa, Mastercard, RuPay, Amex, or INR
              Cash after your session. All prices are tax-inclusive.
            </p>
          </div>
        </div>

        {/* Category Filter Tabs + Search Input */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F3EDE2] border border-[#E7DED1]">
            {(
              [
                ['ALL', `All Questions (${faqItems.length})`],
                ['Salon Policies', 'Salon Policies'],
                ['Service Durations', 'Service Durations & Packages'],
                ['Payment Methods', 'Payment Methods (Hyderabad)'],
              ] as const
            ).map(([catKey, label]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategory(catKey)}
                className={`px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategory === catKey
                    ? 'bg-[#292720] text-white'
                    : 'text-[#79756C] hover:text-[#292720]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#79756C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policies, UPI, duration..."
              aria-label="Search frequently asked questions"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
            />
          </div>
        </div>

        {/* Accordion List */}
        {filteredFaqs.length === 0 ? (
          <div className="ops-card p-8 text-center space-y-3">
            <HelpCircle className="w-6 h-6 text-[#9A7950] mx-auto" />
            <div className="text-sm font-medium text-[#292720]">
              No FAQ entries matched “{searchQuery}”.
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ALL');
              }}
              className="ops-btn-outline text-xs py-2 px-4 cursor-pointer"
            >
              Reset FAQ Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`ops-card transition-colors ${
                    isOpen ? 'border-[#9A7950] bg-white' : 'bg-white/90'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full px-6 py-5 text-left flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-[11px] font-mono-tabular uppercase tracking-[1.5px] text-[#9A7950]">
                        {faq.code} · {faq.category}
                      </div>
                      <h3 className="font-serif-display text-xl sm:text-2xl text-[#292720] leading-snug">
                        {faq.question}
                      </h3>
                    </div>
                    <span className="mt-1 p-1.5 border border-[#E7DED1] text-[#292720] shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-[#E7DED1] space-y-4">
                      <p className="text-xs sm:text-sm text-[#79756C] leading-relaxed m-0">
                        {faq.answer}
                      </p>

                      <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#292720]">
                          Key Takeaways:
                        </div>
                        <ul className="text-xs text-[#79756C] space-y-1 pl-4 list-disc">
                          {faq.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Concierge Callout */}
        <div className="ops-card p-6 bg-[#EEE5D8] border border-[#E7DED1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
              Ready to Reserve Your Slot in {shortLocation}?
            </div>
            <p className="text-xs text-[#292720] m-0">
              Select individual services or build a 3+ service custom package with 10% savings,
              choose your preferred specialist, and pay seamlessly after your appointment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onNavigateToServices}
              className="ops-btn-outline text-xs py-2.5 px-4 bg-[#FAF7F2] cursor-pointer"
            >
              <span>Explore Services & Durations</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToBook}
              className="ops-btn text-xs py-2.5 px-4 cursor-pointer"
            >
              <span>Book Appointment Now →</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
