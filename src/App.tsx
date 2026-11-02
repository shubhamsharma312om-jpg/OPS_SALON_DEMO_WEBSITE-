import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  PackagePlus,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { BookingAndPackageBuilder } from './components/BookingAndPackageBuilder';
import {
  HeroSalonArtwork,
  SalonStudioInteriorGallery,
  ServiceMultiImageGallery,
} from './components/VisualArtGallery';
import {
  ClientReviewsSection,
  SalonFaqSection,
} from './components/FaqAndReviewsSection';
import {
  DAYS_OF_WEEK,
  EMPLOYEE_PORTRAIT_MAP,
  HYDERABAD_AREAS,
  INITIAL_BUSINESS_PROFILE,
  INITIAL_EMPLOYEES,
  INITIAL_SERVICES,
  SALON_UPLOADED_ASSETS,
  TIME_SLOTS,
  createInitialBookings,
  getTodayDateString,
} from './data/initialSalonData';
import {
  ActivePage,
  BookingRecord,
  BookingStatus,
  BusinessProfile,
  Employee,
  ServiceCategory,
  ServiceItem,
} from './types/salon';
import {
  calculatePackagePricing,
  checkEmployeeAvailability,
  formatBusinessHoursSummary,
  formatFullSalonAddress,
  formatShortLocationLabel,
  formatWhatsAppDigits,
  isValidEmail,
  isValidHttpUrl,
} from './utils/salonPricingAndValidation';

// Preserve existing storage keys so persisted data is never lost
const STORAGE_KEYS = {
  BOOKINGS: 'nizam_atelier_hyd_bookings_v2',
  EMPLOYEES: 'nizam_atelier_hyd_employees_v2',
  SERVICES: 'ops_salon_hyd_services_v2',
  BUSINESS_PROFILE: 'ops_salon_hyd_business_profile_v1',
};

const SERVICE_ACTION_PHOTO_URLS = new Set<string>([
  SALON_UPLOADED_ASSETS.facialSteam,
  SALON_UPLOADED_ASSETS.barberFade,
  SALON_UPLOADED_ASSETS.interiorWide,
  SALON_UPLOADED_ASSETS.royalGroom,
  SALON_UPLOADED_ASSETS.interiorArch,
  SALON_UPLOADED_ASSETS.precisionShear,
  SALON_UPLOADED_ASSETS.youthStyling,
  SALON_UPLOADED_ASSETS.hotTowelShave,
  SALON_UPLOADED_ASSETS.scissorTexture,
  SALON_UPLOADED_ASSETS.razorSculpt,
  SALON_UPLOADED_ASSETS.ayurvedicChampi,
]);

function normalizeClientUploadedUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) return '';
  const trimmed = rawUrl.trim();
  const uploadMatch = trimmed.match(
    /\/(?:assets\/aistudio|images\/uploads)\/((?:emp-upload-|srv-upload-|upload-)[^/?#]+)$/
  );
  if (uploadMatch) {
    return `/api/uploads/${uploadMatch[1]}`;
  }
  return trimmed;
}

function resolveClientEmployeePortrait(empId: string, currentUrl?: string): string {
  const defaultAvatar =
    EMPLOYEE_PORTRAIT_MAP[empId] || SALON_UPLOADED_ASSETS.empPortraitAarav;
  if (!currentUrl || !currentUrl.trim()) {
    return defaultAvatar;
  }
  const normalized = normalizeClientUploadedUrl(currentUrl);
  if (
    normalized.includes('/assets/aistudio/emp-portrait-') ||
    normalized.includes('/assets/aistudio/srv-') ||
    normalized.includes('/assets/aistudio/studio-gallery-') ||
    normalized.startsWith('/images/employees/emp-') ||
    SERVICE_ACTION_PHOTO_URLS.has(normalized)
  ) {
    return defaultAvatar;
  }
  return normalized;
}

function normalizeLoadedServices(list?: ServiceItem[]): ServiceItem[] {
  if (!Array.isArray(list) || list.length === 0) {
    return INITIAL_SERVICES;
  }

  return list.map((srv, idx) => {
    const rawPlates = Array.isArray(srv.plates) && srv.plates.length > 0 ? srv.plates : [];
    const mainImg = normalizeClientUploadedUrl(
      srv.imageUrl || rawPlates[0]?.imageUrl || SALON_UPLOADED_ASSETS.scissorTexture
    );

    const buildPlate = (plateIdx: 0 | 1 | 2) => {
      const p = rawPlates[plateIdx];
      const url = normalizeClientUploadedUrl(p?.imageUrl || mainImg);
      const isUploaded =
        url.startsWith('/api/uploads/') ||
        url.startsWith('data:image/') ||
        url.startsWith('/assets/aistudio/');
      return {
        id: p?.id || `${srv.id}-p${plateIdx + 1}`,
        label: p?.label || `Plate 0${plateIdx + 1} · ${srv.name}`,
        caption: p?.caption || `${srv.name} — View 0${plateIdx + 1}`,
        themeVariant: p?.themeVariant || ('scissors' as const),
        angleIndex: plateIdx,
        imageUrl: url,
        needsRealPhoto: isUploaded ? false : Boolean(p?.needsRealPhoto),
        photoPromptNote: isUploaded ? undefined : p?.photoPromptNote,
      };
    };

    const plates: [ServiceItem['plates'][0], ServiceItem['plates'][1], ServiceItem['plates'][2]] = [
      buildPlate(0),
      buildPlate(1),
      buildPlate(2),
    ];

    return {
      ...srv,
      code: srv.code || String(idx + 1).padStart(2, '0'),
      imageUrl: plates[0].imageUrl || mainImg,
      includedSteps:
        Array.isArray(srv.includedSteps) && srv.includedSteps.length > 0
          ? srv.includedSteps
          : [
              'Personal consultation & preparation',
              'Signature treatment execution',
              'Finishing & styling check',
            ],
      plates,
    };
  });
}

function normalizeLoadedEmployees(list: Employee[]): Employee[] {
  const existingIds = new Set(list.map((e) => e.id));
  const combined = [...list];
  for (const initEmp of INITIAL_EMPLOYEES) {
    if (!existingIds.has(initEmp.id)) {
      combined.push(initEmp);
    }
  }

  return combined.map((e) => {
    const initialMatch = INITIAL_EMPLOYEES.find((ie) => ie.id === e.id);
    const cleanedPhone =
      e.phone && e.phone.startsWith('+91 98490') ? '' : e.phone || '';
    const mergedServices = Array.from(
      new Set([
        ...(e.offeredServiceIds || []),
        ...(initialMatch?.offeredServiceIds || ['srv-haircut', 'srv-beard', 'srv-head-massage']),
      ])
    );

    return {
      ...e,
      phone: cleanedPhone,
      portraitUrl: resolveClientEmployeePortrait(e.id, e.portraitUrl),
      offeredServiceIds: mergedServices,
      availableSlots:
        e.availableSlots && e.availableSlots.length > 0
          ? e.availableSlots
          : initialMatch?.availableSlots || [...TIME_SLOTS],
      shiftStart: e.shiftStart || initialMatch?.shiftStart || '09:00',
      shiftEnd: e.shiftEnd || initialMatch?.shiftEnd || '20:00',
      breakStart: e.breakStart ?? initialMatch?.breakStart ?? '',
      breakEnd: e.breakEnd ?? initialMatch?.breakEnd ?? '',
      workingDays:
        e.workingDays && e.workingDays.length > 0
          ? e.workingDays
          : initialMatch?.workingDays || [...DAYS_OF_WEEK],
      holidays: Array.isArray(e.holidays) ? e.holidays : [],
    };
  });
}

// Client-side image processor that converts any uploaded file into a clean, browser-verified JPEG/PNG Data URL
async function normalizeImageFileToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  try {
    const normalized = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1100;
          let targetW = img.naturalWidth || img.width || 800;
          let targetH = img.naturalHeight || img.height || 800;
          if (targetW > maxDim || targetH > maxDim) {
            const scale = Math.min(maxDim / targetW, maxDim / targetH);
            targetW = Math.max(1, Math.round(targetW * scale));
            targetH = Math.max(1, Math.round(targetH * scale));
          }
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = rawDataUrl;
    });
    return normalized;
  } catch {
    return rawDataUrl;
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Persistent State for Services, Business Profile, Employees & Bookings
  const [services, setServices] = useState<ServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SERVICES);
      if (saved) {
        const parsed: ServiceItem[] = JSON.parse(saved);
        return normalizeLoadedServices(parsed);
      }
    } catch {
      // ignore storage errors
    }
    return normalizeLoadedServices(INITIAL_SERVICES);
  });

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUSINESS_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_BUSINESS_PROFILE,
          ...parsed,
          businessHours:
            Array.isArray(parsed.businessHours) && parsed.businessHours.length === 7
              ? parsed.businessHours
              : INITIAL_BUSINESS_PROFILE.businessHours,
        };
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_BUSINESS_PROFILE;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      if (saved) {
        const parsed: Employee[] = JSON.parse(saved);
        return normalizeLoadedEmployees(parsed);
      }
    } catch {
      // ignore storage errors
    }
    return normalizeLoadedEmployees(INITIAL_EMPLOYEES);
  });

  const [bookings, setBookings] = useState<BookingRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return createInitialBookings();
  });

  // Hydrate & synchronize with the Express backend database (/api/state)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.services) && data.services.length > 0) {
          setServices(normalizeLoadedServices(data.services));
        }

        if (data.businessProfile) {
          setBusinessProfile((prev) => {
            if (data.businessProfile.updatedAt) {
              return {
                ...INITIAL_BUSINESS_PROFILE,
                ...data.businessProfile,
              };
            }
            return prev;
          });
        }

        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(normalizeLoadedEmployees(data.employees));
        }

        if (Array.isArray(data.bookings) && data.bookings.length > 0) {
          setBookings((localBookings) => {
            const serverIds = new Set(data.bookings.map((b: BookingRecord) => b.id));
            const unsynced = localBookings.filter((b) => !serverIds.has(b.id));
            if (unsynced.length > 0) {
              const merged = [...unsynced, ...data.bookings];
              fetch('/api/state/sync-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookings: merged }),
              }).catch(() => {});
              return merged;
            }
            return data.bookings;
          });
        }
      } catch {
        // Offline / local fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
    } catch {
      // ignore storage errors
    }
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BUSINESS_PROFILE, JSON.stringify(businessProfile));
    } catch {
      // ignore storage errors
    }
  }, [businessProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    } catch {
      // ignore storage errors
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    } catch {
      // ignore storage errors
    }
  }, [bookings]);

  const todayStr = getTodayDateString();

  // Custom Package Selection State across pages
  const [selectedPackageServiceIds, setSelectedPackageServiceIds] = useState<string[]>([
    'srv-haircut',
    'srv-beard',
    'srv-head-massage',
  ]);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<ServiceCategory | 'ALL'>(
    'ALL'
  );

  // Preselected Employee / Date / Slot when clicking from Stylists page
  const [stylistScheduleDate, setStylistScheduleDate] = useState<string>(todayStr);
  const [preselectedEmployeeId, setPreselectedEmployeeId] = useState<string | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [preselectedSlot, setPreselectedSlot] = useState<string | null>(null);

  // Owner / Admin Authentication State
  // Credentials are never prefilled, never displayed in the UI, and never auto-logged in.
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPasscode, setLoginPasscode] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Contact Us & Privacy-Protected Client Booking Lookup State
  const [lookupBookingRef, setLookupBookingRef] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [verifiedLookupBookingId, setVerifiedLookupBookingId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUpBooking, setIsLookingUpBooking] = useState<boolean>(false);
  const [customerReplyDraft, setCustomerReplyDraft] = useState<string>('');
  const [replyStatusBanner, setReplyStatusBanner] = useState<string | null>(null);

  const [contactInquiryName, setContactInquiryName] = useState<string>('');
  const [contactInquiryPhone, setContactInquiryPhone] = useState<string>('+91 ');
  const [contactInquiryArea, setContactInquiryArea] = useState<string>('Jubilee Hills');
  const [contactInquiryMsg, setContactInquiryMsg] = useState<string>('');
  const [contactSubmittedBanner, setContactSubmittedBanner] = useState<string | null>(null);

  const togglePackageService = (serviceId: string) => {
    setSelectedPackageServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  // Single-source-of-truth Custom Package Pricing Calculation (10% off for 3+ services)
  const customPackagePricing = useMemo(
    () =>
      calculatePackagePricing(
        selectedPackageServiceIds,
        services,
        'Flagship Studio (Jubilee Hills)'
      ),
    [services, selectedPackageServiceIds]
  );

  const navigateToPage = (page: ActivePage) => {
    if (page === 'admin' && !isAdminAuthenticated) {
      openLoginModal();
      return;
    }
    setActivePage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLoginModal = () => {
    // Always reset login fields to blank when opening the modal
    setLoginUsername('');
    setLoginPasscode('');
    setShowPasscode(false);
    setIsLoggingIn(false);
    setLoginError(null);
    setShowLoginModal(true);
  };

  const handleOwnerPortalClick = () => {
    if (isAdminAuthenticated) {
      navigateToPage('admin');
    } else {
      openLoginModal();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const trimmedUsername = loginUsername.trim();
    if (!trimmedUsername || !loginPasscode) {
      setLoginError('Please enter both your username and passcode.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          passcode: loginPasscode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAdminToken(data.token || 'local-session');
        setIsAdminAuthenticated(true);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPasscode('');
        setShowPasscode(false);
        setActivePage('admin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errData = await response.json().catch(() => ({}));
        setLoginError(errData.error || 'Invalid username or passcode.');
      }
    } catch {
      // Fallback verification if API is temporarily unreachable
      if (trimmedUsername === 'ops' && loginPasscode === 'Ops@2026') {
        setAdminToken('local-session');
        setIsAdminAuthenticated(true);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPasscode('');
        setShowPasscode(false);
        setActivePage('admin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setLoginError('Invalid username or passcode.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (adminToken && adminToken !== 'local-session') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    setAdminToken(null);
    setIsAdminAuthenticated(false);
    setLoginUsername('');
    setLoginPasscode('');
    setActivePage('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers passed to Booking & Admin
  const handleCompleteBooking = (
    newBooking: BookingRecord,
    allUpdatedBookings?: BookingRecord[]
  ) => {
    if (allUpdatedBookings) {
      setBookings(allUpdatedBookings);
    } else {
      setBookings((prev) => {
        if (prev.some((b) => b.id === newBooking.id)) return prev;
        return [newBooking, ...prev];
      });
    }
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
    return headers;
  };

  const handleUpdateBooking = async (
    bookingId: string,
    updates: {
      status?: BookingStatus;
      appointmentDate?: string;
      timeSlot?: string;
      notes?: string;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking) {
      return { ok: false, error: 'Appointment record not found.' };
    }

    const nextDate = updates.appointmentDate || targetBooking.appointmentDate;
    const nextSlot = updates.timeSlot || targetBooking.timeSlot;
    const nextStatus = updates.status || targetBooking.status;

    // Validate conflict locally before saving when date/slot changes or reactivating a cancelled booking
    if (
      nextStatus !== 'Cancelled' &&
      nextStatus !== 'No-Show' &&
      (nextDate !== targetBooking.appointmentDate ||
        nextSlot !== targetBooking.timeSlot ||
        targetBooking.status === 'Cancelled' ||
        targetBooking.status === 'No-Show')
    ) {
      const otherBookings = bookings.filter((b) => b.id !== bookingId);
      const empServiceMap = new Map<string, string[]>();
      for (const m of targetBooking.members) {
        if (!m.preferredEmployeeId) continue;
        const list = empServiceMap.get(m.preferredEmployeeId) || [];
        list.push(...m.serviceIds);
        empServiceMap.set(m.preferredEmployeeId, list);
      }

      for (const [empId, srvIds] of empServiceMap.entries()) {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) continue;
        const totalDur = srvIds.reduce((sum, id) => {
          const s = services.find((srv) => srv.id === id);
          return sum + (s ? s.durationMinutes : 0);
        }, 0);
        const check = checkEmployeeAvailability({
          employee: emp,
          appointmentDate: nextDate,
          timeSlot: nextSlot,
          existingBookings: otherBookings,
          requiredServiceIds: Array.from(new Set(srvIds)),
          requestedDurationMinutes: Math.max(30, totalDur),
          allServices: services,
          businessProfile,
        });
        if (!check.available) {
          return { ok: false, error: check.message };
        }
      }
    }

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
          return { ok: true };
        }
      } else if (res.status === 409 || res.status === 400) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || 'Schedule conflict detected.' };
      }
    } catch {
      // Fallback to local update if offline
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              ...(updates.status ? { status: updates.status } : {}),
              ...(updates.appointmentDate ? { appointmentDate: updates.appointmentDate } : {}),
              ...(updates.timeSlot ? { timeSlot: updates.timeSlot } : {}),
              ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
            }
          : b
      )
    );
    return { ok: true };
  };

  const handleSendAdminMessage = async (
    bookingId: string,
    content: string,
    channel: 'Portal Message' | 'WhatsApp' | 'Email'
  ) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content, channel, sender: 'Shop Owner' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
          return;
        }
      }
    } catch {
      // fallback to local state
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              messages: [
                ...b.messages,
                {
                  id: `msg-${Date.now()}`,
                  sentAt: timestamp,
                  sender: 'Shop Owner',
                  channel,
                  content,
                },
              ],
            }
          : b
      )
    );
  };

  const handleSaveBusinessProfile = async (
    nextProfile: BusinessProfile
  ): Promise<{ ok: boolean; error?: string }> => {
    const stampedProfile: BusinessProfile = {
      ...nextProfile,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/business-profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(stampedProfile),
      });
      if (res.ok) {
        const data = await res.json();
        setBusinessProfile(data.businessProfile || stampedProfile);
        return { ok: true };
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 400) {
          return { ok: false, error: err.error || 'Invalid business profile fields.' };
        }
      }
    } catch {
      // Fallback to local state persistence
    }

    setBusinessProfile(stampedProfile);
    return { ok: true };
  };

  const handleAddEmployee = async (
    newEmp: Omit<Employee, 'id' | 'rating' | 'completedAppointments'>
  ) => {
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newEmp),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.employee) {
          setEmployees((prev) => [...prev, data.employee]);
          return;
        }
      }
    } catch {
      // fallback to local
    }

    const created: Employee = {
      ...newEmp,
      id: `emp-${Date.now()}`,
      rating: 4.9,
      completedAppointments: 0,
    };
    setEmployees((prev) => [...prev, created]);
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    try {
      await fetch(`/api/employees/${encodeURIComponent(updatedEmp.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedEmp),
      });
    } catch {
      // local state already updated
    }
  };

  const handleToggleEmployeeActive = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;
    const updated: Employee = { ...target, active: !target.active };
    await handleUpdateEmployee(updated);
  };

  const handleRemoveEmployee = async (empId: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
    try {
      await fetch(`/api/employees/${encodeURIComponent(empId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch {
      // local state already updated
    }
  };

  const handleUploadImage = async (
    file: File,
    prefix: 'employee' | 'service' = 'employee'
  ): Promise<string> => {
    const dataUrl = await normalizeImageFileToDataUrl(file);

    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          filename: file.name,
          dataUrl,
          prefix,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          return normalizeClientUploadedUrl(data.url);
        }
      }
    } catch {
      // Fall back to normalized Data URL if offline or local session
    }

    return dataUrl;
  };

  const handleUploadEmployeeImage = (file: File): Promise<string> =>
    handleUploadImage(file, 'employee');

  const handleUploadServiceImage = (file: File): Promise<string> =>
    handleUploadImage(file, 'service');

  const handleAddService = async (
    newService: Omit<ServiceItem, 'id'>,
    qualifiedEmployeeIds?: string[]
  ) => {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newService,
          qualifiedEmployeeIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.services)) {
          setServices(normalizeLoadedServices(data.services));
        } else if (data.service) {
          setServices((prev) => normalizeLoadedServices([...prev, data.service]));
        }
        if (Array.isArray(data.employees)) {
          setEmployees(normalizeLoadedEmployees(data.employees));
        }
        return;
      }
    } catch {
      // fallback to local
    }

    const createdId = `srv-custom-${Date.now()}`;
    const created: ServiceItem = {
      ...newService,
      id: createdId,
      code: newService.code || String(services.length + 1).padStart(2, '0'),
    };
    setServices((prev) => normalizeLoadedServices([...prev, created]));

    const targetEmpIds =
      qualifiedEmployeeIds && qualifiedEmployeeIds.length > 0
        ? qualifiedEmployeeIds
        : employees.map((e) => e.id);
    setEmployees((prev) =>
      prev.map((emp) =>
        targetEmpIds.includes(emp.id)
          ? {
              ...emp,
              offeredServiceIds: Array.from(
                new Set([...(emp.offeredServiceIds || []), createdId])
              ),
            }
          : emp
      )
    );
  };

  const handleUpdateService = async (
    updatedService: ServiceItem,
    qualifiedEmployeeIds?: string[]
  ) => {
    setServices((prev) =>
      normalizeLoadedServices(
        prev.map((s) => (s.id === updatedService.id ? updatedService : s))
      )
    );

    if (qualifiedEmployeeIds && qualifiedEmployeeIds.length > 0) {
      setEmployees((prev) =>
        prev.map((emp) => {
          const hasService = (emp.offeredServiceIds || []).includes(updatedService.id);
          const shouldHave = qualifiedEmployeeIds.includes(emp.id);
          if (shouldHave && !hasService) {
            return {
              ...emp,
              offeredServiceIds: [...(emp.offeredServiceIds || []), updatedService.id],
            };
          }
          if (!shouldHave && hasService && (emp.offeredServiceIds || []).length > 1) {
            return {
              ...emp,
              offeredServiceIds: emp.offeredServiceIds.filter(
                (id) => id !== updatedService.id
              ),
            };
          }
          return emp;
        })
      );
    }

    try {
      const res = await fetch(`/api/services/${encodeURIComponent(updatedService.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...updatedService,
          qualifiedEmployeeIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.services)) {
          setServices(normalizeLoadedServices(data.services));
        }
        if (Array.isArray(data.employees)) {
          setEmployees(normalizeLoadedEmployees(data.employees));
        }
      }
    } catch {
      // local state already updated
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    setServices((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== serviceId);
    });
    setSelectedPackageServiceIds((prev) => prev.filter((id) => id !== serviceId));
    setEmployees((prev) =>
      prev.map((emp) => ({
        ...emp,
        offeredServiceIds: (emp.offeredServiceIds || []).filter((id) => id !== serviceId),
      }))
    );

    try {
      await fetch(`/api/services/${encodeURIComponent(serviceId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch {
      // local state already updated
    }
  };

  // Privacy-protected customer booking lookup: requires BOTH Booking Reference AND matching Phone Number
  const verifiedBookingForLookup = useMemo(() => {
    if (!verifiedLookupBookingId) return null;
    return bookings.find((b) => b.id === verifiedLookupBookingId) || null;
  }, [bookings, verifiedLookupBookingId]);

  const handleVerifyBookingLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setReplyStatusBanner(null);

    const refClean = lookupBookingRef.trim().toUpperCase();
    const phoneDigits = lookupPhone.replace(/\D/g, '');

    if (!refClean) {
      setLookupError('Please enter your Booking Reference (for example, NZM-8401).');
      return;
    }
    if (phoneDigits.length < 6) {
      setLookupError('Please enter the phone number used when booking (at least 6 digits).');
      return;
    }

    setIsLookingUpBooking(true);
    try {
      const res = await fetch('/api/bookings/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: refClean,
          phone: lookupPhone.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setBookings((prev) =>
            prev.some((b) => b.id === data.booking.id)
              ? prev.map((b) => (b.id === data.booking.id ? data.booking : b))
              : [data.booking, ...prev]
          );
          setVerifiedLookupBookingId(data.booking.id);
          return;
        }
      }
    } catch {
      // fallback to local verification
    } finally {
      setIsLookingUpBooking(false);
    }

    const last6 = phoneDigits.slice(-6);
    const localMatch = bookings.find((b) => {
      if (b.bookingRef.trim().toUpperCase() !== refClean) return false;
      const bDigits = b.customerPhone.replace(/\D/g, '');
      return bDigits.endsWith(last6) || bDigits.includes(phoneDigits);
    });

    if (localMatch) {
      setVerifiedLookupBookingId(localMatch.id);
    } else {
      setVerifiedLookupBookingId(null);
      setLookupError(
        'No appointment matched that Booking Reference and Phone Number combination. Please verify both details.'
      );
    }
  };

  const handleSendCustomerReply = async (bookingId: string) => {
    if (!customerReplyDraft.trim() || !verifiedBookingForLookup) return;
    const messageText = customerReplyDraft.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText,
          channel: 'Portal Message',
          sender: 'Customer',
          phone: lookupPhone.trim() || verifiedBookingForLookup.customerPhone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
          setCustomerReplyDraft('');
          setReplyStatusBanner('Your message has been delivered to the salon desk.');
          return;
        }
      }
    } catch {
      // fallback to local state
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              messages: [
                ...b.messages,
                {
                  id: `msg-${Date.now()}`,
                  sentAt: timestamp,
                  sender: 'Customer',
                  channel: 'Portal Message',
                  content: messageText,
                },
              ],
            }
          : b
      )
    );
    setCustomerReplyDraft('');
    setReplyStatusBanner('Your message has been delivered to the salon desk.');
  };

  const filteredServices = useMemo(() => {
    if (serviceCategoryFilter === 'ALL') return services;
    return services.filter((s) => s.category === serviceCategoryFilter);
  }, [services, serviceCategoryFilter]);

  const getServiceById = (id: string) => services.find((s) => s.id === id);

  // Derived Business Profile values for Customer UI
  const salonName = businessProfile.salonName?.trim() || 'OPS Salon';
  const salonTagline =
    businessProfile.tagline?.trim() || 'The art of looking exceptional.';
  const shortLocation = formatShortLocationLabel(businessProfile);
  const fullSalonAddress = formatFullSalonAddress(businessProfile);
  const hoursSummary = formatBusinessHoursSummary(businessProfile);

  const primaryPhone = businessProfile.primaryPhone?.trim() || '';
  const secondaryPhone = businessProfile.secondaryPhone?.trim() || '';
  const whatsappDigits = formatWhatsAppDigits(
    businessProfile.whatsappNumber || businessProfile.primaryPhone
  );
  const officialEmail =
    businessProfile.officialEmail?.trim() && isValidEmail(businessProfile.officialEmail)
      ? businessProfile.officialEmail.trim()
      : '';
  const googleMapsUrl =
    businessProfile.googleMapsUrl?.trim() && isValidHttpUrl(businessProfile.googleMapsUrl)
      ? businessProfile.googleMapsUrl.trim()
      : '';
  const instagramUrl =
    businessProfile.instagramUrl?.trim() && isValidHttpUrl(businessProfile.instagramUrl)
      ? businessProfile.instagramUrl.trim()
      : '';
  const facebookUrl =
    businessProfile.facebookUrl?.trim() && isValidHttpUrl(businessProfile.facebookUrl)
      ? businessProfile.facebookUrl.trim()
      : '';
  const websiteUrl =
    businessProfile.websiteUrl?.trim() && isValidHttpUrl(businessProfile.websiteUrl)
      ? businessProfile.websiteUrl.trim()
      : '';

  const hasAnySavedContact = Boolean(
    primaryPhone || secondaryPhone || whatsappDigits || officialEmail || fullSalonAddress
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#292720]">
      {/* OPTIONAL CUSTOMER ANNOUNCEMENT BANNER (CONFIGURED IN OWNER SETTINGS) */}
      {businessProfile.announcementActive && businessProfile.announcementText?.trim() && (
        <div className="bg-[#292720] text-[#FAF7F2] px-4 py-2 text-center text-xs border-b border-[#9A7950]/40">
          <span className="font-semibold text-[#D0B48B] uppercase tracking-wider mr-2">
            Notice:
          </span>
          <span>{businessProfile.announcementText.trim()}</span>
        </div>
      )}

      {/* PROTOTYPE-ALIGNED STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/96 backdrop-blur-md border-b border-[#E7DED1]">
        <div className="ops-container min-h-[82px] flex items-center justify-between gap-6 py-3">
          {/* Brand Logo: OPS / S A L O N */}
          <button
            type="button"
            onClick={() => navigateToPage('dashboard')}
            className="text-left shrink-0 group cursor-pointer"
            aria-label={`${salonName} Home`}
          >
            <span className="block font-serif-display text-[29px] font-semibold tracking-[3px] text-[#292720] leading-none group-hover:text-[#9A7950] transition-colors">
              {salonName.toUpperCase().startsWith('OPS') ? 'OPS' : salonName}
            </span>
            <small className="block text-[9px] font-sans tracking-[3px] text-[#79756C] text-center mt-1 uppercase">
              {salonName.toUpperCase().startsWith('OPS') ? 'S A L O N' : shortLocation}
            </small>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-7 text-[13px] font-medium text-[#292720]"
            aria-label="Primary navigation"
          >
            <button
              type="button"
              onClick={() => navigateToPage('dashboard')}
              className={`transition-colors py-1 cursor-pointer ${
                activePage === 'dashboard'
                  ? 'text-[#9A7950] font-semibold border-b border-[#9A7950]'
                  : 'hover:text-[#9A7950]'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('services')}
              className={`transition-colors py-1 cursor-pointer ${
                activePage === 'services'
                  ? 'text-[#9A7950] font-semibold border-b border-[#9A7950]'
                  : 'hover:text-[#9A7950]'
              }`}
            >
              Services & Packages
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('book')}
              className={`transition-colors py-1 cursor-pointer ${
                activePage === 'book'
                  ? 'text-[#9A7950] font-semibold border-b border-[#9A7950]'
                  : 'hover:text-[#9A7950]'
              }`}
            >
              Book Appointment
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('stylists')}
              className={`transition-colors py-1 cursor-pointer ${
                activePage === 'stylists'
                  ? 'text-[#9A7950] font-semibold border-b border-[#9A7950]'
                  : 'hover:text-[#9A7950]'
              }`}
            >
              Our Stylists
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('contact')}
              className={`transition-colors py-1 cursor-pointer ${
                activePage === 'contact'
                  ? 'text-[#9A7950] font-semibold border-b border-[#9A7950]'
                  : 'hover:text-[#9A7950]'
              }`}
            >
              Contact
            </button>
          </nav>

          {/* Right Action Controls: Book Appointment CTA + Owner Login Portal */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigateToPage('book')}
              className="ops-btn hidden sm:inline-flex text-xs py-2.5 px-4"
            >
              <span>Book Appointment</span>
            </button>

            <button
              type="button"
              onClick={handleOwnerPortalClick}
              className={`ops-btn-outline text-xs py-2.5 px-3.5 ${
                activePage === 'admin'
                  ? 'bg-[#9A7950] border-[#9A7950] text-white'
                  : ''
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{isAdminAuthenticated ? 'Owner Dashboard' : 'Owner Portal'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2.5 text-[#292720] border border-[#E7DED1] bg-transparent hover:border-[#9A7950]"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FAF7F2] border-t border-[#E7DED1] px-6 py-4 flex flex-col gap-3">
            {(
              [
                ['dashboard', 'Home'],
                ['services', 'Services & Packages'],
                ['book', 'Book Appointment'],
                ['stylists', 'Our Stylists & Availability'],
                ['contact', 'Contact & Booking Lookup'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => navigateToPage(key)}
                className={`text-left py-2 px-3 text-sm font-medium border transition-colors ${
                  activePage === key
                    ? 'bg-[#292720] text-white border-[#292720]'
                    : 'bg-white text-[#292720] border-[#E7DED1]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* MAIN VIEWPORT CONTENT */}
      <main className="flex-1">
        {/* PAGE 1: CUSTOMER OVERVIEW DASHBOARD (FOLLOWING PROTOTYPE ARCHITECTURE) */}
        {activePage === 'dashboard' && (
          <div>
            {/* HERO SECTION */}
            <section className="pt-10 pb-16 sm:pt-12 sm:pb-20">
              <div className="ops-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-5 py-4 min-w-0">
                  <div className="ops-eyebrow">{shortLocation} · Premium Hair & Grooming</div>

                  <h1 className="font-serif-display text-[42px] sm:text-[56px] lg:text-[66px] tracking-[-1.6px] leading-[1.12] my-5 text-[#292720]">
                    The art of
                    <br />
                    looking <span className="text-[#9A7950] italic">exceptional.</span>
                  </h1>

                  <p className="text-[#79756C] text-[15px] leading-relaxed max-w-[460px] mb-7">
                    {businessProfile.tagline?.trim()
                      ? `${businessProfile.tagline.trim()} Thoughtful grooming and exceptional craftsmanship tailored around you in ${
                          businessProfile.city || 'Hyderabad'
                        }.`
                      : `Thoughtful grooming. Exceptional craftsmanship. A more personal salon experience, designed around you in ${shortLocation}.`}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigateToPage('book')}
                      className="ops-btn"
                    >
                      <span>Reserve Your Experience</span>
                      <ArrowUpRight className="w-4 h-4 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToPage('services')}
                      className="ops-btn-outline"
                    >
                      <span>Explore Services</span>
                    </button>
                  </div>

                  <div className="mt-8 pt-5 border-t border-[#E7DED1] text-[#79756C] text-xs">
                    Personalised appointments · Expert stylists · Refined rituals ·{' '}
                    {fullSalonAddress || shortLocation}
                  </div>
                </div>

                <div className="lg:col-span-7 min-w-0">
                  <HeroSalonArtwork
                    onBookNow={() => navigateToPage('book')}
                    onExplorePackages={() => navigateToPage('services')}
                    businessProfile={businessProfile}
                  />
                </div>
              </div>
            </section>

            {/* TRUST STRIP */}
            <section className="bg-[#F0E8DB] py-8 border-y border-[#E7DED1]">
              <div className="ops-container grid grid-cols-2 lg:grid-cols-4 gap-y-5">
                <div className="pr-4 sm:px-6 border-r border-[#D9CEBD] first:pl-0">
                  <strong className="block font-serif-display text-2xl font-medium text-[#292720]">
                    01 — 12
                  </strong>
                  <span className="text-xs text-[#79756C]">Curated grooming services</span>
                </div>

                <div className="pl-4 sm:px-6 lg:border-r border-[#D9CEBD]">
                  <strong className="block font-serif-display text-2xl font-medium text-[#292720]">
                    01 — 06
                  </strong>
                  <span className="text-xs text-[#79756C]">Members per appointment</span>
                </div>

                <div className="pr-4 sm:px-6 border-r border-[#D9CEBD] pl-0 lg:pl-6">
                  <strong className="block font-serif-display text-2xl font-medium text-[#292720]">
                    10%
                  </strong>
                  <span className="text-xs text-[#79756C]">
                    Automatic bundle discount (3+ services)
                  </span>
                </div>

                <div className="pl-4 sm:px-6">
                  <strong className="block font-serif-display text-2xl font-medium text-[#292720]">
                    HYD.
                  </strong>
                  <span className="text-xs text-[#79756C]">
                    14 Hyderabad localities & GPS pin
                  </span>
                </div>
              </div>
            </section>

            {/* THE SERVICE MENU (ALL 12 SERVICES WITH UNIQUE MULTI-IMAGE GALLERIES) */}
            <section className="py-16 sm:py-24" id="services">
              <div className="ops-container space-y-10">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div className="max-w-[650px]">
                    <div className="ops-eyebrow">The Service Menu</div>
                    <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2.5 mb-3">
                      Made for your kind of extraordinary.
                    </h2>
                    <p className="text-[#79756C] text-sm sm:text-base m-0">
                      From a precise architectural haircut or zero-gap skin fade to a restorative
                      Ayurvedic grooming ritual, discover all twelve signature services tailored to
                      your style.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToPage('services')}
                    className="ops-btn-outline text-xs"
                  >
                    <span>Open Full Service Details & Filters →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {services.map((service) => {
                    const isInPackage = selectedPackageServiceIds.includes(service.id);
                    return (
                      <article
                        key={service.id}
                        className="group ops-card flex flex-col justify-between transition-all duration-250 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(41,39,32,0.08)]"
                      >
                        <div>
                          <ServiceMultiImageGallery
                            plates={service.plates}
                            serviceName={service.name}
                          />

                          <div className="p-5 flex flex-col items-start">
                            <span className="text-[#9A7950] text-[10px] font-bold tracking-[1.8px] uppercase">
                              SERVICE / {service.code} · {service.category}
                            </span>

                            <h3 className="font-serif-display text-[21px] text-[#292720] mt-2.5 mb-2">
                              {service.name}
                            </h3>

                            <p className="text-[#79756C] text-xs leading-relaxed mb-4">
                              {service.shortSummary}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-5 pt-3.5 border-t border-[#E7DED1] flex items-center justify-between gap-2.5 mt-auto">
                          <div>
                            <div className="text-[17px] font-bold font-mono-tabular text-[#292720]">
                              ₹{service.price.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[11px] text-[#79756C] font-mono-tabular">
                              {service.durationMinutes} minutes
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePackageService(service.id)}
                              aria-label={
                                isInPackage
                                  ? `Remove ${service.name} from your package`
                                  : `Add ${service.name} to your package`
                              }
                              className={`px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                                isInPackage
                                  ? 'bg-[#9A7950] border-[#9A7950] text-white'
                                  : 'bg-transparent border-[#292720] text-[#292720] hover:bg-[#9A7950] hover:border-[#9A7950] hover:text-white'
                              }`}
                            >
                              {isInPackage ? '✓ Added' : '+ Add'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedPackageServiceIds.includes(service.id)) {
                                  setSelectedPackageServiceIds((prev) => [...prev, service.id]);
                                }
                                navigateToPage('book');
                              }}
                              className="px-3 py-2 text-xs font-semibold bg-[#292720] text-white border border-[#292720] hover:bg-[#9A7950] hover:border-[#9A7950] transition-colors cursor-pointer"
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* CUSTOM PACKAGE BUILDER SECTION (PROTOTYPE-ALIGNED) */}
            <section className="py-16 sm:py-24 bg-[#EEE5D8] border-y border-[#E7DED1]" id="packages">
              <div className="ops-container">
                <div className="max-w-[650px] mb-10">
                  <div className="ops-eyebrow">Your Ritual, Your Rules</div>
                  <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2.5 mb-3">
                    Create your own package.
                  </h2>
                  <p className="text-[#79756C] text-sm sm:text-base m-0">
                    Combine your favourite services into one personalised grooming experience.
                    Select 3 or more services to automatically unlock 10% package savings.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-11 items-start">
                  {/* Left: Selectable Service Checkboxes */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    {services.map((service) => {
                      const checked = selectedPackageServiceIds.includes(service.id);
                      return (
                        <label
                          key={service.id}
                          className={`p-4 border flex items-start gap-3 cursor-pointer transition-colors min-w-0 ${
                            checked
                              ? 'bg-white border-[#9A7950] shadow-xs'
                              : 'bg-white/75 border-[#DED3C3] hover:border-[#9A7950]/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePackageService(service.id)}
                            className="mt-1 accent-[#9A7950] w-4 h-4 shrink-0"
                          />
                          <span className="min-w-0 text-[13px] font-semibold text-[#292720]">
                            {service.name}
                            <small className="block text-[#79756C] font-normal font-mono-tabular mt-1">
                              ₹{service.price.toLocaleString('en-IN')} · {service.durationMinutes}{' '}
                              min · {service.category}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Right: Sticky Package Summary */}
                  <aside className="lg:col-span-5 lg:sticky lg:top-28 bg-[#FAF7F2] border border-[#E7DED1] p-7 min-w-0">
                    <div className="ops-eyebrow">Your Selection</div>
                    <h3 className="font-serif-display text-[28px] text-[#292720] mt-1 mb-4">
                      Package Summary
                    </h3>

                    <div className="space-y-2.5 border-b border-[#E7DED1] pb-4 mb-4">
                      {customPackagePricing.selectedServices.length === 0 ? (
                        <p className="text-xs text-[#79756C] m-0">
                          Choose services on the left to begin building your custom package.
                        </p>
                      ) : (
                        <>
                          {customPackagePricing.selectedServices.map((srv) => (
                            <div
                              key={srv.id}
                              className="flex items-start justify-between gap-3 text-[13px]"
                            >
                              <span className="min-w-0 text-[#292720]">{srv.name}</span>
                              <strong className="font-mono-tabular text-[#292720] shrink-0">
                                ₹{srv.price.toLocaleString('en-IN')}
                              </strong>
                            </div>
                          ))}
                          {customPackagePricing.discountAmount > 0 && (
                            <div className="flex items-center justify-between gap-3 text-[13px] text-[#4C6545] pt-1">
                              <span>10% package discount (3+ services)</span>
                              <strong className="font-mono-tabular shrink-0">
                                −₹{customPackagePricing.discountAmount.toLocaleString('en-IN')}
                              </strong>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#79756C]">Services selected</span>
                        <strong className="font-mono-tabular text-[#292720]">
                          {customPackagePricing.serviceCount}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#79756C]">Estimated duration</span>
                        <strong className="font-mono-tabular text-[#292720]">
                          {customPackagePricing.totalDurationMinutes} min
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-[#E7DED1] pt-4 mt-4 text-[19px] font-bold">
                        <span>Total</span>
                        <strong className="font-mono-tabular text-[#292720]">
                          ₹{customPackagePricing.totalAmount.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>

                    <p className="text-xs text-[#4C6545] font-medium my-4">
                      {customPackagePricing.serviceCount >= 3
                        ? `You saved ₹${customPackagePricing.discountAmount.toLocaleString(
                            'en-IN'
                          )} (10% off) with your custom package.`
                        : `Select ${Math.max(
                            1,
                            3 - customPackagePricing.serviceCount
                          )} more service(s) to unlock automatic 10% package savings.`}
                    </p>

                    <button
                      type="button"
                      disabled={customPackagePricing.serviceCount === 0}
                      onClick={() => navigateToPage('book')}
                      className="ops-btn w-full"
                    >
                      <span>Continue to Booking →</span>
                    </button>
                  </aside>
                </div>
              </div>
            </section>

            {/* EMPLOYEE SHOWCASE SECTION CONNECTED TO LIVE ROSTER & AVAILABILITY */}
            <section className="py-16 sm:py-24" id="team">
              <div className="ops-container space-y-10">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div className="max-w-[650px]">
                    <div className="ops-eyebrow">The People Behind the Craft</div>
                    <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2.5 mb-3">
                      Meet your grooming specialists.
                    </h2>
                    <p className="text-[#79756C] text-sm sm:text-base m-0">
                      Get to know your stylist, their qualified services, and live today’s schedule
                      ({todayStr}) before choosing who will take care of your next appointment.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToPage('stylists')}
                    className="ops-btn-outline text-xs"
                  >
                    <span>Inspect Full Stylist Schedules ({employees.length}) →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {employees.map((emp) => {
                    const openSlotsToday = (emp.availableSlots || TIME_SLOTS).filter(
                      (slot) =>
                        checkEmployeeAvailability({
                          employee: emp,
                          appointmentDate: todayStr,
                          timeSlot: slot,
                          existingBookings: bookings,
                          allServices: services,
                          businessProfile,
                        }).available
                    );

                    return (
                      <article key={emp.id} className="ops-card flex flex-col justify-between">
                        <div>
                          <div className="h-[270px] bg-white p-3 overflow-hidden border-b border-[#E7DED1] relative flex items-center justify-center">
                            <img
                              src={emp.portraitUrl || SALON_UPLOADED_ASSETS.empPortraitAarav}
                              alt={`${emp.name} — ${emp.role}`}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/employees/emp-aarav.svg';
                              }}
                              className="w-full h-full object-contain object-center"
                            />
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#FAF7F2]/95 border border-[#E7DED1] text-[11px] font-mono-tabular text-[#292720]">
                              ★ {emp.rating} · {emp.experienceYears} yrs
                            </div>
                          </div>

                          <div className="p-6 space-y-3">
                            <div className="text-[#9A7950] text-[11px] font-bold tracking-[1px] uppercase">
                              {emp.role}
                            </div>
                            <h3 className="font-serif-display text-2xl text-[#292720] m-0">
                              {emp.name}
                            </h3>
                            <p className="text-[#79756C] text-[13px] leading-relaxed m-0">
                              {emp.bio}
                            </p>

                            <div className="pt-1 text-xs text-[#79756C]">
                              <strong className="text-[#292720]">Qualified Services:</strong>{' '}
                              {(emp.offeredServiceIds || [])
                                .map((id) => getServiceById(id)?.name)
                                .filter(Boolean)
                                .join(' · ')}
                            </div>

                            {/* Prototype-aligned Availability Pill + Live Quick Slot Buttons */}
                            <div className="pt-1">
                              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#EDF1E8] text-[#4C6545] text-[11px] font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#65835C]" />
                                {emp.active
                                  ? `${openSlotsToday.length} slots open today (${emp.shiftHours})`
                                  : 'Currently on leave'}
                              </span>
                            </div>

                            {emp.active && openSlotsToday.length > 0 && (
                              <div className="space-y-1.5 pt-2">
                                <div className="text-[11px] font-semibold text-[#292720]">
                                  Quick-select an available slot today:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {openSlotsToday.slice(0, 4).map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => {
                                        setPreselectedEmployeeId(emp.id);
                                        setPreselectedDate(todayStr);
                                        setPreselectedSlot(slot);
                                        navigateToPage('book');
                                      }}
                                      className="px-2 py-1 text-[10px] font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1] text-[#292720] hover:border-[#9A7950] hover:bg-[#9A7950] hover:text-white transition-colors cursor-pointer"
                                    >
                                      {slot.replace(' - ', '–')}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-3 border-t border-[#E7DED1]">
                          <button
                            type="button"
                            onClick={() => {
                              setPreselectedEmployeeId(emp.id);
                              navigateToPage('book');
                            }}
                            className="ops-btn w-full text-xs"
                          >
                            <span>Book with {emp.name.split(' ')[0]} →</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* FLAGSHIP STUDIO & INTERIOR GALLERY SHOWCASE */}
            <SalonStudioInteriorGallery onBookStudioVisit={() => navigateToPage('book')} />

            {/* HOME CONTACT & CONCIERGE DESK SUMMARY */}
            <section id="home-contact" className="py-14 sm:py-20 bg-[#FAF7F2] border-t border-[#E7DED1]">
              <div className="ops-container space-y-8">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div className="max-w-2xl">
                    <div className="ops-eyebrow">
                      {salonName} Concierge · {shortLocation}
                    </div>
                    <h2 className="font-serif-display text-3xl sm:text-[42px] text-[#292720] mt-2 mb-3">
                      Get in touch or verify your booking.
                    </h2>
                    <p className="text-[#79756C] text-sm sm:text-base m-0">
                      Reach our {shortLocation} studio desk directly for single or multi-member
                      appointments, home concierge inquiries, or privacy-verified booking messages.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToPage('contact')}
                    className="ops-btn-outline text-xs cursor-pointer"
                  >
                    <span>Open Full Contact & Booking Lookup →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="ops-card p-6 bg-white space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
                      Phone & WhatsApp Concierge
                    </div>
                    <h3 className="font-serif-display text-xl text-[#292720]">
                      {primaryPhone || businessProfile.whatsappNumber || 'Direct Studio Desk'}
                    </h3>
                    <p className="text-xs text-[#79756C] leading-relaxed m-0">
                      Instant coordination for studio slots, custom packages, and home visits across
                      14 Hyderabad localities.
                    </p>
                  </div>

                  <div className="ops-card p-6 bg-white space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
                      Flagship Studio Location
                    </div>
                    <h3 className="font-serif-display text-xl text-[#292720]">
                      {shortLocation}
                    </h3>
                    <p className="text-xs text-[#79756C] leading-relaxed m-0">
                      {fullSalonAddress || `${shortLocation} · ${hoursSummary || 'Open Daily'}`}
                    </p>
                  </div>

                  <div className="ops-card p-6 bg-white space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
                      Official Email & Group Desk
                    </div>
                    <h3 className="font-serif-display text-xl text-[#292720] break-all">
                      {officialEmail || 'Reservations & Wedding Parties'}
                    </h3>
                    <p className="text-xs text-[#79756C] leading-relaxed m-0">
                      Dedicated scheduling for 1–6 member family, groom, and event bookings.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* CLIENT REVIEWS SECTION BELOW CONTACT */}
            <ClientReviewsSection
              salonName={salonName}
              shortLocation={shortLocation}
              services={services}
              employees={employees}
              onNavigateToBook={() => navigateToPage('book')}
            />

            {/* FAQ SECTION BELOW CONTACT & REVIEWS (POLICIES, DURATIONS, HYDERABAD PAYMENTS) */}
            <SalonFaqSection
              salonName={salonName}
              shortLocation={shortLocation}
              services={services}
              employees={employees}
              businessProfile={businessProfile}
              onNavigateToBook={() => navigateToPage('book')}
              onNavigateToServices={() => navigateToPage('services')}
              onNavigateToContact={() => navigateToPage('contact')}
            />

            {/* DARK EDITORIAL BOOKING BANNER (FROM PROTOTYPE) */}
            <section className="bg-[#292720] text-white py-16">
              <div className="ops-container flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-[620px]">
                  <div className="ops-eyebrow" style={{ color: '#D0B48B' }}>
                    Your Next Appointment
                  </div>
                  <h2 className="font-serif-display text-3xl sm:text-[42px] text-white mt-2 mb-2.5">
                    A little time for yourself goes a long way.
                  </h2>
                  <p className="text-[#D1C9BD] text-sm sm:text-[15px] m-0">
                    Choose your services, configure 1 to 6 members, select your preferred stylist,
                    and lock in an appointment across Hyderabad with zero double-booking conflicts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigateToPage('book')}
                  className="min-h-[48px] px-6 py-3 bg-[#FAF7F2] text-[#292720] border border-[#FAF7F2] text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#9A7950] hover:border-[#9A7950] hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  <span>Explore & Book</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </section>
          </div>
        )}

        {/* PAGE 2: FULL SERVICES CATALOG & CUSTOM PACKAGE BUILDER + SUMMARY VIEW */}
        {activePage === 'services' && (
          <div className="ops-container py-10 sm:py-14 space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="ops-eyebrow">
                  {salonName} · Complete Grooming Menu & Custom Package Builder
                </div>
                <h1 className="font-serif-display text-3xl sm:text-5xl text-[#292720] mt-2">
                  Select Services & Build Your Custom Package
                </h1>
                <p className="text-sm text-[#79756C] mt-2">
                  Combine any services below (e.g., Haircut + Beard Sculpt + Ayurvedic Head
                  Massage). Select 3 or more services to automatically unlock 10% package discount.
                </p>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F3EDE2] border border-[#E7DED1]">
                {(
                  [
                    'ALL',
                    'Haircut & Styling',
                    'Beard & Shave',
                    'Head & Body Massage',
                    'Spa & Skin Rituals',
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setServiceCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      serviceCategoryFilter === cat
                        ? 'bg-[#292720] text-white'
                        : 'text-[#79756C] hover:text-[#292720]'
                    }`}
                  >
                    {cat === 'ALL' ? `All Services (${services.length})` : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Gallery & Owner Image Upload Guide Banner */}
            <div className="ops-card p-5 bg-[#FAF7F2] border border-[#E7DED1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
                    Service Gallery Plates (01 · 02 · 03) & Direct Owner Image Uploads
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#79756C]">
                    · Click 01, 02, 03 on any service card to switch between 3 distinct plates
                  </span>
                </div>
                <p className="text-xs text-[#79756C] leading-relaxed m-0">
                  Every service image scales cleanly inside a white frame (<code className="font-mono-tabular">object-contain</code>) with zero cropping. In the <strong className="text-[#292720]">Owner Portal → Services &amp; Gallery</strong> tab, the admin can directly upload images for Plates 01, 02, and 03, edit any service, create new services in any sector, or delete services — and save to update everywhere immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOwnerPortalClick}
                className="ops-btn-outline text-xs py-2 px-3.5 shrink-0 cursor-pointer"
              >
                <span>Manage Services &amp; Upload Photos →</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 8 Columns: Selectable Services Grid */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                {filteredServices.map((service) => {
                  const isSelected = selectedPackageServiceIds.includes(service.id);
                  const qualifiedEmployees = employees.filter(
                    (emp) => emp.active && (emp.offeredServiceIds || []).includes(service.id)
                  );

                  return (
                    <article
                      key={service.id}
                      className={`group ops-card flex flex-col justify-between transition-all ${
                        isSelected ? 'ring-2 ring-[#9A7950]' : ''
                      }`}
                    >
                      <div>
                        <ServiceMultiImageGallery
                          plates={service.plates}
                          serviceName={service.name}
                        />
                        <div className="p-5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#79756C]">
                            <span className="text-[#9A7950] font-bold tracking-[1.6px] uppercase text-[10px]">
                              SERVICE / {service.code} · {service.category}
                            </span>
                            <span className="font-mono-tabular">
                              {service.durationMinutes} mins
                            </span>
                          </div>

                          <h3 className="text-xl font-serif-display font-medium text-[#292720]">
                            {service.name}
                          </h3>
                          <p className="text-xs text-[#79756C] leading-relaxed">
                            {service.description}
                          </p>

                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-semibold text-[#292720]">
                              Included Ritual Steps:
                            </div>
                            <ul className="text-[11px] text-[#79756C] space-y-0.5 pl-4 list-disc">
                              {service.includedSteps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="pt-1 text-[11px] text-[#79756C]">
                            <strong className="text-[#292720]">Specialists Offering This:</strong>{' '}
                            {qualifiedEmployees.map((e) => e.name.split(' ')[0]).join(', ')}
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-4 bg-[#FAF7F2] border-t border-[#E7DED1] flex items-center justify-between gap-3">
                        <div>
                          <span className="text-lg font-mono-tabular font-bold text-[#292720]">
                            ₹{service.price.toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[10px] text-[#79756C]">
                            Inclusive of taxes
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => togglePackageService(service.id)}
                            className={`px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#9A7950] border-[#9A7950] text-white'
                                : 'bg-white border-[#292720] text-[#292720] hover:bg-[#9A7950] hover:border-[#9A7950] hover:text-white'
                            }`}
                          >
                            {isSelected ? '✓ In Custom Package' : '+ Add to Package'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Right 4 Columns: Dedicated Custom Package Summary View Before Booking */}
              <aside className="lg:col-span-4 lg:sticky lg:top-28 ops-card p-6 space-y-5 min-w-0">
                <div className="border-b border-[#E7DED1] pb-4">
                  <div className="flex items-center gap-2 ops-eyebrow">
                    <PackagePlus className="w-4 h-4 shrink-0" />
                    <span>Custom Service Package Summary</span>
                  </div>
                  <h3 className="text-2xl font-serif-display font-medium text-[#292720] mt-1">
                    Your Combined Grooming Package
                  </h3>
                  <p className="text-xs text-[#79756C] mt-1">
                    Review your selected services and dynamic price breakdown before proceeding to
                    booking.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[#79756C]">
                    Popular Combinations:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPackageServiceIds([
                          'srv-haircut',
                          'srv-beard',
                          'srv-head-massage',
                        ])
                      }
                      className="px-2.5 py-1 text-[11px] bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                    >
                      Haircut + Beard + Champi (10% Off)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPackageServiceIds([
                          'srv-haircut',
                          'srv-keratin-spa',
                          'srv-facial',
                        ])
                      }
                      className="px-2.5 py-1 text-[11px] bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                    >
                      Cut + Keratin + Saffron Facial (10% Off)
                    </button>
                  </div>
                </div>

                {/* Selected Items List */}
                {customPackagePricing.selectedServices.length === 0 ? (
                  <div className="p-6 bg-[#FAF7F2] border border-[#E7DED1] text-center text-xs text-[#79756C]">
                    No services selected yet. Click “+ Add to Package” on any service card to start
                    building your custom package.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {customPackagePricing.selectedServices.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 bg-[#FAF7F2] border border-[#E7DED1] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#292720] truncate">
                            0{idx + 1}. {item.name}
                          </div>
                          <div className="text-[11px] text-[#79756C] font-mono-tabular">
                            {item.durationMinutes} mins · {item.category}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-tabular font-semibold text-[#292720]">
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePackageService(item.id)}
                            className="text-[#79756C] hover:text-[#991B1B]"
                            title="Remove from package"
                            aria-label={`Remove ${item.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dynamic Price Summary Calculation */}
                <div className="p-4 bg-[#F3EDE2] border border-[#E7DED1] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#79756C]">
                    <span>Selected Services ({customPackagePricing.serviceCount})</span>
                    <span className="font-mono-tabular text-[#292720]">
                      ₹{customPackagePricing.subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#79756C]">
                    <span>Combined Session Duration</span>
                    <span className="font-mono-tabular text-[#292720]">
                      {customPackagePricing.totalDurationMinutes} mins
                    </span>
                  </div>
                  {customPackagePricing.discountAmount > 0 ? (
                    <div className="flex items-center justify-between text-[#4C6545] font-semibold">
                      <span>10% Package Bundle Discount (3+ services)</span>
                      <span className="font-mono-tabular">
                        −₹{customPackagePricing.discountAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#9A7950] font-medium">
                      Select {Math.max(1, 3 - customPackagePricing.serviceCount)} more service(s)
                      to unlock automatic 10% package discount.
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-bold text-[#292720] pt-2 border-t border-[#E7DED1]">
                    <span>Package Total</span>
                    <span className="text-xl font-mono-tabular text-[#9A7950]">
                      ₹{customPackagePricing.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={customPackagePricing.serviceCount === 0}
                  onClick={() => navigateToPage('book')}
                  className="ops-btn w-full text-xs"
                >
                  <span>
                    Proceed to Book Package (₹
                    {customPackagePricing.totalAmount.toLocaleString('en-IN')}) →
                  </span>
                </button>
              </aside>
            </div>
          </div>
        )}

        {/* PAGE 3: 7-STEP MULTI-MEMBER BOOKING & CUSTOM PACKAGE FLOW */}
        {activePage === 'book' && (
          <BookingAndPackageBuilder
            services={services}
            employees={employees}
            bookings={bookings}
            businessProfile={businessProfile}
            storageKey={STORAGE_KEYS.BOOKINGS}
            preselectedServiceIds={selectedPackageServiceIds}
            preselectedEmployeeId={preselectedEmployeeId}
            preselectedDate={preselectedDate}
            preselectedSlot={preselectedSlot}
            onTogglePreselectedService={togglePackageService}
            onCompleteBooking={handleCompleteBooking}
          />
        )}

        {/* PAGE 4: CUSTOMER-FACING EMPLOYEE PROFILES, OFFERED SERVICES & LIVE SCHEDULE AVAILABILITY */}
        {activePage === 'stylists' && (
          <div className="ops-container py-10 sm:py-14 space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="ops-eyebrow">
                  {salonName} Specialists · Qualified Services & Individual Schedules
                </div>
                <h1 className="font-serif-display text-3xl sm:text-5xl text-[#292720] mt-2">
                  Meet Your Grooming Specialists & Check Live Availability
                </h1>
                <p className="text-sm text-[#79756C] mt-2">
                  Inspect each employee’s qualified services, working days, shift hours, and
                  real-time slot availability. Any slot where an employee is already booked, on
                  break, or off-duty is locked to prevent double-booking.
                </p>
              </div>

              {/* Date Picker to Check Employee Availability on Any Date */}
              <div className="ops-card px-4 py-3 flex items-center gap-3 shrink-0">
                <label
                  htmlFor="stylist-date-picker"
                  className="text-xs font-semibold text-[#292720] whitespace-nowrap"
                >
                  Check Availability Date:
                </label>
                <input
                  id="stylist-date-picker"
                  type="date"
                  min={todayStr}
                  value={stylistScheduleDate}
                  onChange={(e) => setStylistScheduleDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {employees.map((emp) => {
                const empServices = (emp.offeredServiceIds || [])
                  .map((id) => getServiceById(id))
                  .filter((s): s is ServiceItem => Boolean(s));

                const slotStates = TIME_SLOTS.map((slot) => ({
                  slot,
                  status: checkEmployeeAvailability({
                    employee: emp,
                    appointmentDate: stylistScheduleDate,
                    timeSlot: slot,
                    existingBookings: bookings,
                    allServices: services,
                    businessProfile,
                  }),
                }));

                const openCount = slotStates.filter((s) => s.status.available).length;

                return (
                  <article
                    key={emp.id}
                    className="ops-card p-6 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E7DED1] pb-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-16 h-16 bg-white p-1 border border-[#E7DED1] overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                              src={emp.portraitUrl || SALON_UPLOADED_ASSETS.empPortraitAarav}
                              alt={emp.name}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/employees/emp-aarav.svg';
                              }}
                              className="w-full h-full object-contain object-center"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[#9A7950] text-[11px] font-bold tracking-[1px] uppercase">
                              {emp.role}
                            </div>
                            <h3 className="text-2xl font-serif-display font-medium text-[#292720] mt-0.5">
                              {emp.name}
                            </h3>
                            <div className="text-xs text-[#79756C] font-mono-tabular mt-0.5">
                              {emp.experienceYears} Yrs Exp · Shift: {emp.shiftHours} · ★{' '}
                              {emp.rating} ({emp.completedAppointments} bookings)
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium shrink-0 ${
                            emp.active
                              ? 'bg-[#EDF1E8] text-[#4C6545]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.active ? 'bg-[#4C6545]' : 'bg-[#92400E]'
                            }`}
                          />
                          {emp.active ? 'Available for Booking' : 'Currently On Leave'}
                        </span>
                      </div>

                      <p className="text-xs text-[#79756C] leading-relaxed">{emp.bio}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#79756C]">
                        <span>
                          Primary Coverage:{' '}
                          <strong className="text-[#292720]">{emp.primaryZone}</strong>
                        </span>
                        {emp.workingDays && emp.workingDays.length > 0 && (
                          <span>
                            Working Days:{' '}
                            <strong className="text-[#292720]">
                              {emp.workingDays.map((d) => d.slice(0, 3)).join(', ')}
                            </strong>
                          </span>
                        )}
                      </div>

                      {/* Offered Services by This Employee */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[#292720]">
                          Services Performed by {emp.name.split(' ')[0]} (Click to toggle in your
                          package):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {empServices.map((srv) => {
                            const inPkg = selectedPackageServiceIds.includes(srv.id);
                            return (
                              <button
                                key={srv.id}
                                type="button"
                                onClick={() => togglePackageService(srv.id)}
                                className={`px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                                  inPkg
                                    ? 'bg-[#9A7950] border-[#9A7950] text-white font-semibold'
                                    : 'bg-[#FAF7F2] border-[#E7DED1] text-[#292720] hover:border-[#9A7950]'
                                }`}
                              >
                                {srv.name} (₹{srv.price}) {inPkg ? '✓' : '+'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Individual Schedule & Double-Booking Status Grid */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#292720]">
                            Schedule on {stylistScheduleDate} (Click any OPEN slot to book):
                          </span>
                          <span className="text-[11px] text-[#4C6545] font-mono-tabular font-semibold">
                            {openCount} open slots
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {slotStates.map(({ slot, status }) => {
                            const isBooked = status.reason === 'ALREADY_BOOKED';
                            const isOff = !status.available && !isBooked;

                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={!status.available}
                                onClick={() => {
                                  setPreselectedEmployeeId(emp.id);
                                  setPreselectedDate(stylistScheduleDate);
                                  setPreselectedSlot(slot);
                                  navigateToPage('book');
                                }}
                                title={status.message}
                                className={`px-2.5 py-2 border text-[11px] font-mono-tabular flex items-center justify-between transition-colors ${
                                  isBooked
                                    ? 'bg-[#F3EDE2] border-[#991B1B]/30 text-[#991B1B] cursor-not-allowed'
                                    : isOff
                                    ? 'bg-[#F3EDE2]/40 border-[#E7DED1] text-[#79756C]/50 cursor-not-allowed'
                                    : 'bg-[#FAF7F2] border-[#4C6545]/35 text-[#4C6545] hover:bg-[#292720] hover:border-[#292720] hover:text-white cursor-pointer'
                                }`}
                              >
                                <span className="truncate">{slot.replace(' - ', '–')}</span>
                                <span className="font-semibold ml-1 text-[10px]">
                                  {isBooked ? 'BOOKED' : isOff ? 'OFF' : 'OPEN'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E7DED1] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-[#79756C]">
                        Real-time double-booking prevention active
                      </span>
                      <button
                        type="button"
                        disabled={!emp.active}
                        onClick={() => {
                          setPreselectedEmployeeId(emp.id);
                          setPreselectedDate(stylistScheduleDate);
                          navigateToPage('book');
                        }}
                        className="ops-btn text-xs py-2 px-4"
                      >
                        <span>Select {emp.name.split(' ')[0]} & Book →</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* PAGE 5: CONTACT US, CENTRALIZED SALON PROFILE & PRIVACY-VERIFIED CLIENT MESSAGE PORTAL */}
        {activePage === 'contact' && (
          <div>
            <div className="ops-container py-10 sm:py-14 space-y-10">
              <div className="max-w-2xl">
              <div className="ops-eyebrow">
                {salonName} · Official Contact Details & Appointment Message Lookup
              </div>
              <h1 className="font-serif-display text-3xl sm:text-5xl text-[#292720] mt-2">
                Contact {salonName} & Check Your Booking Messages
              </h1>
              <p className="text-sm text-[#79756C] mt-2">
                Reach out to {salonName} in {shortLocation}, or enter your Booking Reference and
                registered phone number below to check updates from the salon desk.
              </p>
            </div>

            {!hasAnySavedContact && (
              <div className="ops-card p-6 bg-[#F3EDE2]/60 border border-[#E7DED1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#9A7950]">
                    Official Contact Information
                  </div>
                  <p className="text-sm text-[#292720] font-medium m-0">
                    Contact details will be updated soon.
                  </p>
                  <p className="text-xs text-[#79756C] m-0">
                    You can still book your appointment online or use the callback request form and
                    booking message lookup below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPage('book')}
                  className="ops-btn text-xs shrink-0"
                >
                  <span>Book Appointment Online</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Phone & WhatsApp */}
              <div className="ops-card p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-[#EDF1E8] text-[#4C6545] flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-[#292720]">
                    Phone & WhatsApp Desk
                  </h3>
                  <p className="text-xs text-[#79756C]">
                    Direct assistance for studio appointments, home-visit coordination, and custom
                    grooming packages.
                  </p>
                  {primaryPhone || secondaryPhone || whatsappDigits ? (
                    <div className="space-y-1 pt-1 text-xs font-mono-tabular text-[#292720]">
                      {primaryPhone && (
                        <div>
                          <span className="text-[#79756C]">Primary: </span>
                          <a href={`tel:${primaryPhone}`} className="font-semibold hover:underline">
                            {primaryPhone}
                          </a>
                        </div>
                      )}
                      {secondaryPhone && (
                        <div>
                          <span className="text-[#79756C]">Alternate: </span>
                          <a
                            href={`tel:${secondaryPhone}`}
                            className="font-semibold hover:underline"
                          >
                            {secondaryPhone}
                          </a>
                        </div>
                      )}
                      {businessProfile.whatsappNumber?.trim() && (
                        <div>
                          <span className="text-[#79756C]">WhatsApp: </span>
                          <span className="font-semibold">
                            {businessProfile.whatsappNumber.trim()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#79756C] italic pt-1">
                      Contact details will be updated soon.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {whatsappDigits && (
                    <a
                      href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                        `Hello ${salonName}, I would like to inquire about an appointment.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ops-btn text-xs flex-1"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  )}
                  {primaryPhone && (
                    <a href={`tel:${primaryPhone}`} className="ops-btn-outline text-xs flex-1">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>Call Desk</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Card 2: Official Email */}
              <div className="ops-card p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-[#F3EDE2] text-[#9A7950] flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-[#292720]">
                    Official Email & Event Inquiries
                  </h3>
                  <p className="text-xs text-[#79756C]">
                    For wedding group bookings, multi-member grooming schedules, or general salon
                    inquiries.
                  </p>
                  {officialEmail ? (
                    <div className="text-sm font-mono-tabular font-semibold text-[#292720] break-all pt-1">
                      {officialEmail}
                    </div>
                  ) : (
                    <div className="text-xs text-[#79756C] italic pt-1">
                      Contact details will be updated soon.
                    </div>
                  )}
                </div>

                {officialEmail && (
                  <a
                    href={`mailto:${officialEmail}?subject=${encodeURIComponent(
                      `${salonName} Appointment Inquiry`
                    )}`}
                    className="ops-btn-outline text-xs w-full"
                  >
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>Send Direct Email</span>
                  </a>
                )}
              </div>

              {/* Card 3: Studio Location & Opening Hours */}
              <div className="ops-card p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-[#F3EDE2] text-[#292720] flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-[#292720]">
                    Studio Location & Hours
                  </h3>
                  {fullSalonAddress ? (
                    <p className="text-xs text-[#79756C] leading-relaxed">{fullSalonAddress}</p>
                  ) : (
                    <p className="text-xs text-[#79756C]">
                      {shortLocation} · Detailed street address will be updated soon.
                    </p>
                  )}

                  {hoursSummary ? (
                    <div className="text-xs font-mono-tabular text-[#9A7950] flex items-center gap-1.5 pt-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{hoursSummary}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#79756C] italic">
                      Opening hours will be updated soon.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ops-btn-outline text-xs flex-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>Open in Maps</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateToPage('book')}
                    className="ops-btn-outline text-xs flex-1"
                  >
                    <span>Book Appointment</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Privacy-Protected Booking Lookup */}
              <div className="lg:col-span-7 ops-card p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 ops-eyebrow">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Privacy-Protected Booking Lookup</span>
                  </div>
                  <h2 className="text-2xl font-serif-display font-medium text-[#292720] mt-1">
                    Check Messages from Salon Owner / Reply to Your Booking
                  </h2>
                  <p className="text-xs text-[#79756C]">
                    To protect customer privacy, enter both your{' '}
                    <strong className="text-[#292720]">Booking Reference</strong> and the{' '}
                    <strong className="text-[#292720]">Phone Number</strong> used when booking.
                  </p>
                </div>

                <form
                  onSubmit={handleVerifyBookingLookup}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="lookup-ref-input"
                      className="block text-[11px] font-semibold text-[#292720] mb-1"
                    >
                      Booking Reference *
                    </label>
                    <input
                      id="lookup-ref-input"
                      type="text"
                      required
                      value={lookupBookingRef}
                      onChange={(e) => setLookupBookingRef(e.target.value)}
                      placeholder="e.g. NZM-8401"
                      className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="lookup-phone-input"
                      className="block text-[11px] font-semibold text-[#292720] mb-1"
                    >
                      Registered Phone Number *
                    </label>
                    <input
                      id="lookup-phone-input"
                      type="tel"
                      required
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      placeholder="+91 98XXXXXXXX"
                      className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={isLookingUpBooking}
                      className="ops-btn text-xs py-2 px-3 w-full"
                    >
                      <Search className="w-3.5 h-3.5 shrink-0" />
                      <span>{isLookingUpBooking ? '...' : 'Verify'}</span>
                    </button>
                  </div>
                </form>

                {lookupError && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#991B1B]/30 text-xs text-[#991B1B]">
                    {lookupError}
                  </div>
                )}

                {verifiedBookingForLookup ? (
                  <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED1] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono-tabular font-semibold text-[#9A7950]">
                            {verifiedBookingForLookup.bookingRef}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#EDF1E8] text-[#4C6545] border border-[#4C6545]/20">
                            {verifiedBookingForLookup.status}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-[#292720] mt-0.5">
                          {verifiedBookingForLookup.customerName} ·{' '}
                          {verifiedBookingForLookup.hyderabadArea}
                        </h4>
                      </div>
                      <div className="text-xs font-mono-tabular text-[#79756C]">
                        {verifiedBookingForLookup.appointmentDate} ·{' '}
                        {verifiedBookingForLookup.timeSlot}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {verifiedBookingForLookup.messages.length === 0 ? (
                        <p className="text-xs text-[#79756C]">
                          No messages on this booking yet. Send a note below to alert the{' '}
                          {salonName} desk.
                        </p>
                      ) : (
                        verifiedBookingForLookup.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`p-3 text-xs border ${
                              m.sender === 'Shop Owner'
                                ? 'bg-[#F3EDE2] border-[#9A7950]/40'
                                : 'bg-white border-[#E7DED1]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-[#79756C] font-mono-tabular mb-1">
                              <strong>
                                {m.sender} ({m.channel})
                              </strong>
                              <span>{m.sentAt}</span>
                            </div>
                            <div>{m.content}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {replyStatusBanner && (
                      <div className="p-2 bg-[#EDF1E8] text-[#4C6545] text-xs flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{replyStatusBanner}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        aria-label="Write a reply to the salon"
                        value={customerReplyDraft}
                        onChange={(e) => setCustomerReplyDraft(e.target.value)}
                        placeholder={`Send a message to the ${salonName} desk...`}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendCustomerReply(verifiedBookingForLookup.id)}
                        className="ops-btn text-xs py-2 px-4"
                      >
                        <span>Send Message</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] text-xs text-[#79756C]">
                    Enter your Booking Reference and registered phone number above to view your
                    appointment status and message thread.
                  </div>
                )}
              </div>

              {/* Callback Request Form */}
              <div className="lg:col-span-5 ops-card p-6 space-y-4">
                <div className="ops-eyebrow">Concierge Callback</div>
                <h2 className="text-2xl font-serif-display font-medium text-[#292720]">
                  Request a Callback from Our {businessProfile.city || 'Hyderabad'} Desk
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setContactSubmittedBanner(
                      `Thank you ${
                        contactInquiryName || 'Guest'
                      }, our ${salonName} desk will contact you on ${contactInquiryPhone} shortly.`
                    );
                    setContactInquiryMsg('');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactInquiryName}
                      onChange={(e) => setContactInquiryName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#292720] mb-1">
                        WhatsApp / Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={contactInquiryPhone}
                        onChange={(e) => setContactInquiryPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#292720] mb-1">
                        Hyderabad Locality
                      </label>
                      <select
                        value={contactInquiryArea}
                        onChange={(e) => setContactInquiryArea(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                      >
                        {HYDERABAD_AREAS.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      How can we assist you? *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={contactInquiryMsg}
                      onChange={(e) => setContactInquiryMsg(e.target.value)}
                      placeholder="Ask about group bookings, custom packages, or home visit availability..."
                      className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                    />
                  </div>
                  {contactSubmittedBanner && (
                    <div className="p-2.5 bg-[#EDF1E8] text-[#4C6545] text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{contactSubmittedBanner}</span>
                    </div>
                  )}
                  <button type="submit" className="ops-btn w-full text-xs">
                    <span>Submit Callback Request</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* CLIENT REVIEWS SECTION DISPLAYED BELOW CONTACT */}
          <ClientReviewsSection
            salonName={salonName}
            shortLocation={shortLocation}
            services={services}
            employees={employees}
            onNavigateToBook={() => navigateToPage('book')}
          />

          {/* FAQ COMPONENT DISPLAYED BELOW CONTACT (POLICIES, SERVICE DURATIONS & HYDERABAD PAYMENTS) */}
          <SalonFaqSection
            salonName={salonName}
            shortLocation={shortLocation}
            services={services}
            employees={employees}
            businessProfile={businessProfile}
            onNavigateToBook={() => navigateToPage('book')}
            onNavigateToServices={() => navigateToPage('services')}
          />
        </div>
        )}

        {/* PAGE 6: SHOP OWNER / ADMIN DASHBOARD */}
        {activePage === 'admin' && isAdminAuthenticated && (
          <AdminDashboard
            bookings={bookings}
            employees={employees}
            services={services}
            businessProfile={businessProfile}
            onUpdateBooking={handleUpdateBooking}
            onSendAdminMessage={handleSendAdminMessage}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onToggleEmployeeActive={handleToggleEmployeeActive}
            onRemoveEmployee={handleRemoveEmployee}
            onAddService={handleAddService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
            onSaveBusinessProfile={handleSaveBusinessProfile}
            onUploadEmployeeImage={handleUploadEmployeeImage}
            onUploadServiceImage={handleUploadServiceImage}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* SHOP OWNER / ADMIN LOGIN MODAL (BLANK FIELDS ON OPEN, NO CREDENTIALS EXPOSED IN UI) */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-[#292720]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-login-title"
        >
          <div className="ops-card max-w-md w-full p-7 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED1] pb-4">
              <div>
                <div className="ops-eyebrow">{salonName} · Restricted Access</div>
                <h3
                  id="owner-login-title"
                  className="text-2xl font-serif-display font-medium text-[#292720] mt-1"
                >
                  Shop Owner & Admin Login
                </h3>
                <p className="text-xs text-[#79756C] mt-1">
                  Enter your owner username and passcode to manage appointments, stylists, and
                  business settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginUsername('');
                  setLoginPasscode('');
                  setLoginError(null);
                }}
                className="p-1.5 text-[#79756C] hover:text-[#292720]"
                aria-label="Close login modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label
                  htmlFor="owner-username"
                  className="block text-xs font-semibold text-[#292720] mb-1"
                >
                  Username
                </label>
                <input
                  id="owner-username"
                  type="text"
                  required
                  autoComplete="off"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter username"
                  disabled={isLoggingIn}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-passcode"
                  className="block text-xs font-semibold text-[#292720] mb-1"
                >
                  Passcode
                </label>
                <div className="relative">
                  <input
                    id="owner-passcode"
                    type={showPasscode ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={loginPasscode}
                    onChange={(e) => setLoginPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    disabled={isLoggingIn}
                    className="w-full px-3.5 py-2.5 pr-10 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#79756C] hover:text-[#292720]"
                    aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPasscode ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#991B1B]/30 text-xs text-[#991B1B]">
                  {loginError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => {
                    setShowLoginModal(false);
                    setLoginUsername('');
                    setLoginPasscode('');
                    setLoginError(null);
                  }}
                  className="ops-btn-outline text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="ops-btn text-xs py-2.5 px-5"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>{isLoggingIn ? 'Signing In...' : 'Sign In to Owner Portal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROTOTYPE-ALIGNED FOOTER CONNECTED TO CENTRALIZED BUSINESS PROFILE */}
      <footer className="bg-[#EDE5D9] border-t border-[#D8CEBF] py-12 mt-16">
        <div className="ops-container">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8">
            <div className="md:col-span-5 space-y-3">
              <button
                type="button"
                onClick={() => navigateToPage('dashboard')}
                className="text-left group cursor-pointer"
              >
                <span className="block font-serif-display text-[27px] font-semibold tracking-[3px] text-[#292720] leading-none">
                  {salonName.toUpperCase().startsWith('OPS') ? 'OPS' : salonName}
                </span>
                <small className="block text-[9px] font-sans tracking-[3px] text-[#79756C] text-center mt-1 uppercase">
                  {salonName.toUpperCase().startsWith('OPS') ? 'S A L O N' : shortLocation}
                </small>
              </button>
              <p className="text-xs text-[#79756C] max-w-sm leading-relaxed">
                {salonTagline} A considered approach to hair, grooming and personal care in{' '}
                {shortLocation}.
              </p>

              {(instagramUrl || facebookUrl || websiteUrl || googleMapsUrl) && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292720] hover:text-[#9A7950] font-medium underline underline-offset-4"
                    >
                      Instagram
                    </a>
                  )}
                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292720] hover:text-[#9A7950] font-medium underline underline-offset-4"
                    >
                      Facebook
                    </a>
                  )}
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292720] hover:text-[#9A7950] font-medium underline underline-offset-4"
                    >
                      Website
                    </a>
                  )}
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292720] hover:text-[#9A7950] font-medium underline underline-offset-4"
                    >
                      Google Maps
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-2">
              <h3 className="font-serif-display text-lg text-[#292720] mb-2">Explore</h3>
              <p>
                <button
                  type="button"
                  onClick={() => navigateToPage('services')}
                  className="text-xs text-[#79756C] hover:text-[#292720] cursor-pointer"
                >
                  Our Services (01 — 08)
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => navigateToPage('services')}
                  className="text-xs text-[#79756C] hover:text-[#292720] cursor-pointer"
                >
                  Custom Packages (10% Bundle Savings)
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => navigateToPage('stylists')}
                  className="text-xs text-[#79756C] hover:text-[#292720] cursor-pointer"
                >
                  Our Stylists & Live Schedules
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => navigateToPage('book')}
                  className="text-xs text-[#79756C] hover:text-[#292720] cursor-pointer"
                >
                  Book Appointment
                </button>
              </p>
            </div>

            <div className="md:col-span-4 space-y-2 text-xs text-[#79756C]">
              <h3 className="font-serif-display text-lg text-[#292720] mb-2">Studio & Contact</h3>
              {fullSalonAddress ? (
                <p className="text-[#292720] leading-relaxed">{fullSalonAddress}</p>
              ) : (
                <p>{shortLocation}</p>
              )}

              {primaryPhone && (
                <p className="font-mono-tabular">
                  Phone:{' '}
                  <a href={`tel:${primaryPhone}`} className="text-[#292720] hover:underline">
                    {primaryPhone}
                  </a>
                </p>
              )}
              {officialEmail && (
                <p className="font-mono-tabular">
                  Email:{' '}
                  <a href={`mailto:${officialEmail}`} className="text-[#292720] hover:underline">
                    {officialEmail}
                  </a>
                </p>
              )}
              {hoursSummary && <p className="font-mono-tabular text-[#9A7950]">{hoursSummary}</p>}
              {!hasAnySavedContact && (
                <p className="italic text-[#79756C]">Contact details will be updated soon.</p>
              )}

              <p className="pt-1">
                <button
                  type="button"
                  onClick={() => navigateToPage('contact')}
                  className="text-xs text-[#9A7950] font-semibold hover:underline cursor-pointer"
                >
                  Contact Desk & Booking Lookup →
                </button>
              </p>
            </div>
          </div>

          <div className="pt-5 border-t border-[#D8CEBF] flex flex-wrap items-center justify-between gap-4 text-xs text-[#79756C]">
            <span>
              © {new Date().getFullYear()} {salonName}. All rights reserved.
            </span>
            <span>{shortLocation}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
