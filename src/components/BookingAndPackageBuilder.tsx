import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Mail,
  MessageCircle,
  Trash2,
} from 'lucide-react';
import { HYDERABAD_AREAS, TIME_SLOTS, getTodayDateString } from '../data/initialSalonData';
import {
  BookingRecord,
  BusinessProfile,
  Employee,
  GenderOption,
  HyderabadArea,
  MemberGuest,
  ServiceItem,
} from '../types/salon';
import {
  calculateMultiMemberBookingPricing,
  checkEmployeeAvailability,
  commitBookingAtomically,
  formatFullSalonAddress,
  formatWhatsAppDigits,
  isValidEmail,
} from '../utils/salonPricingAndValidation';
import { HyderabadMapPicker } from './HyderabadMapPicker';

interface BookingAndPackageBuilderProps {
  services: ServiceItem[];
  employees: Employee[];
  bookings: BookingRecord[];
  businessProfile: BusinessProfile;
  storageKey: string;
  preselectedServiceIds: string[];
  preselectedEmployeeId?: string | null;
  preselectedDate?: string | null;
  preselectedSlot?: string | null;
  onTogglePreselectedService: (serviceId: string) => void;
  onCompleteBooking: (newBooking: BookingRecord, allUpdatedBookings?: BookingRecord[]) => void;
}

export const BookingAndPackageBuilder: React.FC<BookingAndPackageBuilderProps> = ({
  services,
  employees,
  bookings,
  businessProfile,
  storageKey,
  preselectedServiceIds,
  preselectedEmployeeId,
  preselectedDate,
  preselectedSlot,
  onCompleteBooking,
}) => {
  const todayStr = getTodayDateString();
  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  // Step 5 Schedule State
  const [appointmentDate, setAppointmentDate] = useState<string>(preselectedDate || todayStr);
  const [timeSlot, setTimeSlot] = useState<string>(preselectedSlot || '11:00 AM - 12:00 PM');
  const [serviceMode, setServiceMode] = useState<
    'Flagship Studio (Jubilee Hills)' | 'Home / On-Location Service'
  >('Home / On-Location Service');

  // Step 1 Custom Package Name & Summary Review Modal
  const [customPackageName, setCustomPackageName] = useState<string>(
    'OPS Bespoke Hair, Beard & Champi Package'
  );
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 5 Customer Contact & Hyderabad Location State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('+91 ');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<HyderabadArea>(HYDERABAD_AREAS[0]);
  const [fullAddress, setFullAddress] = useState<string>(
    `${HYDERABAD_AREAS[0].landmarkHint}, ${HYDERABAD_AREAS[0].name}, Hyderabad, Telangana ${HYDERABAD_AREAS[0].pinCode}`
  );
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: HYDERABAD_AREAS[0].lat,
    lng: HYDERABAD_AREAS[0].lng,
  });
  const [notes, setNotes] = useState<string>('');

  // Step 2, 3, 4 Members State (1 to 6 members)
  const [members, setMembers] = useState<MemberGuest[]>([
    {
      id: 'mem-1',
      label: 'Primary Client (Self)',
      age: 28,
      gender: 'Male',
      serviceIds:
        preselectedServiceIds.length > 0
          ? preselectedServiceIds
          : ['srv-haircut', 'srv-beard', 'srv-head-massage'],
      assignedEmployeeId: preselectedEmployeeId || activeEmployees[0]?.id || 'emp-aarav',
    },
  ]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (preselectedDate) setAppointmentDate(preselectedDate);
    if (preselectedSlot) setTimeSlot(preselectedSlot);
    if (preselectedEmployeeId) {
      setMembers((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], assignedEmployeeId: preselectedEmployeeId };
        return updated;
      });
    }
  }, [preselectedDate, preselectedSlot, preselectedEmployeeId]);

  useEffect(() => {
    if (preselectedServiceIds.length > 0) {
      setMembers((prev) => {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          serviceIds: preselectedServiceIds,
        };
        return updated;
      });
    }
  }, [preselectedServiceIds]);

  const getMemberRequestedDuration = (serviceIds: string[]): number => {
    const sum = serviceIds.reduce((acc, sid) => {
      const srv = services.find((s) => s.id === sid);
      return acc + (srv ? srv.durationMinutes : 30);
    }, 0);
    return Math.max(60, sum);
  };

  // Automatically reassign any member whose selected employee is unavailable in the chosen slot
  useEffect(() => {
    setMembers((prev) =>
      prev.map((m, idx) => {
        const reqDuration = getMemberRequestedDuration(m.serviceIds);
        const currentEmp = employees.find((e) => e.id === m.assignedEmployeeId);
        const status = currentEmp
          ? checkEmployeeAvailability({
              employee: currentEmp,
              appointmentDate,
              timeSlot,
              requestedDurationMinutes: reqDuration,
              requiredServiceIds: m.serviceIds,
              existingBookings: bookings,
              allServices: services,
              businessProfile,
            })
          : { available: false };

        if (!status.available) {
          const qualifiedAvailable = employees.filter(
            (emp) =>
              checkEmployeeAvailability({
                employee: emp,
                appointmentDate,
                timeSlot,
                requestedDurationMinutes: reqDuration,
                requiredServiceIds: m.serviceIds,
                existingBookings: bookings,
                allServices: services,
                businessProfile,
              }).available
          );
          if (qualifiedAvailable.length > 0) {
            const replacement =
              qualifiedAvailable[idx % qualifiedAvailable.length] || qualifiedAvailable[0];
            return { ...m, assignedEmployeeId: replacement.id };
          }
        }
        return m;
      })
    );
  }, [appointmentDate, timeSlot, bookings, employees, services, businessProfile]);

  const handleMemberCountChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(6, newCount));
    const availableEmps = employees.filter(
      (e) =>
        checkEmployeeAvailability({
          employee: e,
          appointmentDate,
          timeSlot,
          existingBookings: bookings,
          allServices: services,
          businessProfile,
        }).available
    );
    const fallbackEmpId = availableEmps[0]?.id || activeEmployees[0]?.id || 'emp-aarav';

    setMembers((prev) => {
      if (clamped > prev.length) {
        const additions: MemberGuest[] = [];
        for (let i = prev.length; i < clamped; i++) {
          const empForGuest =
            availableEmps[i % Math.max(1, availableEmps.length)]?.id || fallbackEmpId;
          additions.push({
            id: `mem-${Date.now()}-${i}`,
            label: `Member ${i + 1}`,
            age: 25,
            gender: 'Male',
            serviceIds: ['srv-haircut'],
            assignedEmployeeId: empForGuest,
          });
        }
        return [...prev, ...additions];
      }
      return prev.slice(0, clamped);
    });
  };

  const updateMemberField = <K extends keyof MemberGuest>(
    index: number,
    field: K,
    value: MemberGuest[K]
  ) => {
    setMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleMemberService = (memberIndex: number, serviceId: string) => {
    setMembers((prev) => {
      const copy = [...prev];
      const currentList = copy[memberIndex].serviceIds;
      const exists = currentList.includes(serviceId);
      const nextList = exists
        ? currentList.filter((id) => id !== serviceId)
        : [...currentList, serviceId];

      const updatedServices = nextList.length > 0 ? nextList : [serviceId];
      copy[memberIndex] = {
        ...copy[memberIndex],
        serviceIds: updatedServices,
      };
      return copy;
    });
  };

  const applyQuickPackagePreset = (presetName: string, presetServiceIds: string[]) => {
    setCustomPackageName(presetName);
    setMembers((prev) => {
      const copy = [...prev];
      copy[0] = { ...copy[0], serviceIds: presetServiceIds };
      return copy;
    });
  };

  // Shared Single-Source-of-Truth Pricing Calculation
  const pricingSummary = useMemo(
    () => calculateMultiMemberBookingPricing(members, services, employees, serviceMode),
    [members, services, employees, serviceMode]
  );

  const validateFieldsAndSchedule = (): boolean => {
    setValidationError(null);

    if (!customerName.trim()) {
      setValidationError('Step 5: Please enter your full name.');
      return false;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      setValidationError(
        'Step 5: Please enter a valid 10-digit mobile number so our stylist can contact you.'
      );
      return false;
    }
    if (!isValidEmail(customerEmail)) {
      setValidationError(
        'Step 5: Please enter a valid email address for appointment confirmation.'
      );
      return false;
    }
    if (!fullAddress.trim()) {
      setValidationError('Step 5: Please provide your complete street address in Hyderabad.');
      return false;
    }

    const usedEmployeesInThisGroup = new Set<string>();
    for (const member of members) {
      if (!member.label.trim()) {
        setValidationError('Step 3: Please enter a name or label for every member.');
        return false;
      }
      if (member.age < 3 || member.age > 105) {
        setValidationError(`Step 3: Please enter a valid age for ${member.label}.`);
        return false;
      }

      const emp = employees.find((e) => e.id === member.assignedEmployeeId);
      if (!emp) {
        setValidationError(`Step 4: Selected stylist for ${member.label} is not available.`);
        return false;
      }

      if (usedEmployeesInThisGroup.has(emp.id)) {
        setValidationError(
          `Step 4: ${emp.name} is assigned to multiple members in the same ${timeSlot} slot. Please select a different stylist for ${member.label} so both members can be served without overlap.`
        );
        return false;
      }
      usedEmployeesInThisGroup.add(emp.id);

      const reqDuration = getMemberRequestedDuration(member.serviceIds);
      const availability = checkEmployeeAvailability({
        employee: emp,
        appointmentDate,
        timeSlot,
        requestedDurationMinutes: reqDuration,
        requiredServiceIds: member.serviceIds,
        existingBookings: bookings,
        allServices: services,
        businessProfile,
      });

      if (!availability.available) {
        setValidationError(
          `Step 4: ${emp.name} is unavailable on ${appointmentDate} at ${timeSlot} (${availability.message}). Please select another stylist or time slot.`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateFieldsAndSchedule()) return;

    setIsSubmitting(true);
    try {
      const assignedEmployeeIds = Array.from(
        new Set(members.map((m) => m.assignedEmployeeId))
      );

      const salonDisplayName = businessProfile.salonName || 'OPS Salon';
      const newRecord: BookingRecord = {
        id: `bk-${Date.now()}`,
        bookingRef: `NZM-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
        appointmentDate,
        timeSlot,
        serviceMode,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        hyderabadArea: selectedArea.name,
        fullAddress: fullAddress.trim(),
        coordinates,
        memberCount: members.length,
        members,
        selectedServiceIds: pricingSummary.allServiceIds,
        isCustomPackage: pricingSummary.isCustomPackage,
        packageName: pricingSummary.isCustomPackage ? customPackageName : undefined,
        subtotalAmount: pricingSummary.subtotal,
        packageDiscount: pricingSummary.discountAmount,
        homeVisitFee: pricingSummary.homeVisitFee,
        totalAmount: pricingSummary.totalAmount,
        totalDurationMinutes: pricingSummary.totalDurationMinutes,
        primaryEmployeeId: assignedEmployeeIds[0],
        assignedEmployeeIds,
        status: 'Confirmed',
        notes: notes.trim(),
        messages: [
          {
            id: `msg-${Date.now()}`,
            sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender: 'Shop Owner',
            channel: 'Portal Message',
            content: `${salonDisplayName} appointment on ${appointmentDate} (${timeSlot}) confirmed for ${members.length} member(s) in ${selectedArea.name}, Hyderabad.`,
          },
        ],
      };

      // First attempt server-side atomic reservation & pricing verification
      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
        const data = await res.json();
        if (!res.ok) {
          setValidationError(
            data.error ||
              'Selected slot became unavailable before confirmation. Please choose another slot.'
          );
          setShowSummaryModal(false);
          return;
        }
        if (data.booking && Array.isArray(data.bookings)) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(data.bookings));
          } catch {
            // ignore storage errors
          }
          setShowSummaryModal(false);
          onCompleteBooking(data.booking, data.bookings);
          setConfirmedBooking(data.booking);
          return;
        }
      } catch {
        // Fallback to local atomic lock if server is unreachable
      }

      const commitResult = commitBookingAtomically({
        newBooking: newRecord,
        employees,
        storageKey,
        currentBookingsState: bookings,
        allServices: services,
        businessProfile,
      });

      if (!commitResult.ok) {
        setValidationError(commitResult.error);
        setShowSummaryModal(false);
        return;
      }

      setShowSummaryModal(false);
      onCompleteBooking(newRecord, commitResult.updatedBookings);
      setConfirmedBooking(newRecord);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validSalonWaDigits = formatWhatsAppDigits(businessProfile.whatsappNumber);
  const validSalonEmail = isValidEmail(businessProfile.businessEmail)
    ? businessProfile.businessEmail.trim()
    : null;
  const savedStudioAddress = formatFullSalonAddress(businessProfile);

  if (confirmedBooking) {
    return (
      <div className="ops-container py-12">
        <div className="ops-card max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#E7DED1] pb-5">
            <div className="min-w-0">
              <div className="ops-eyebrow text-[#4C6545]">
                Appointment Confirmed · {businessProfile.salonName || 'OPS Salon'}
              </div>
              <h2 className="text-3xl font-serif-display text-[#292720] mt-2">
                Booking Reference: {confirmedBooking.bookingRef}
              </h2>
              <p className="text-sm text-[#79756C] mt-1">
                Scheduled for{' '}
                <strong className="text-[#292720]">{confirmedBooking.appointmentDate}</strong> at{' '}
                <strong className="text-[#292720]">{confirmedBooking.timeSlot}</strong>
              </p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-[#4C6545] shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-1.5 min-w-0">
              <div className="font-semibold text-[#292720]">Client & Contact Record</div>
              <div>Name: {confirmedBooking.customerName}</div>
              <div className="font-mono-tabular">Phone: {confirmedBooking.customerPhone}</div>
              <div>Email: {confirmedBooking.customerEmail}</div>
              <div>Party Size: {confirmedBooking.memberCount} Member(s)</div>
            </div>

            <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-1.5 min-w-0">
              <div className="font-semibold text-[#292720]">
                Hyderabad Location & Coordinates
              </div>
              <div>Mode: {confirmedBooking.serviceMode}</div>
              <div>Locality: {confirmedBooking.hyderabadArea}, Hyderabad</div>
              <div className="font-mono-tabular">
                GPS: {confirmedBooking.coordinates.lat.toFixed(4)}° N,{' '}
                {confirmedBooking.coordinates.lng.toFixed(4)}° E
              </div>
              <div className="text-[#79756C]">{confirmedBooking.fullAddress}</div>
            </div>
          </div>

          {/* Salon Contact Information from Saved Business Profile */}
          <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] text-xs space-y-1">
            <div className="font-semibold text-[#292720]">
              {businessProfile.salonName || 'OPS Salon'} Contact & Support
            </div>
            {validSalonWaDigits || validSalonEmail || savedStudioAddress ? (
              <div className="text-[#79756C] space-y-0.5">
                {savedStudioAddress && <div>Studio Address: {savedStudioAddress}</div>}
                {businessProfile.primaryPhone?.trim() && (
                  <div className="font-mono-tabular">
                    Phone: {businessProfile.primaryPhone}
                  </div>
                )}
                {validSalonEmail && <div>Email: {validSalonEmail}</div>}
              </div>
            ) : (
              <div className="text-[#79756C]">
                Contact details will be updated soon. You can check updates anytime in the Booking
                Lookup section using your reference{' '}
                <strong className="font-mono-tabular text-[#292720]">
                  {confirmedBooking.bookingRef}
                </strong>{' '}
                and phone number.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#292720]">
              Booked Members, Services & Assigned Stylists (Schedule Locked)
            </div>
            {confirmedBooking.members.map((m, i) => (
              <div
                key={m.id}
                className="p-3.5 bg-[#F3EDE2] border border-[#E7DED1] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs min-w-0"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#292720]">
                    0{i + 1}. {m.label}
                  </span>{' '}
                  <span className="text-[#79756C]">
                    (Age {m.age} · {m.gender})
                  </span>
                  <div className="text-[#79756C] mt-0.5">
                    Services:{' '}
                    {m.serviceIds
                      .map((sid) => services.find((s) => s.id === sid)?.name)
                      .filter(Boolean)
                      .join(' + ')}
                  </div>
                </div>
                <div className="text-[#9A7950] font-semibold shrink-0">
                  Stylist:{' '}
                  {employees.find((e) => e.id === m.assignedEmployeeId)?.name ||
                    'Assigned Stylist'}
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 bg-[#292720] text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#D1C9BD]">
                Estimated Appointment Value (
                {confirmedBooking.packageDiscount > 0
                  ? `Includes ₹${confirmedBooking.packageDiscount} 10% Package Discount`
                  : 'Standard Rate'}
                )
              </div>
              <div className="text-2xl font-mono-tabular font-semibold mt-0.5">
                ₹{confirmedBooking.totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {validSalonWaDigits && (
                <a
                  href={`https://wa.me/${validSalonWaDigits}?text=${encodeURIComponent(
                    `Hi ${businessProfile.salonName || 'OPS Salon'}, I have confirmed booking ${confirmedBooking.bookingRef} for ${confirmedBooking.appointmentDate} (${confirmedBooking.timeSlot}) in ${confirmedBooking.hyderabadArea}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-xs font-semibold bg-[#4C6545] text-white hover:bg-[#3d5237] transition-colors inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Open in WhatsApp</span>
                </a>
              )}
              {validSalonEmail && (
                <a
                  href={`mailto:${validSalonEmail}?subject=${encodeURIComponent(
                    `${businessProfile.salonName || 'OPS Salon'} Booking ${confirmedBooking.bookingRef}`
                  )}&body=${encodeURIComponent(
                    `Hello ${businessProfile.salonName || 'OPS Salon'},\n\nI have confirmed booking ${confirmedBooking.bookingRef} for ${confirmedBooking.appointmentDate} (${confirmedBooking.timeSlot}).`
                  )}`}
                  className="px-4 py-2.5 text-xs font-semibold bg-[#9A7950] text-white hover:bg-[#82643F] transition-colors inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Salon</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setConfirmedBooking(null)}
                className="px-4 py-2.5 text-xs font-semibold bg-[#FAF7F2] text-[#292720] hover:bg-[#E7DED1] transition-colors cursor-pointer"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-container py-10">
      {/* Page Heading & Quick Package Presets */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl min-w-0">
          <div className="ops-eyebrow">
            {businessProfile.salonName || 'OPS Salon'} · 7-Step Personalised Booking & Package
            Configurator
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-display text-[#292720] mt-2">
            Reserve Your Experience in {businessProfile.city || 'Hyderabad'}
          </h1>
          <p className="text-sm text-[#79756C] mt-2">
            Follow the steps below to select your services or custom package (10% off when
            combining 3+ services), configure 1–6 members, choose your preferred available
            stylist, and pin your Hyderabad locality.
          </p>
        </div>

        {/* 1-Click Package Presets */}
        <div className="space-y-1.5 min-w-0">
          <div className="text-[11px] font-semibold text-[#79756C] uppercase tracking-wider">
            Quick Package Combinations:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                applyQuickPackagePreset('Signature Haircut, Beard & Champi Trio', [
                  'srv-haircut',
                  'srv-beard',
                  'srv-head-massage',
                ])
              }
              className="px-3 py-2 text-xs font-semibold bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] transition-colors cursor-pointer"
            >
              Haircut + Beard + Head Massage (10% Off)
            </button>
            <button
              type="button"
              onClick={() =>
                applyQuickPackagePreset('Executive De-Stress & Facial Trio', [
                  'srv-haircut',
                  'srv-neck-massage',
                  'srv-facial',
                ])
              }
              className="px-3 py-2 text-xs font-semibold bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] transition-colors cursor-pointer"
            >
              Cut + Neck Massage + Facial (10% Off)
            </button>
          </div>
        </div>
      </div>

      {/* Step Progress Strip */}
      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
        {[
          '1. Services & Package',
          '2. Member Count',
          '3. Member Details',
          '4. Preferred Stylists',
          '5. Hyd Location & Time',
          '6. Review Summary',
          '7. Confirm Booking',
        ].map((stepLabel) => (
          <div
            key={stepLabel}
            className="px-3 py-2 bg-[#F3EDE2] border border-[#E7DED1] text-[#292720] font-medium"
          >
            {stepLabel}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmitBooking}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left 8 Columns: Steps 1 to 5 */}
        <div className="lg:col-span-8 space-y-8 min-w-0">
          {/* STEP 1 & STEP 2: Custom Package Configuration & Number of Members */}
          <section className="ops-card p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED1] pb-4">
              <div className="min-w-0">
                <div className="ops-eyebrow">Step 01 & Step 02</div>
                <h2 className="text-2xl font-serif-display text-[#292720] mt-1">
                  Package Configuration & Number of Members
                </h2>
                <p className="text-xs text-[#79756C] mt-0.5">
                  Select 3 or more services across your booking to automatically unlock the 10%
                  custom package discount.
                </p>
              </div>

              {/* Step 2: Member Count Selector (1 to 6 people) */}
              <div className="p-3 bg-[#F3EDE2] border border-[#E7DED1] flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-[#292720]">Members (1–6):</span>
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label="Select number of members"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleMemberCountChange(num)}
                      className={`w-8 h-8 text-xs font-mono-tabular font-semibold border transition-colors cursor-pointer ${
                        members.length === num
                          ? 'bg-[#292720] text-white border-[#292720]'
                          : 'bg-white text-[#292720] border-[#E7DED1] hover:border-[#9A7950]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Package Status & Title Input */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-semibold text-[#9A7950]">
                  {pricingSummary.serviceCount >= 3
                    ? `10% Custom Package Discount Unlocked (${pricingSummary.serviceCount} Services Combined)`
                    : `${pricingSummary.serviceCount} Service(s) Selected — Select ${Math.max(
                        1,
                        3 - pricingSummary.serviceCount
                      )} more to unlock 10% off`}
                </div>
                <p className="text-xs text-[#79756C]">
                  Subtotal: ₹{pricingSummary.subtotal.toLocaleString('en-IN')}
                  {pricingSummary.discountAmount > 0
                    ? ` − ₹${pricingSummary.discountAmount.toLocaleString('en-IN')} (10% Off)`
                    : ''}
                </p>
              </div>
              <input
                type="text"
                value={customPackageName}
                onChange={(e) => setCustomPackageName(e.target.value)}
                placeholder="Custom package title..."
                aria-label="Custom package name"
                className="px-3 py-2 text-xs bg-white border border-[#E7DED1] sm:w-64 min-w-0"
              />
            </div>
          </section>

          {/* STEP 3 & STEP 4: Member Details, Service Selections & Preferred Employees */}
          <section className="ops-card p-6 space-y-6">
            <div className="border-b border-[#E7DED1] pb-4">
              <div className="ops-eyebrow">Step 03 & Step 04</div>
              <h2 className="text-2xl font-serif-display text-[#292720] mt-1">
                Member Profiles, Services & Preferred Stylists
              </h2>
              <p className="text-xs text-[#79756C] mt-0.5">
                Enter each member’s name, age, and gender, select their services, and assign an
                available stylist for {appointmentDate} at {timeSlot}.
              </p>
            </div>

            <div className="space-y-6">
              {members.map((member, mIndex) => {
                const memberReqDuration = getMemberRequestedDuration(member.serviceIds);

                return (
                  <div
                    key={member.id}
                    className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-5 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED1] pb-3">
                      <span className="text-base font-serif-display text-[#292720]">
                        Member 0{mIndex + 1} Details & Stylist Assignment
                      </span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setMembers((prev) => prev.filter((_, idx) => idx !== mIndex))
                          }
                          className="text-xs text-[#B91C1C] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Member</span>
                        </button>
                      )}
                    </div>

                    {/* Step 3A: Name, Age, Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-[#292720] mb-1">
                          Member Name / Relation *
                        </label>
                        <input
                          type="text"
                          required
                          value={member.label}
                          onChange={(e) => updateMemberField(mIndex, 'label', e.target.value)}
                          placeholder="e.g., Siddharth (Self)"
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-[#292720] mb-1">
                          Age (Years) *
                        </label>
                        <input
                          type="number"
                          required
                          min={3}
                          max={105}
                          value={member.age}
                          onChange={(e) =>
                            updateMemberField(mIndex, 'age', Number(e.target.value) || 25)
                          }
                          className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-[#292720] mb-1">
                          Gender *
                        </label>
                        <select
                          value={member.gender}
                          onChange={(e) =>
                            updateMemberField(mIndex, 'gender', e.target.value as GenderOption)
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-Binary">Non-Binary</option>
                        </select>
                      </div>
                    </div>

                    {/* Step 3B: Service Selection for this Member */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[#292720]">
                        Select Services for {member.label} ({member.serviceIds.length} selected) *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {services.map((srv) => {
                          const isSelected = member.serviceIds.includes(srv.id);
                          return (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => toggleMemberService(mIndex, srv.id)}
                              className={`p-3 border text-left flex items-start justify-between gap-3 transition-colors min-w-0 cursor-pointer ${
                                isSelected
                                  ? 'bg-white border-[#9A7950] ring-1 ring-[#9A7950]'
                                  : 'bg-white/75 border-[#E7DED1] hover:border-[#9A7950]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#292720]">
                                  {srv.name}
                                </div>
                                <div className="text-[11px] text-[#79756C] mt-0.5">
                                  {srv.category} · {srv.durationMinutes} min
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-bold text-[#292720]">
                                  ₹{srv.price.toLocaleString('en-IN')}
                                </div>
                                <div className="text-[10px] font-medium text-[#9A7950]">
                                  {isSelected ? 'Selected ✓' : '+ Select'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 4: Preferred Employee Selection with Real-Time Conflict & Duty Status */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[#292720]">
                        Step 4: Select Preferred Stylist for {member.label} ({appointmentDate} ·{' '}
                        {timeSlot}) *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {employees.map((emp) => {
                          const availability = checkEmployeeAvailability({
                            employee: emp,
                            appointmentDate,
                            timeSlot,
                            requestedDurationMinutes: memberReqDuration,
                            requiredServiceIds: member.serviceIds,
                            existingBookings: bookings,
                            allServices: services,
                            businessProfile,
                          });

                          const isTakenByOtherMemberInGroup = members.some(
                            (otherM, otherIdx) =>
                              otherIdx !== mIndex && otherM.assignedEmployeeId === emp.id
                          );

                          const isSelectable =
                            availability.available && !isTakenByOtherMemberInGroup;
                          const isChosen = member.assignedEmployeeId === emp.id;

                          return (
                            <button
                              key={emp.id}
                              type="button"
                              disabled={!isSelectable}
                              onClick={() =>
                                updateMemberField(mIndex, 'assignedEmployeeId', emp.id)
                              }
                              className={`p-3 border text-left transition-colors min-w-0 flex flex-col justify-between gap-2 ${
                                !isSelectable
                                  ? 'bg-[#F3EDE2]/65 border-[#E7DED1] opacity-65 cursor-not-allowed'
                                  : isChosen
                                  ? 'bg-[#292720] text-white border-[#292720]'
                                  : 'bg-white text-[#292720] border-[#E7DED1] hover:border-[#9A7950] cursor-pointer'
                              }`}
                            >
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 bg-white border border-[#E7DED1] p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                                      {emp.portraitUrl ? (
                                        <img
                                          src={emp.portraitUrl}
                                          alt={emp.name}
                                          className="w-full h-full object-contain object-center"
                                        />
                                      ) : (
                                        <span className="text-[10px] font-semibold text-[#292720]">
                                          {emp.avatarInitials}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-semibold truncate">
                                      {emp.name}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] font-mono-tabular px-1.5 py-0.5 shrink-0 ${
                                      !isSelectable
                                        ? 'bg-[#B91C1C]/15 text-[#B91C1C] font-semibold'
                                        : isChosen
                                        ? 'bg-[#9A7950] text-white'
                                        : 'bg-[#EDF1E8] text-[#4C6545]'
                                    }`}
                                  >
                                    {!availability.available
                                      ? availability.reason === 'ALREADY_BOOKED'
                                        ? 'BOOKED'
                                        : availability.reason === 'OFF_DUTY'
                                        ? 'OFF DUTY'
                                        : availability.reason === 'ON_HOLIDAY' ||
                                          availability.reason === 'DAY_OFF'
                                        ? 'DAY OFF'
                                        : availability.reason === 'ON_BREAK'
                                        ? 'BREAK'
                                        : 'UNAVAILABLE'
                                      : isTakenByOtherMemberInGroup
                                      ? 'IN GROUP'
                                      : 'AVAILABLE'}
                                  </span>
                                </div>
                                <div
                                  className={`text-[11px] ${
                                    isChosen ? 'text-[#E7DED1]' : 'text-[#79756C]'
                                  }`}
                                >
                                  {emp.role}
                                </div>
                              </div>

                              <div
                                className={`text-[10px] pt-1 border-t ${
                                  isChosen
                                    ? 'border-white/15 text-[#D1C9BD]'
                                    : 'border-[#E7DED1] text-[#79756C]'
                                }`}
                              >
                                {isTakenByOtherMemberInGroup
                                  ? 'Assigned to another member in this booking'
                                  : availability.message}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 5: Schedule Date, Time Slot & Hyderabad Location / Coordinates */}
          <section className="ops-card p-6 space-y-6">
            <div className="border-b border-[#E7DED1] pb-4">
              <div className="ops-eyebrow">Step 05</div>
              <h2 className="text-2xl font-serif-display text-[#292720] mt-1">
                Appointment Schedule, Hyderabad Locality & Client Details
              </h2>
              <p className="text-xs text-[#79756C] mt-0.5">
                Choose your date and time slot, select Flagship Studio or Home Service in
                Hyderabad, and enter your contact details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1.5">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1.5">
                  Appointment Venue Mode *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3EDE2] border border-[#E7DED1]">
                  {(
                    [
                      'Home / On-Location Service',
                      'Flagship Studio (Jubilee Hills)',
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setServiceMode(mode)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        serviceMode === mode
                          ? 'bg-[#292720] text-white'
                          : 'text-[#79756C] hover:text-[#292720]'
                      }`}
                    >
                      {mode === 'Home / On-Location Service'
                        ? 'Home Service (Hyd)'
                        : 'Flagship Studio'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Slots Grid */}
            <div>
              <label className="block text-xs font-semibold text-[#292720] mb-2">
                Select Session Timeline *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {TIME_SLOTS.map((slot) => {
                  const freeCount = employees.filter(
                    (emp) =>
                      checkEmployeeAvailability({
                        employee: emp,
                        appointmentDate,
                        timeSlot: slot,
                        existingBookings: bookings,
                        allServices: services,
                        businessProfile,
                      }).available
                  ).length;

                  const isFullyBooked = freeCount === 0;
                  const isSelected = timeSlot === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isFullyBooked}
                      onClick={() => setTimeSlot(slot)}
                      className={`p-2.5 border text-left transition-colors min-w-0 ${
                        isFullyBooked
                          ? 'bg-[#F3EDE2]/60 border-[#E7DED1] text-[#79756C]/50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#292720] text-white border-[#292720]'
                          : 'bg-[#FAF7F2] text-[#292720] border-[#E7DED1] hover:border-[#9A7950] cursor-pointer'
                      }`}
                    >
                      <div className="text-xs font-mono-tabular font-semibold">{slot}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? 'text-[#D1C9BD]' : 'text-[#79756C]'
                        }`}
                      >
                        {isFullyBooked
                          ? 'Unavailable'
                          : `${freeCount} stylist(s) available`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Contact Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Mobile / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-3.5 py-2.5 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>
            </div>

            {/* Hyderabad Locality & Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Hyderabad Locality *
                </label>
                <select
                  value={selectedArea.id}
                  onChange={(e) => {
                    const found =
                      HYDERABAD_AREAS.find((a) => a.id === e.target.value) ||
                      HYDERABAD_AREAS[0];
                    setSelectedArea(found);
                    setCoordinates({ lat: found.lat, lng: found.lng });
                    setFullAddress(
                      `${found.landmarkHint}, ${found.name}, Hyderabad, Telangana ${found.pinCode}`
                    );
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                >
                  {HYDERABAD_AREAS.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name} — {area.pinCode} ({area.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Latitude (Hyderabad N)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min={17.2}
                  max={17.65}
                  value={coordinates.lat}
                  onChange={(e) =>
                    setCoordinates((prev) => ({
                      ...prev,
                      lat: Number(e.target.value) || 17.4319,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Longitude (Hyderabad E)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min={78.2}
                  max={78.7}
                  value={coordinates.lng}
                  onChange={(e) =>
                    setCoordinates((prev) => ({
                      ...prev,
                      lng: Number(e.target.value) || 78.4071,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>
            </div>

            <HyderabadMapPicker
              selectedAreaName={selectedArea.name}
              coordinates={coordinates}
              onSelectArea={(area) => {
                setSelectedArea(area);
                setFullAddress(
                  `${area.landmarkHint}, ${area.name}, Hyderabad, Telangana ${area.pinCode}`
                );
              }}
              onUpdateCoordinates={(coords) => setCoordinates(coords)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Complete Street Address, Villa / Flat No. & Landmark in Hyderabad *
                </label>
                <textarea
                  rows={2}
                  required
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#292720] mb-1">
                  Styling Notes / Oil Preference / Gate Instructions
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific hair texture note, oil preference, or apartment gate code..."
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right 4 Columns: STEP 6 & STEP 7 — Live Summary & Booking Submission */}
        <aside className="lg:col-span-4 lg:sticky lg:top-28 bg-[#FAF7F2] border border-[#E7DED1] p-6 space-y-5 min-w-0">
          <div className="border-b border-[#E7DED1] pb-4">
            <div className="ops-eyebrow">Step 06 & Step 07</div>
            <h3 className="text-2xl font-serif-display text-[#292720] mt-1">
              Booking & Package Summary
            </h3>
            <div className="text-xs text-[#79756C] font-mono-tabular mt-1">
              {appointmentDate} · {timeSlot}
            </div>
          </div>

          {/* Itemized Members & Services */}
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {members.map((m, i) => {
              const assignedEmp = employees.find((e) => e.id === m.assignedEmployeeId);
              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-white border border-[#E7DED1] space-y-1.5 text-xs min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-[#292720]">
                    <span>
                      0{i + 1}. {m.label}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#79756C] shrink-0">
                      {m.age} yrs · {m.gender}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9A7950] font-semibold">
                    Stylist: {assignedEmp?.name || 'Available Stylist'}
                  </div>
                  <div className="space-y-1 pt-1.5 border-t border-[#E7DED1]">
                    {m.serviceIds.map((sid) => {
                      const srv = services.find((s) => s.id === sid);
                      if (!srv) return null;
                      return (
                        <div
                          key={sid}
                          className="flex items-start justify-between gap-2 text-[#79756C]"
                        >
                          <span className="min-w-0">{srv.name}</span>
                          <span className="font-mono-tabular text-[#292720] font-medium shrink-0">
                            ₹{srv.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Location Summary */}
          <div className="p-3.5 bg-[#F3EDE2] border border-[#E7DED1] text-xs space-y-1">
            <div className="font-semibold text-[#292720]">{serviceMode}</div>
            <div className="text-[#79756C]">
              Locality:{' '}
              <strong className="text-[#292720]">{selectedArea.name}, Hyderabad</strong> (
              {selectedArea.pinCode})
            </div>
            <div className="font-mono-tabular text-[11px] text-[#79756C]">
              Coords: {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
            </div>
          </div>

          {/* Saved Salon Policies (if configured by owner) */}
          {(businessProfile.bookingInstructions?.trim() ||
            businessProfile.cancellationPolicy?.trim() ||
            businessProfile.reschedulingPolicy?.trim()) && (
            <div className="p-3.5 bg-white border border-[#E7DED1] text-[11px] text-[#79756C] space-y-1.5">
              <div className="font-semibold text-[#292720]">Salon Booking Policies</div>
              {businessProfile.bookingInstructions?.trim() && (
                <div>{businessProfile.bookingInstructions}</div>
              )}
              {businessProfile.cancellationPolicy?.trim() && (
                <div>
                  <strong className="text-[#292720]">Cancellation:</strong>{' '}
                  {businessProfile.cancellationPolicy}
                </div>
              )}
              {businessProfile.reschedulingPolicy?.trim() && (
                <div>
                  <strong className="text-[#292720]">Rescheduling:</strong>{' '}
                  {businessProfile.reschedulingPolicy}
                </div>
              )}
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="space-y-2.5 pt-2 border-t border-[#E7DED1] text-xs">
            <div className="flex items-center justify-between text-[#79756C]">
              <span>Services Selected</span>
              <strong className="font-mono-tabular text-[#292720]">
                {pricingSummary.serviceCount}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[#79756C]">
              <span>Estimated Duration</span>
              <strong className="font-mono-tabular text-[#292720]">
                {pricingSummary.totalDurationMinutes} min
              </strong>
            </div>

            <div className="flex items-center justify-between text-[#79756C]">
              <span>Services Subtotal</span>
              <span className="font-mono-tabular text-[#292720] font-semibold">
                ₹{pricingSummary.subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            {pricingSummary.discountAmount > 0 && (
              <div className="flex items-center justify-between text-[#4C6545] font-semibold">
                <span>10% Package Discount (3+ Services)</span>
                <span className="font-mono-tabular">
                  −₹{pricingSummary.discountAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {pricingSummary.homeVisitFee > 0 && (
              <div className="flex items-center justify-between text-[#79756C]">
                <span>Hyderabad Home Dispatch Fee</span>
                <span className="font-mono-tabular text-[#292720]">
                  +₹{pricingSummary.homeVisitFee}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-lg font-bold text-[#292720] pt-3 border-t border-[#E7DED1]">
              <span>Total</span>
              <span className="font-mono-tabular text-[#9A7950]">
                ₹{pricingSummary.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-xs text-[#4C6545] pt-1">
              {pricingSummary.discountAmount > 0
                ? `You saved ₹${pricingSummary.discountAmount.toLocaleString('en-IN')} with your custom package.`
                : 'Select 3 or more services to unlock 10% off.'}
            </p>
          </div>

          {validationError && (
            <div
              role="alert"
              className="p-3 bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-xs text-[#B91C1C] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                if (validateFieldsAndSchedule()) {
                  setShowSummaryModal(true);
                }
              }}
              className="ops-btn-outline w-full cursor-pointer"
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>Review Full Summary</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="ops-btn w-full cursor-pointer disabled:opacity-60"
            >
              <span>
                {isSubmitting
                  ? 'Confirming Appointment...'
                  : `Confirm Appointment (₹${pricingSummary.totalAmount.toLocaleString('en-IN')})`}
              </span>
            </button>
          </div>
        </aside>
      </form>

      {/* PRE-BOOKING VERIFICATION MODAL */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 z-50 bg-[#292720]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
        >
          <div className="ops-card max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED1] pb-4">
              <div className="min-w-0">
                <div className="ops-eyebrow">Step 06 · Pre-Booking Verification</div>
                <h3
                  id="summary-modal-title"
                  className="text-2xl font-serif-display text-[#292720] mt-1"
                >
                  {pricingSummary.isCustomPackage ? customPackageName : 'Appointment Summary'}
                </h3>
                <p className="text-xs text-[#79756C] font-mono-tabular mt-0.5">
                  {appointmentDate} · {timeSlot} · {selectedArea.name}, Hyderabad
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="px-3 py-1.5 text-xs bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-[#292720]">
                Selected Services & Assigned Stylists ({pricingSummary.serviceCount} Services)
              </div>
              <div className="divide-y divide-[#E7DED1] border border-[#E7DED1] bg-[#FAF7F2]">
                {pricingSummary.itemizedRows.map((row, idx) => (
                  <div
                    key={`${row.service.id}-${idx}`}
                    className="p-3.5 text-xs flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#292720]">{row.service.name}</div>
                      <div className="text-[11px] text-[#79756C] mt-0.5">
                        Client: {row.memberLabel} · Stylist: {row.stylistName} ·{' '}
                        {row.service.durationMinutes} min
                      </div>
                    </div>
                    <div className="font-mono-tabular font-semibold text-[#292720] shrink-0">
                      ₹{row.service.price.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#F3EDE2] border border-[#E7DED1] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#79756C]">Services Subtotal</span>
                <span className="font-mono-tabular">
                  ₹{pricingSummary.subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              {pricingSummary.discountAmount > 0 && (
                <div className="flex justify-between text-[#4C6545] font-semibold">
                  <span>10% Package Discount (3+ Services)</span>
                  <span className="font-mono-tabular">
                    −₹{pricingSummary.discountAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {pricingSummary.homeVisitFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#79756C]">Hyderabad Home Dispatch Fee</span>
                  <span className="font-mono-tabular">+₹{pricingSummary.homeVisitFee}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#292720] pt-2 border-t border-[#E7DED1]">
                <span>Final Total</span>
                <span className="font-mono-tabular text-[#9A7950]">
                  ₹{pricingSummary.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="ops-btn-outline cursor-pointer"
              >
                Back to Modify
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleSubmitBooking(e as unknown as React.FormEvent)}
                className="ops-btn cursor-pointer disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Confirming...'
                  : `Confirm & Lock Stylist Slot (₹${pricingSummary.totalAmount.toLocaleString('en-IN')})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
