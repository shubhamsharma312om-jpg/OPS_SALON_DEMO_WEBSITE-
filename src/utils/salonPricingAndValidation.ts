import { INITIAL_SERVICES, TIME_SLOTS } from '../data/initialSalonData';
import {
  BookingRecord,
  BusinessProfile,
  DayOfWeek,
  Employee,
  MemberGuest,
  ServiceItem,
} from '../types/salon';

export interface PackagePricingResult {
  selectedServices: ServiceItem[];
  serviceCount: number;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  homeVisitFee: number;
  totalAmount: number;
  totalDurationMinutes: number;
  isCustomPackage: boolean;
}

/**
 * Shared single-source-of-truth pricing calculation for custom service packages
 * and single/multi-member appointments.
 * Preserves existing service prices and automatic 10% discount for 3+ services.
 * Ensures the 10% package discount is calculated once and never applied twice.
 */
export function calculatePackagePricing(
  serviceIds: string[],
  allServices: ServiceItem[],
  serviceMode:
    | 'Flagship Studio (Jubilee Hills)'
    | 'Home / On-Location Service' = 'Flagship Studio (Jubilee Hills)'
): PackagePricingResult {
  const selectedServices: ServiceItem[] = [];
  for (const id of serviceIds) {
    const found = allServices.find((s) => s.id === id);
    if (found && Number.isFinite(found.price) && found.price >= 0) {
      selectedServices.push(found);
    }
  }

  const serviceCount = selectedServices.length;
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDurationMinutes = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  // Automatic 10% discount for 3 or more eligible services (applied exactly once on subtotal)
  const discountRate = serviceCount >= 3 ? 0.1 : 0;
  const discountAmount = Math.round(subtotal * discountRate);
  const homeVisitFee =
    serviceMode === 'Home / On-Location Service' && serviceCount > 0 ? 150 : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount + homeVisitFee);

  return {
    selectedServices,
    serviceCount,
    subtotal,
    discountRate,
    discountAmount,
    homeVisitFee,
    totalAmount,
    totalDurationMinutes,
    isCustomPackage: serviceCount >= 2,
  };
}

export interface MultiMemberPricingResult extends PackagePricingResult {
  allServiceIds: string[];
  itemizedRows: {
    memberId: string;
    memberLabel: string;
    service: ServiceItem;
    assignedEmployeeId: string;
    stylistName: string;
  }[];
}

export function calculateMultiMemberBookingPricing(
  members: MemberGuest[],
  allServices: ServiceItem[],
  allEmployees: Employee[],
  serviceMode: 'Flagship Studio (Jubilee Hills)' | 'Home / On-Location Service'
): MultiMemberPricingResult {
  const flattenedServiceIds: string[] = [];
  const uniqueServiceIds = new Set<string>();
  const itemizedRows: MultiMemberPricingResult['itemizedRows'] = [];

  for (const member of members) {
    const stylistName =
      allEmployees.find((e) => e.id === member.assignedEmployeeId)?.name ||
      'Assigned Stylist';
    for (const sid of member.serviceIds) {
      const srv = allServices.find((s) => s.id === sid);
      if (srv) {
        flattenedServiceIds.push(sid);
        uniqueServiceIds.add(sid);
        itemizedRows.push({
          memberId: member.id,
          memberLabel: member.label,
          service: srv,
          assignedEmployeeId: member.assignedEmployeeId,
          stylistName,
        });
      }
    }
  }

  const base = calculatePackagePricing(flattenedServiceIds, allServices, serviceMode);

  return {
    ...base,
    allServiceIds: Array.from(uniqueServiceIds),
    itemizedRows,
  };
}

/**
 * Parse a single time string like '09:00 AM', '12:30 PM', or '14:30' into minutes from 00:00.
 */
export function parseSingleTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();

  // 12-hour format e.g. '12:30 PM'
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (hours < 1 || hours > 12 || mins < 0 || mins > 59) return null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  // 24-hour format e.g. '14:30'
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
    return hours * 60 + mins;
  }

  return null;
}

/**
 * Parse a slot string like '12:00 PM - 01:00 PM' or '12:30 PM - 01:30 PM' into [startMinutes, endMinutes] from 00:00.
 */
export function parseSlotToMinutes(slot: string): [number, number] {
  const parts = slot.split(/\s*-\s*|\s*–\s*/);
  if (parts.length === 2) {
    const start = parseSingleTimeToMinutes(parts[0]);
    const end = parseSingleTimeToMinutes(parts[1]);
    if (start !== null && end !== null && end > start) {
      return [start, end];
    }
  }
  const singleStart = parseSingleTimeToMinutes(slot);
  if (singleStart !== null) {
    return [singleStart, singleStart + 60];
  }
  return [9 * 60, 10 * 60];
}

/**
 * Given a booking's start timeSlot and duration, compute its [startMin, endMin] window.
 * Supports arbitrary start times (e.g., 12:00 PM to 1:00 PM vs 12:30 PM to 1:30 PM)
 * and extends the end time when requested services exceed the base slot duration.
 */
export function getBookingTimeWindow(
  timeSlot: string,
  durationMinutes = 60
): [number, number] {
  const [startMin, slotEndMin] = parseSlotToMinutes(timeSlot);
  const slotLength = Math.max(15, slotEndMin - startMin);
  const effectiveDuration = Math.max(slotLength, durationMinutes);
  return [startMin, startMin + effectiveDuration];
}

/**
 * Compute the exact duration (in minutes) assigned to a specific employee within a booking.
 */
export function getEmployeeDurationInBooking(
  booking: BookingRecord,
  employeeId: string,
  allServices: ServiceItem[] = INITIAL_SERVICES
): number {
  let memberDuration = 0;
  for (const m of booking.members || []) {
    if (m.assignedEmployeeId === employeeId) {
      for (const sid of m.serviceIds || []) {
        const srv = allServices.find((s) => s.id === sid);
        memberDuration += srv ? srv.durationMinutes : 30;
      }
    }
  }
  if (memberDuration > 0) {
    return memberDuration;
  }
  return Math.max(60, booking.totalDurationMinutes || 60);
}

/**
 * Determine the DayOfWeek ('Monday' .. 'Sunday') for a YYYY-MM-DD date string.
 */
export function getDayOfWeekFromDateString(dateStr: string): DayOfWeek | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const map: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return map[date.getDay()] || null;
}

export interface EmployeeAvailabilityStatus {
  available: boolean;
  reason?:
    | 'OFF_DUTY'
    | 'ON_HOLIDAY'
    | 'DAY_OFF'
    | 'ON_BREAK'
    | 'OUTSIDE_SCHEDULE'
    | 'UNQUALIFIED_SERVICE'
    | 'ALREADY_BOOKED';
  message: string;
  conflictingBookingRef?: string;
}

/**
 * Comprehensive check for whether an employee is available on `appointmentDate` at `timeSlot`
 * for a given duration and set of requested services.
 * Prevents any overlapping time intervals (e.g., 12:00 PM–1:00 PM vs 12:30 PM–1:30 PM, or multi-hour services).
 */
export function checkEmployeeAvailability(params: {
  employee: Employee;
  appointmentDate: string;
  timeSlot: string;
  requestedDurationMinutes?: number;
  requiredServiceIds?: string[];
  existingBookings: BookingRecord[];
  excludeBookingId?: string;
  allServices?: ServiceItem[];
  businessProfile?: BusinessProfile;
}): EmployeeAvailabilityStatus {
  const {
    employee,
    appointmentDate,
    timeSlot,
    requestedDurationMinutes,
    requiredServiceIds = [],
    existingBookings,
    excludeBookingId,
    allServices = INITIAL_SERVICES,
    businessProfile,
  } = params;

  // 1. Active / Duty Status
  if (!employee.active) {
    return {
      available: false,
      reason: 'OFF_DUTY',
      message: 'Currently deactivated / off duty',
    };
  }

  // 2. Employee Holiday / Day Off Date check
  if (employee.holidays && employee.holidays.includes(appointmentDate)) {
    return {
      available: false,
      reason: 'ON_HOLIDAY',
      message: `On scheduled leave on ${appointmentDate}`,
    };
  }

  // 3. Day of Week Check (Employee Working Days & Salon Weekly Closing Days)
  const dayOfWeek = getDayOfWeekFromDateString(appointmentDate);
  if (dayOfWeek) {
    if (
      employee.workingDays &&
      employee.workingDays.length > 0 &&
      !employee.workingDays.includes(dayOfWeek)
    ) {
      return {
        available: false,
        reason: 'DAY_OFF',
        message: `Weekly day off on ${dayOfWeek}s`,
      };
    }

    if (businessProfile?.businessHours) {
      const salonDay = businessProfile.businessHours.find((d) => d.day === dayOfWeek);
      if (salonDay?.isClosed) {
        return {
          available: false,
          reason: 'DAY_OFF',
          message: `Salon is closed on ${dayOfWeek}s`,
        };
      }
    }
  }

  // Compute requested duration from requiredServiceIds if not explicitly provided
  const computedServiceDuration =
    requiredServiceIds.length > 0
      ? requiredServiceIds.reduce((sum, sid) => {
          const srv = allServices.find((s) => s.id === sid);
          return sum + (srv ? srv.durationMinutes : 30);
        }, 0)
      : 60;

  const effectiveRequestedDuration =
    requestedDurationMinutes !== undefined
      ? requestedDurationMinutes
      : Math.max(30, computedServiceDuration);

  const [reqStart, reqEnd] = getBookingTimeWindow(timeSlot, effectiveRequestedDuration);

  // 4. Salon Business Hours & Break check (when configured by owner)
  if (dayOfWeek && businessProfile?.businessHours) {
    const salonDay = businessProfile.businessHours.find((d) => d.day === dayOfWeek);
    if (salonDay && !salonDay.isClosed) {
      const openMin = parseSingleTimeToMinutes(salonDay.openTime);
      const closeMin = parseSingleTimeToMinutes(salonDay.closeTime);
      if (openMin !== null && closeMin !== null && closeMin > openMin) {
        if (reqStart < openMin || reqEnd > closeMin) {
          return {
            available: false,
            reason: 'OUTSIDE_SCHEDULE',
            message: `Outside salon hours (${salonDay.openTime} – ${salonDay.closeTime})`,
          };
        }
      }
      const sBreakStart = parseSingleTimeToMinutes(salonDay.breakStart);
      const sBreakEnd = parseSingleTimeToMinutes(salonDay.breakEnd);
      if (
        sBreakStart !== null &&
        sBreakEnd !== null &&
        sBreakEnd > sBreakStart &&
        Math.max(reqStart, sBreakStart) < Math.min(reqEnd, sBreakEnd)
      ) {
        return {
          available: false,
          reason: 'ON_BREAK',
          message: `Overlaps salon break (${salonDay.breakStart} – ${salonDay.breakEnd})`,
        };
      }
    }
  }

  // 5. Employee Shift Start / End & Break Window Check
  if (employee.shiftStart && employee.shiftEnd) {
    const shiftStartMin = parseSingleTimeToMinutes(employee.shiftStart);
    const shiftEndMin = parseSingleTimeToMinutes(employee.shiftEnd);
    if (shiftStartMin !== null && shiftEndMin !== null && shiftEndMin > shiftStartMin) {
      if (reqStart < shiftStartMin || reqEnd > shiftEndMin) {
        return {
          available: false,
          reason: 'OUTSIDE_SCHEDULE',
          message: `Outside shift hours (${employee.shiftStart} – ${employee.shiftEnd})`,
        };
      }
    }
  }

  if (employee.breakStart && employee.breakEnd) {
    const breakStartMin = parseSingleTimeToMinutes(employee.breakStart);
    const breakEndMin = parseSingleTimeToMinutes(employee.breakEnd);
    if (
      breakStartMin !== null &&
      breakEndMin !== null &&
      breakEndMin > breakStartMin &&
      Math.max(reqStart, breakStartMin) < Math.min(reqEnd, breakEndMin)
    ) {
      return {
        available: false,
        reason: 'ON_BREAK',
        message: `Scheduled break (${employee.breakStart} – ${employee.breakEnd})`,
      };
    }
  }

  // Also check explicit slot list when slot is one of the standard TIME_SLOTS
  const empSchedule =
    employee.availableSlots && employee.availableSlots.length > 0
      ? employee.availableSlots
      : TIME_SLOTS;

  if (TIME_SLOTS.includes(timeSlot) && !empSchedule.includes(timeSlot)) {
    return {
      available: false,
      reason: 'OUTSIDE_SCHEDULE',
      message: `Outside working schedule (${employee.shiftHours})`,
    };
  }

  // 6. Qualified Services Check (Employee must be able to perform all requested services for this member)
  if (requiredServiceIds.length > 0 && employee.offeredServiceIds?.length > 0) {
    const canPerformAll = requiredServiceIds.every((sid) =>
      employee.offeredServiceIds.includes(sid)
    );
    if (!canPerformAll) {
      return {
        available: false,
        reason: 'UNQUALIFIED_SERVICE',
        message: 'Does not perform all selected service(s)',
      };
    }
  }

  // 7. Existing Blocking Appointments Interval Overlap Check
  for (const booking of existingBookings) {
    if (booking.id === excludeBookingId) continue;
    // Cancelled and No-Show appointments release the slot
    if (booking.status === 'Cancelled' || booking.status === 'No-Show') continue;
    if (booking.appointmentDate !== appointmentDate) continue;

    const isAssigned =
      booking.assignedEmployeeIds.includes(employee.id) ||
      booking.primaryEmployeeId === employee.id ||
      booking.members.some((m) => m.assignedEmployeeId === employee.id);

    if (!isAssigned) continue;

    // Calculate how long this specific employee is occupied in that existing booking
    const empOccupiedDuration = getEmployeeDurationInBooking(
      booking,
      employee.id,
      allServices
    );
    const [bStart, bEnd] = getBookingTimeWindow(booking.timeSlot, empOccupiedDuration);

    // True interval overlap: max(start1, start2) < min(end1, end2)
    if (Math.max(reqStart, bStart) < Math.min(reqEnd, bEnd)) {
      return {
        available: false,
        reason: 'ALREADY_BOOKED',
        message: `Booked during ${booking.timeSlot} (Ref ${booking.bookingRef})`,
        conflictingBookingRef: booking.bookingRef,
      };
    }
  }

  return {
    available: true,
    message: 'Available for appointment',
  };
}

// Atomic in-memory + storage lock to prevent simultaneous conflicting booking submissions
let isBookingCommitInProgress = false;

export function commitBookingAtomically(params: {
  newBooking: BookingRecord;
  employees: Employee[];
  storageKey: string;
  currentBookingsState: BookingRecord[];
  allServices?: ServiceItem[];
  businessProfile?: BusinessProfile;
}): { ok: true; updatedBookings: BookingRecord[] } | { ok: false; error: string } {
  if (isBookingCommitInProgress) {
    return {
      ok: false,
      error:
        'Another booking request is currently being processed. Please wait a moment.',
    };
  }

  isBookingCommitInProgress = true;
  try {
    // Re-read latest persisted bookings from localStorage to catch cross-tab concurrent updates
    let latestBookings = params.currentBookingsState;
    try {
      if (typeof localStorage !== 'undefined' && params.storageKey) {
        const raw = localStorage.getItem(params.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            latestBookings = parsed;
          }
        }
      }
    } catch {
      // fallback to state
    }

    // Check intra-booking conflicts (same employee assigned to 2 members at the same time)
    const usedEmployeeIdsInThisBooking = new Set<string>();

    for (const member of params.newBooking.members) {
      const emp = params.employees.find((e) => e.id === member.assignedEmployeeId);
      if (!emp) {
        return {
          ok: false,
          error: `Selected stylist for ${member.label} could not be found.`,
        };
      }

      if (usedEmployeeIdsInThisBooking.has(emp.id)) {
        return {
          ok: false,
          error: `${emp.name} cannot be assigned to multiple members simultaneously in the same ${params.newBooking.timeSlot} slot. Please select another available stylist for ${member.label}.`,
        };
      }
      usedEmployeeIdsInThisBooking.add(emp.id);

      const memberDuration = (member.serviceIds || []).reduce((sum, sid) => {
        const srv = (params.allServices || INITIAL_SERVICES).find((s) => s.id === sid);
        return sum + (srv ? srv.durationMinutes : 30);
      }, 0);

      const check = checkEmployeeAvailability({
        employee: emp,
        appointmentDate: params.newBooking.appointmentDate,
        timeSlot: params.newBooking.timeSlot,
        requestedDurationMinutes: Math.max(60, memberDuration),
        requiredServiceIds: member.serviceIds,
        existingBookings: latestBookings,
        allServices: params.allServices,
        businessProfile: params.businessProfile,
      });

      if (!check.available) {
        return {
          ok: false,
          error: `${emp.name} is unavailable on ${params.newBooking.appointmentDate} at ${params.newBooking.timeSlot}: ${check.message}. Please choose another stylist or time slot.`,
        };
      }
    }

    const updatedBookings = [params.newBooking, ...latestBookings];
    try {
      if (typeof localStorage !== 'undefined' && params.storageKey) {
        localStorage.setItem(params.storageKey, JSON.stringify(updatedBookings));
      }
    } catch {
      // ignore storage write error
    }

    return { ok: true, updatedBookings };
  } finally {
    isBookingCommitInProgress = false;
  }
}

/**
 * Business Contact & URL Validation Helpers
 */
export function isValidPhone(phone?: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function formatWhatsAppDigits(phone?: string): string | null {
  if (!isValidPhone(phone)) return null;
  const digits = phone!.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function isValidEmail(email?: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidHttpUrl(url?: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatFullSalonAddress(profile: BusinessProfile): string | null {
  const parts = [
    profile.streetAddress?.trim(),
    profile.locality?.trim(),
    profile.city?.trim(),
    profile.state?.trim(),
    profile.pinCode?.trim(),
  ].filter(Boolean);

  // If neither streetAddress nor locality has been configured by the owner, return null
  if (!profile.streetAddress?.trim() && !profile.locality?.trim()) {
    return null;
  }
  return parts.join(', ');
}

export function formatShortLocationLabel(profile: BusinessProfile): string {
  const loc = profile.locality?.trim();
  const city = profile.city?.trim() || 'Hyderabad';
  const state = profile.state?.trim() || 'Telangana';
  if (loc) return `${loc}, ${city}`;
  return `${city}, ${state}`;
}

export function formatBusinessHoursSummary(profile: BusinessProfile): string | null {
  if (!profile.businessHours || profile.businessHours.length === 0) return null;
  const configuredDays = profile.businessHours.filter(
    (d) => d.isClosed || (d.openTime.trim() && d.closeTime.trim())
  );
  if (configuredDays.length === 0) return null;

  const openDays = profile.businessHours.filter(
    (d) => !d.isClosed && d.openTime.trim() && d.closeTime.trim()
  );
  const closedDays = profile.businessHours.filter((d) => d.isClosed);

  if (openDays.length === 0 && closedDays.length > 0) {
    return 'Temporarily Closed';
  }

  const firstOpen = openDays[0];
  const allSameHours = openDays.every(
    (d) => d.openTime === firstOpen.openTime && d.closeTime === firstOpen.closeTime
  );

  if (allSameHours && firstOpen) {
    const closedSuffix =
      closedDays.length > 0
        ? ` · Closed ${closedDays.map((d) => d.day.slice(0, 3)).join(', ')}`
        : ' · Open Daily';
    return `${firstOpen.openTime} – ${firstOpen.closeTime}${closedSuffix}`;
  }

  return openDays
    .map((d) => `${d.day.slice(0, 3)}: ${d.openTime}–${d.closeTime}`)
    .join(' · ');
}
