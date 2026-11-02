import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Edit3,
  Eye,
  LogOut,
  MessageSquare,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AVAILABLE_PORTRAIT_ASSETS,
  DAYS_OF_WEEK,
  HYDERABAD_AREAS,
  SALON_UPLOADED_ASSETS,
  TIME_SLOTS,
  getTodayDateString,
  getTomorrowDateString,
} from '../data/initialSalonData';
import {
  BookingRecord,
  BookingStatus,
  BusinessProfile,
  DayBusinessHours,
  DayOfWeek,
  Employee,
  ServiceCategory,
  ServiceItem,
  ServicePlate,
} from '../types/salon';
import {
  checkEmployeeAvailability,
  isValidEmail,
  isValidHttpUrl,
  isValidPhone,
} from '../utils/salonPricingAndValidation';

interface AdminDashboardProps {
  bookings: BookingRecord[];
  employees: Employee[];
  services: ServiceItem[];
  businessProfile: BusinessProfile;
  onUpdateBooking: (
    bookingId: string,
    updates: {
      status?: BookingStatus;
      appointmentDate?: string;
      timeSlot?: string;
      notes?: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onSendAdminMessage: (
    bookingId: string,
    content: string,
    channel: 'Portal Message' | 'WhatsApp' | 'Email'
  ) => void;
  onAddEmployee: (emp: Omit<Employee, 'id' | 'rating' | 'completedAppointments'>) => void;
  onUpdateEmployee: (updatedEmp: Employee) => void;
  onToggleEmployeeActive: (empId: string) => void;
  onRemoveEmployee: (empId: string) => void;
  onAddService?: (
    service: Omit<ServiceItem, 'id'>,
    qualifiedEmployeeIds?: string[]
  ) => Promise<void> | void;
  onUpdateService?: (
    service: ServiceItem,
    qualifiedEmployeeIds?: string[]
  ) => Promise<void> | void;
  onDeleteService?: (serviceId: string) => Promise<void> | void;
  onSaveBusinessProfile: (
    profile: BusinessProfile
  ) => Promise<{ ok: boolean; error?: string }>;
  onUploadEmployeeImage?: (file: File) => Promise<string>;
  onUploadServiceImage?: (file: File) => Promise<string>;
  onLogout: () => void;
}

const SERVICE_SECTOR_OPTIONS: ServiceCategory[] = [
  'Haircut & Styling',
  'Beard & Shave',
  'Head & Body Massage',
  'Spa & Skin Rituals',
];

const BOOKING_STATUS_OPTIONS: BookingStatus[] = [
  'Pending',
  'Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
  'No-Show',
];

const SHIFT_TIME_OPTIONS: string[] = [
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  bookings,
  employees,
  services,
  businessProfile,
  onUpdateBooking,
  onSendAdminMessage,
  onAddEmployee,
  onUpdateEmployee,
  onToggleEmployeeActive,
  onRemoveEmployee,
  onAddService,
  onUpdateService,
  onDeleteService,
  onSaveBusinessProfile,
  onUploadEmployeeImage,
  onUploadServiceImage,
  onLogout,
}) => {
  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();

  const [activeTab, setActiveTab] = useState<
    'bookings' | 'services' | 'timeline' | 'employees' | 'messages' | 'settings'
  >('bookings');

  // Filtering & Sorting states for Appointments
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [priceFilter, setPriceFilter] = useState<
    'ALL' | 'UNDER_1500' | '1500_3000' | 'OVER_3000'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'TIMELINE_ASC' | 'PRICE_DESC' | 'PRICE_ASC' | 'LOCATION_ASC' | 'MEMBERS_DESC'
  >('TIMELINE_ASC');

  // Full Appointment Details & Reschedule Modal State
  const [selectedBookingDetailId, setSelectedBookingDetailId] = useState<string | null>(
    null
  );
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('');
  const [rescheduleFeedback, setRescheduleFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState<boolean>(false);

  // Add / Edit Employee form state
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('Senior Hair & Beard Stylist');
  const [empSpecialty, setEmpSpecialty] = useState(
    'Architectural Haircuts, Fades & Hot-Towel Shave'
  );
  const [empExp, setEmpExp] = useState(5);
  const [empPhone, setEmpPhone] = useState('');
  const [empZone, setEmpZone] = useState('Jubilee Hills & Banjara Hills');
  const [empPortraitUrl, setEmpPortraitUrl] = useState<string>(
    SALON_UPLOADED_ASSETS.empPortraitAarav
  );
  const [isUploadingPortrait, setIsUploadingPortrait] = useState<boolean>(false);
  const [empShiftStart, setEmpShiftStart] = useState('09:00 AM');
  const [empShiftEnd, setEmpShiftEnd] = useState('07:00 PM');
  const [empBreakStart, setEmpBreakStart] = useState('01:00 PM');
  const [empBreakEnd, setEmpBreakEnd] = useState('02:00 PM');
  const [empWorkingDays, setEmpWorkingDays] = useState<DayOfWeek[]>([...DAYS_OF_WEEK]);
  const [empHolidays, setEmpHolidays] = useState<string[]>([]);
  const [newHolidayInput, setNewHolidayInput] = useState<string>('');
  const [empActiveStatus, setEmpActiveStatus] = useState<boolean>(true);
  const [empBio, setEmpBio] = useState('');
  const [empServiceIds, setEmpServiceIds] = useState<string[]>([
    'srv-haircut',
    'srv-beard',
    'srv-head-massage',
  ]);
  const [empAvailableSlots, setEmpAvailableSlots] = useState<string[]>([...TIME_SLOTS]);
  const [empSaveNotice, setEmpSaveNotice] = useState<string | null>(null);

  // Messaging state
  const [selectedBookingForMsg, setSelectedBookingForMsg] = useState<string>(
    bookings[0]?.id || ''
  );
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [messageChannel, setMessageChannel] = useState<
    'Portal Message' | 'WhatsApp' | 'Email'
  >('Portal Message');
  const [messageDispatchNotice, setMessageDispatchNotice] = useState<string | null>(null);

  // Business Profile Settings Form State
  const [profileDraft, setProfileDraft] = useState<BusinessProfile>(businessProfile);
  const [isProfileDirty, setIsProfileDirty] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileNotice, setProfileNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sync profileDraft when external businessProfile updates (unless owner has unsaved edits)
  useEffect(() => {
    if (!isProfileDirty) {
      setProfileDraft(businessProfile);
    }
  }, [businessProfile, isProfileDirty]);

  // Warn before closing browser window if Business Profile has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProfileDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProfileDirty]);

  // Accurate Revenue & Appointment Metrics (Section 10)
  const metrics = useMemo(() => {
    const activeBookings = bookings.filter(
      (b) => b.status !== 'Cancelled' && b.status !== 'No-Show'
    );
    const completedBookings = bookings.filter((b) => b.status === 'Completed');
    const upcomingBookings = bookings.filter(
      (b) =>
        b.status === 'Pending' ||
        b.status === 'Confirmed' ||
        b.status === 'In Progress'
    );
    const cancelledOrNoShowBookings = bookings.filter(
      (b) => b.status === 'Cancelled' || b.status === 'No-Show'
    );
    const todayActiveBookings = activeBookings.filter(
      (b) => b.appointmentDate === todayStr
    );

    return {
      totalBookedValue: activeBookings.reduce((sum, b) => sum + b.totalAmount, 0),
      completedValue: completedBookings.reduce((sum, b) => sum + b.totalAmount, 0),
      upcomingValue: upcomingBookings.reduce((sum, b) => sum + b.totalAmount, 0),
      cancelledValue: cancelledOrNoShowBookings.reduce(
        (sum, b) => sum + b.totalAmount,
        0
      ),
      activeCount: activeBookings.length,
      completedCount: completedBookings.length,
      upcomingCount: upcomingBookings.length,
      cancelledCount: cancelledOrNoShowBookings.length,
      todayCount: todayActiveBookings.length,
      todayMembers: todayActiveBookings.reduce((sum, b) => sum + b.memberCount, 0),
    };
  }, [bookings, todayStr]);

  // Filtered and Sorted Bookings
  const filteredAndSortedBookings = useMemo(() => {
    const result = bookings.filter((b) => {
      if (dateFilter !== 'ALL' && b.appointmentDate !== dateFilter) return false;
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (locationFilter !== 'ALL' && b.hyderabadArea !== locationFilter) return false;
      if (timelineFilter !== 'ALL' && b.timeSlot !== timelineFilter) return false;
      if (
        employeeFilter !== 'ALL' &&
        !b.assignedEmployeeIds.includes(employeeFilter) &&
        b.primaryEmployeeId !== employeeFilter &&
        !b.members.some((m) => m.assignedEmployeeId === employeeFilter)
      ) {
        return false;
      }
      if (
        serviceFilter !== 'ALL' &&
        !b.selectedServiceIds.includes(serviceFilter) &&
        !b.members.some((m) => m.serviceIds.includes(serviceFilter))
      ) {
        return false;
      }
      if (priceFilter === 'UNDER_1500' && b.totalAmount >= 1500) return false;
      if (
        priceFilter === '1500_3000' &&
        (b.totalAmount < 1500 || b.totalAmount > 3000)
      ) {
        return false;
      }
      if (priceFilter === 'OVER_3000' && b.totalAmount <= 3000) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanQDigits = q.replace(/\D/g, '');
        const matchName = b.customerName.toLowerCase().includes(q);
        const matchRef = b.bookingRef.toLowerCase().includes(q);
        const matchArea = b.hyderabadArea.toLowerCase().includes(q);
        const matchPhone =
          b.customerPhone.toLowerCase().includes(q) ||
          (cleanQDigits.length >= 3 &&
            b.customerPhone.replace(/\D/g, '').includes(cleanQDigits));
        if (!matchName && !matchRef && !matchArea && !matchPhone) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'PRICE_DESC') return b.totalAmount - a.totalAmount;
      if (sortBy === 'PRICE_ASC') return a.totalAmount - b.totalAmount;
      if (sortBy === 'LOCATION_ASC')
        return a.hyderabadArea.localeCompare(b.hyderabadArea);
      if (sortBy === 'MEMBERS_DESC') return b.memberCount - a.memberCount;

      const dateCmp = a.appointmentDate.localeCompare(b.appointmentDate);
      if (dateCmp !== 0) return dateCmp;
      return TIME_SLOTS.indexOf(a.timeSlot) - TIME_SLOTS.indexOf(b.timeSlot);
    });

    return result;
  }, [
    bookings,
    dateFilter,
    statusFilter,
    serviceFilter,
    locationFilter,
    timelineFilter,
    employeeFilter,
    priceFilter,
    searchQuery,
    sortBy,
  ]);

  const getEmployeeName = (id: string) =>
    employees.find((e) => e.id === id)?.name || 'Assigned Stylist';

  const getServiceName = (id: string) =>
    services.find((s) => s.id === id)?.name || id;

  const selectedBookingForModal = useMemo(
    () => bookings.find((b) => b.id === selectedBookingDetailId) || null,
    [bookings, selectedBookingDetailId]
  );

  const openBookingDetailsModal = (booking: BookingRecord) => {
    setSelectedBookingDetailId(booking.id);
    setRescheduleDate(booking.appointmentDate);
    setRescheduleSlot(booking.timeSlot);
    setRescheduleFeedback(null);
  };

  const handleRescheduleOrStatusUpdate = async (
    bookingId: string,
    updates: {
      status?: BookingStatus;
      appointmentDate?: string;
      timeSlot?: string;
      notes?: string;
    }
  ) => {
    setIsUpdatingBooking(true);
    setRescheduleFeedback(null);
    try {
      const res = await onUpdateBooking(bookingId, updates);
      if (!res.ok) {
        setRescheduleFeedback({
          type: 'error',
          text: res.error || 'Could not update appointment due to a schedule conflict.',
        });
      } else {
        setRescheduleFeedback({
          type: 'success',
          text: 'Appointment updated successfully.',
        });
      }
    } finally {
      setIsUpdatingBooking(false);
    }
  };

  // Employee Edit / Create Handlers
  const startEditingEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEmpName(emp.name);
    setEmpRole(emp.role);
    setEmpSpecialty(emp.specialty);
    setEmpExp(emp.experienceYears);
    setEmpPhone(emp.phone || '');
    setEmpZone(emp.primaryZone);
    setEmpPortraitUrl(emp.portraitUrl || SALON_UPLOADED_ASSETS.empPortraitAarav);
    setEmpShiftStart(emp.shiftStart || emp.shiftHours.split(' - ')[0] || '09:00 AM');
    setEmpShiftEnd(emp.shiftEnd || emp.shiftHours.split(' - ')[1] || '07:00 PM');
    setEmpBreakStart(emp.breakStart || '');
    setEmpBreakEnd(emp.breakEnd || '');
    setEmpWorkingDays(
      emp.workingDays && emp.workingDays.length > 0
        ? [...emp.workingDays]
        : [...DAYS_OF_WEEK]
    );
    setEmpHolidays(Array.isArray(emp.holidays) ? [...emp.holidays] : []);
    setEmpActiveStatus(emp.active);
    setEmpBio(emp.bio);
    setEmpServiceIds(
      emp.offeredServiceIds && emp.offeredServiceIds.length > 0
        ? [...emp.offeredServiceIds]
        : ['srv-haircut', 'srv-beard']
    );
    setEmpAvailableSlots(
      emp.availableSlots && emp.availableSlots.length > 0
        ? [...emp.availableSlots]
        : [...TIME_SLOTS]
    );
    setEmpSaveNotice(null);
  };

  const resetEmployeeForm = () => {
    setEditingEmployeeId(null);
    setEmpName('');
    setEmpRole('Senior Hair & Beard Stylist');
    setEmpSpecialty('Architectural Haircuts, Fades & Hot-Towel Shave');
    setEmpExp(5);
    setEmpPhone('');
    setEmpZone('Jubilee Hills & Banjara Hills');
    setEmpPortraitUrl(SALON_UPLOADED_ASSETS.empPortraitAarav);
    setEmpShiftStart('09:00 AM');
    setEmpShiftEnd('07:00 PM');
    setEmpBreakStart('01:00 PM');
    setEmpBreakEnd('02:00 PM');
    setEmpWorkingDays([...DAYS_OF_WEEK]);
    setEmpHolidays([]);
    setNewHolidayInput('');
    setEmpActiveStatus(true);
    setEmpBio('');
    setEmpServiceIds(['srv-haircut', 'srv-beard', 'srv-head-massage']);
    setEmpAvailableSlots([...TIME_SLOTS]);
  };

  const toggleFormService = (serviceId: string) => {
    setEmpServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.length > 1 ? prev.filter((id) => id !== serviceId) : prev;
      }
      return [...prev, serviceId];
    });
  };

  const toggleFormSlot = (slot: string) => {
    setEmpAvailableSlots((prev) => {
      if (prev.includes(slot)) {
        return prev.length > 1 ? prev.filter((s) => s !== slot) : prev;
      }
      return TIME_SLOTS.filter((s) => s === slot || prev.includes(s));
    });
  };

  const toggleEmployeeWorkingDay = (day: DayOfWeek) => {
    setEmpWorkingDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return DAYS_OF_WEEK.filter((d) => d === day || prev.includes(d));
    });
  };

  const addHolidayDate = () => {
    if (!newHolidayInput) return;
    if (!empHolidays.includes(newHolidayInput)) {
      setEmpHolidays((prev) => [...prev, newHolidayInput].sort());
    }
    setNewHolidayInput('');
  };

  const removeHolidayDate = (dateStr: string) => {
    setEmpHolidays((prev) => prev.filter((d) => d !== dateStr));
  };

  const handleSaveEmployeeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;
    const initials = empName
      .trim()
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const computedShift = `${empShiftStart} - ${empShiftEnd}`;

    if (editingEmployeeId) {
      const existing = employees.find((emp) => emp.id === editingEmployeeId);
      if (existing) {
        onUpdateEmployee({
          ...existing,
          name: empName.trim(),
          role: empRole.trim(),
          specialty: empSpecialty.trim(),
          experienceYears: Number(empExp) || 3,
          phone: empPhone.trim(),
          primaryZone: empZone,
          active: empActiveStatus,
          shiftHours: computedShift,
          shiftStart: empShiftStart,
          shiftEnd: empShiftEnd,
          breakStart: empBreakStart,
          breakEnd: empBreakEnd,
          workingDays: empWorkingDays,
          holidays: empHolidays,
          portraitUrl: empPortraitUrl || existing.portraitUrl,
          avatarInitials: initials || existing.avatarInitials,
          bio:
            empBio.trim() ||
            `Specialist in ${empSpecialty.trim()} serving clients across ${empZone}, Hyderabad.`,
          offeredServiceIds: empServiceIds,
          availableSlots: empAvailableSlots,
        });
        setEmpSaveNotice(
          `Updated profile, working days, breaks & schedule for ${empName.trim()}.`
        );
      }
      resetEmployeeForm();
    } else {
      onAddEmployee({
        name: empName.trim(),
        role: empRole.trim(),
        specialty: empSpecialty.trim(),
        experienceYears: Number(empExp) || 3,
        phone: empPhone.trim(),
        primaryZone: empZone,
        active: empActiveStatus,
        shiftHours: computedShift,
        shiftStart: empShiftStart,
        shiftEnd: empShiftEnd,
        breakStart: empBreakStart,
        breakEnd: empBreakEnd,
        workingDays: empWorkingDays,
        holidays: empHolidays,
        avatarInitials: initials || 'ST',
        portraitUrl: empPortraitUrl || SALON_UPLOADED_ASSETS.empPortraitAarav,
        bio:
          empBio.trim() ||
          `Specialist in ${empSpecialty.trim()} serving clients across ${empZone}, Hyderabad.`,
        offeredServiceIds: empServiceIds,
        availableSlots: empAvailableSlots,
      });
      setEmpSaveNotice(`Added ${empName.trim()} to active OPS Salon roster.`);
      resetEmployeeForm();
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

  const handleEmployeeImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPortrait(true);
    setEmpSaveNotice(null);
    try {
      let uploadedUrl = '';
      if (onUploadEmployeeImage) {
        uploadedUrl = await onUploadEmployeeImage(file);
      } else {
        uploadedUrl = await readFileAsDataUrl(file);
      }

      if (uploadedUrl) {
        setEmpPortraitUrl(uploadedUrl);
        if (editingEmployeeId) {
          const existing = employees.find((emp) => emp.id === editingEmployeeId);
          if (existing) {
            onUpdateEmployee({
              ...existing,
              portraitUrl: uploadedUrl,
            });
            setEmpSaveNotice(
              `Uploaded and saved new employee image for ${existing.name}. Updated everywhere across Home, Our Stylists, Booking, and Admin Portal!`
            );
          }
        } else {
          setEmpSaveNotice(
            'Employee image uploaded and loaded. Complete the fields below and click "Add Stylist to Active Roster" to save everywhere.'
          );
        }
      }
    } catch {
      setEmpSaveNotice('Could not read the selected image file. Please try another image.');
    } finally {
      setIsUploadingPortrait(false);
      e.target.value = '';
    }
  };

  const handleQuickCardEmployeePhotoUpload = async (
    emp: Employee,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPortrait(true);
    setEmpSaveNotice(null);
    try {
      const uploadedUrl = onUploadEmployeeImage
        ? await onUploadEmployeeImage(file)
        : await readFileAsDataUrl(file);

      if (uploadedUrl) {
        onUpdateEmployee({
          ...emp,
          portraitUrl: uploadedUrl,
        });
        if (editingEmployeeId === emp.id) {
          setEmpPortraitUrl(uploadedUrl);
        }
        setEmpSaveNotice(
          `Uploaded & saved new photo for ${emp.name}. Live everywhere across the application!`
        );
      }
    } catch {
      setEmpSaveNotice(`Could not upload image for ${emp.name}. Please try another file.`);
    } finally {
      setIsUploadingPortrait(false);
      e.target.value = '';
    }
  };

  const handleQuickSaveEditingEmployeePhoto = () => {
    if (!editingEmployeeId) return;
    const existing = employees.find((emp) => emp.id === editingEmployeeId);
    if (!existing) return;
    onUpdateEmployee({
      ...existing,
      portraitUrl: empPortraitUrl || existing.portraitUrl,
    });
    setEmpSaveNotice(
      `Saved new employee image for ${existing.name}. Updated across Home, Our Stylists, Booking, and Admin Dashboard!`
    );
  };

  // ============================================================================
  // SERVICE CATALOG & MULTI-PLATE IMAGE UPLOAD MANAGEMENT STATE & HANDLERS
  // ============================================================================
  const [adminServiceSectorFilter, setAdminServiceSectorFilter] = useState<
    ServiceCategory | 'ALL'
  >('ALL');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [srvName, setSrvName] = useState<string>('');
  const [srvCode, setSrvCode] = useState<string>('');
  const [srvCategory, setSrvCategory] = useState<ServiceCategory>('Haircut & Styling');
  const [srvPrice, setSrvPrice] = useState<number>(750);
  const [srvDuration, setSrvDuration] = useState<number>(40);
  const [srvShortSummary, setSrvShortSummary] = useState<string>('');
  const [srvDescription, setSrvDescription] = useState<string>('');
  const [srvRecommendedFor, setSrvRecommendedFor] = useState<string>(
    'All Clients · Studio & Home Service'
  );
  const [srvStepsText, setSrvStepsText] = useState<string>(
    'Personal consultation & preparation\nSignature ritual execution\nFinishing & styling check'
  );
  const [srvQualifiedEmpIds, setSrvQualifiedEmpIds] = useState<string[]>(() =>
    employees.map((e) => e.id)
  );

  const [srvPlate1Url, setSrvPlate1Url] = useState<string>(
    SALON_UPLOADED_ASSETS.scissorTexture
  );
  const [srvPlate1Label, setSrvPlate1Label] = useState<string>('Plate 01 · Primary View');
  const [srvPlate1Caption, setSrvPlate1Caption] = useState<string>(
    'Primary service presentation & technique'
  );

  const [srvPlate2Url, setSrvPlate2Url] = useState<string>(
    SALON_UPLOADED_ASSETS.precisionShear
  );
  const [srvPlate2Label, setSrvPlate2Label] = useState<string>('Plate 02 · Detail & Process');
  const [srvPlate2Caption, setSrvPlate2Caption] = useState<string>(
    'Step-by-step craft & execution detail'
  );

  const [srvPlate3Url, setSrvPlate3Url] = useState<string>(
    SALON_UPLOADED_ASSETS.barberFade
  );
  const [srvPlate3Label, setSrvPlate3Label] = useState<string>('Plate 03 · Finished Result');
  const [srvPlate3Caption, setSrvPlate3Caption] = useState<string>(
    'Finished grooming result & aftercare'
  );

  const [uploadingPlateIndex, setUploadingPlateIndex] = useState<number | null>(null);
  const [uploadingCardPlateKey, setUploadingCardPlateKey] = useState<string | null>(null);
  const [srvSaveNotice, setSrvSaveNotice] = useState<string | null>(null);

  const resetServiceForm = (defaultSector?: ServiceCategory) => {
    setEditingServiceId(null);
    setSrvName('');
    setSrvCode(String(services.length + 1).padStart(2, '0'));
    setSrvCategory(defaultSector || 'Haircut & Styling');
    setSrvPrice(750);
    setSrvDuration(40);
    setSrvShortSummary('');
    setSrvDescription('');
    setSrvRecommendedFor('All Clients · Studio & Home Service');
    setSrvStepsText(
      'Personal consultation & preparation\nSignature ritual execution\nFinishing & styling check'
    );
    setSrvQualifiedEmpIds(employees.map((e) => e.id));
    setSrvPlate1Url(SALON_UPLOADED_ASSETS.scissorTexture);
    setSrvPlate1Label('Plate 01 · Primary View');
    setSrvPlate1Caption('Primary service presentation & technique');
    setSrvPlate2Url(SALON_UPLOADED_ASSETS.precisionShear);
    setSrvPlate2Label('Plate 02 · Detail & Process');
    setSrvPlate2Caption('Step-by-step craft & execution detail');
    setSrvPlate3Url(SALON_UPLOADED_ASSETS.barberFade);
    setSrvPlate3Label('Plate 03 · Finished Result');
    setSrvPlate3Caption('Finished grooming result & aftercare');
  };

  const startEditingService = (srv: ServiceItem) => {
    setEditingServiceId(srv.id);
    setSrvName(srv.name);
    setSrvCode(srv.code);
    setSrvCategory(srv.category);
    setSrvPrice(srv.price);
    setSrvDuration(srv.durationMinutes);
    setSrvShortSummary(srv.shortSummary);
    setSrvDescription(srv.description);
    setSrvRecommendedFor(srv.recommendedFor || 'All Clients · Studio & Home Service');
    setSrvStepsText((srv.includedSteps || []).join('\n'));

    const qualified = employees
      .filter((emp) => (emp.offeredServiceIds || []).includes(srv.id))
      .map((emp) => emp.id);
    setSrvQualifiedEmpIds(
      qualified.length > 0 ? qualified : employees.map((emp) => emp.id)
    );

    const p1 = srv.plates?.[0];
    const p2 = srv.plates?.[1];
    const p3 = srv.plates?.[2];

    setSrvPlate1Url(p1?.imageUrl || srv.imageUrl || SALON_UPLOADED_ASSETS.scissorTexture);
    setSrvPlate1Label(p1?.label || `Plate 01 · ${srv.name}`);
    setSrvPlate1Caption(p1?.caption || `${srv.name} — Plate 01`);

    setSrvPlate2Url(p2?.imageUrl || srv.imageUrl || SALON_UPLOADED_ASSETS.precisionShear);
    setSrvPlate2Label(p2?.label || `Plate 02 · ${srv.name}`);
    setSrvPlate2Caption(p2?.caption || `${srv.name} — Plate 02`);

    setSrvPlate3Url(p3?.imageUrl || srv.imageUrl || SALON_UPLOADED_ASSETS.barberFade);
    setSrvPlate3Label(p3?.label || `Plate 03 · ${srv.name}`);
    setSrvPlate3Caption(p3?.caption || `${srv.name} — Plate 03`);

    setSrvSaveNotice(null);
  };

  const toggleServiceQualifiedEmployee = (empId: string) => {
    setSrvQualifiedEmpIds((prev) => {
      if (prev.includes(empId)) {
        return prev.length > 1 ? prev.filter((id) => id !== empId) : prev;
      }
      return [...prev, empId];
    });
  };

  const uploadServicePhotoFile = async (file: File): Promise<string> => {
    if (onUploadServiceImage) {
      return onUploadServiceImage(file);
    }
    if (onUploadEmployeeImage) {
      return onUploadEmployeeImage(file);
    }
    return readFileAsDataUrl(file);
  };

  const handleServiceFormPlateFileChange = async (
    plateNumber: 1 | 2 | 3,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPlateIndex(plateNumber);
    setSrvSaveNotice(null);
    try {
      const uploadedUrl = await uploadServicePhotoFile(file);
      if (uploadedUrl) {
        if (plateNumber === 1) setSrvPlate1Url(uploadedUrl);
        if (plateNumber === 2) setSrvPlate2Url(uploadedUrl);
        if (plateNumber === 3) setSrvPlate3Url(uploadedUrl);

        // If currently editing an existing service, also immediately persist this plate image
        if (editingServiceId && onUpdateService) {
          const existing = services.find((s) => s.id === editingServiceId);
          if (existing) {
            const pIdx = (plateNumber - 1) as 0 | 1 | 2;
            const nextPlates = [...existing.plates] as [
              ServicePlate,
              ServicePlate,
              ServicePlate,
            ];
            nextPlates[pIdx] = {
              ...nextPlates[pIdx],
              imageUrl: uploadedUrl,
              needsRealPhoto: false,
              photoPromptNote: undefined,
            };
            await onUpdateService(
              {
                ...existing,
                imageUrl: pIdx === 0 ? uploadedUrl : existing.imageUrl,
                plates: nextPlates,
              },
              srvQualifiedEmpIds
            );
            setSrvSaveNotice(
              `Uploaded & saved Plate 0${plateNumber} image for "${existing.name}". Live across Home, Services, and Booking pages!`
            );
          }
        } else {
          setSrvSaveNotice(
            `Uploaded image for Plate 0${plateNumber}. Fill in the service details below and click "Create New Service & Save Everywhere".`
          );
        }
      }
    } catch {
      setSrvSaveNotice('Could not read the selected image file. Please try another image.');
    } finally {
      setUploadingPlateIndex(null);
      e.target.value = '';
    }
  };

  const handleQuickServiceCardPlateUpload = async (
    srv: ServiceItem,
    plateIdx: 0 | 1 | 2,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateService) return;

    const key = `${srv.id}-p${plateIdx + 1}`;
    setUploadingCardPlateKey(key);
    setSrvSaveNotice(null);
    try {
      const uploadedUrl = await uploadServicePhotoFile(file);
      if (uploadedUrl) {
        const nextPlates = [...srv.plates] as [ServicePlate, ServicePlate, ServicePlate];
        nextPlates[plateIdx] = {
          ...nextPlates[plateIdx],
          imageUrl: uploadedUrl,
          needsRealPhoto: false,
          photoPromptNote: undefined,
        };
        const updated: ServiceItem = {
          ...srv,
          imageUrl: plateIdx === 0 ? uploadedUrl : srv.imageUrl,
          plates: nextPlates,
        };
        await onUpdateService(updated);

        if (editingServiceId === srv.id) {
          if (plateIdx === 0) setSrvPlate1Url(uploadedUrl);
          if (plateIdx === 1) setSrvPlate2Url(uploadedUrl);
          if (plateIdx === 2) setSrvPlate3Url(uploadedUrl);
        }

        setSrvSaveNotice(
          `Uploaded & saved Plate 0${plateIdx + 1} photo for "${srv.name}". Updated everywhere across the website!`
        );
      }
    } catch {
      setSrvSaveNotice(`Failed to upload image for ${srv.name}.`);
    } finally {
      setUploadingCardPlateKey(null);
      e.target.value = '';
    }
  };

  const handleSaveServiceForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;

    const cleanName = srvName.trim();
    const cleanCode =
      srvCode.trim() || String(services.length + 1).padStart(2, '0');
    const cleanSteps = srvStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const stepsArray =
      cleanSteps.length > 0
        ? cleanSteps
        : [
            'Personal consultation & preparation',
            'Signature treatment execution',
            'Finishing & styling check',
          ];

    const themeByCategory: Record<ServiceCategory, ServicePlate['themeVariant']> = {
      'Haircut & Styling': 'scissors',
      'Beard & Shave': 'beard',
      'Head & Body Massage': 'champi',
      'Spa & Skin Rituals': 'facial',
    };
    const themeVariant = themeByCategory[srvCategory] || 'scissors';

    const baseId = editingServiceId || `srv-custom-${Date.now()}`;
    const p1Url = srvPlate1Url.trim() || SALON_UPLOADED_ASSETS.scissorTexture;
    const p2Url = srvPlate2Url.trim() || p1Url;
    const p3Url = srvPlate3Url.trim() || p1Url;

    const builtPlates: [ServicePlate, ServicePlate, ServicePlate] = [
      {
        id: `${baseId}-p1`,
        label: srvPlate1Label.trim() || `Plate 01 · ${cleanName}`,
        caption: srvPlate1Caption.trim() || `${cleanName} — Plate 01`,
        themeVariant,
        angleIndex: 0,
        imageUrl: p1Url,
        needsRealPhoto: false,
      },
      {
        id: `${baseId}-p2`,
        label: srvPlate2Label.trim() || `Plate 02 · ${cleanName}`,
        caption: srvPlate2Caption.trim() || `${cleanName} — Plate 02`,
        themeVariant,
        angleIndex: 1,
        imageUrl: p2Url,
        needsRealPhoto: false,
      },
      {
        id: `${baseId}-p3`,
        label: srvPlate3Label.trim() || `Plate 03 · ${cleanName}`,
        caption: srvPlate3Caption.trim() || `${cleanName} — Plate 03`,
        themeVariant,
        angleIndex: 2,
        imageUrl: p3Url,
        needsRealPhoto: false,
      },
    ];

    if (editingServiceId && onUpdateService) {
      const existing = services.find((s) => s.id === editingServiceId);
      if (existing) {
        await onUpdateService(
          {
            ...existing,
            code: cleanCode,
            name: cleanName,
            category: srvCategory,
            price: Math.max(50, Number(srvPrice) || 500),
            durationMinutes: Math.max(10, Number(srvDuration) || 30),
            shortSummary:
              srvShortSummary.trim() ||
              srvDescription.trim() ||
              `Signature ${cleanName} in ${srvCategory}.`,
            description:
              srvDescription.trim() ||
              srvShortSummary.trim() ||
              `Bespoke ${cleanName} performed at OPS Salon Hyderabad.`,
            recommendedFor:
              srvRecommendedFor.trim() || 'All Clients · Studio & Home Service',
            includedSteps: stepsArray,
            imageUrl: p1Url,
            plates: builtPlates,
          },
          srvQualifiedEmpIds
        );
        setSrvSaveNotice(
          `Saved "${cleanName}" (${srvCategory}) and updated its images across Home, Services, Package Builder, and Booking!`
        );
      }
      resetServiceForm(srvCategory);
    } else if (onAddService) {
      await onAddService(
        {
          code: cleanCode,
          name: cleanName,
          category: srvCategory,
          price: Math.max(50, Number(srvPrice) || 500),
          durationMinutes: Math.max(10, Number(srvDuration) || 30),
          shortSummary:
            srvShortSummary.trim() ||
            srvDescription.trim() ||
            `Signature ${cleanName} in ${srvCategory}.`,
          description:
            srvDescription.trim() ||
            srvShortSummary.trim() ||
            `Bespoke ${cleanName} performed at OPS Salon Hyderabad.`,
          recommendedFor:
            srvRecommendedFor.trim() || 'All Clients · Studio & Home Service',
          includedSteps: stepsArray,
          imageUrl: p1Url,
          plates: builtPlates,
        },
        srvQualifiedEmpIds
      );
      setSrvSaveNotice(
        `Created new service "${cleanName}" in sector "${srvCategory}" and published everywhere!`
      );
      resetServiceForm(srvCategory);
    }
  };

  const filteredAdminServices = useMemo(
    () =>
      adminServiceSectorFilter === 'ALL'
        ? services
        : services.filter((s) => s.category === adminServiceSectorFilter),
    [services, adminServiceSectorFilter]
  );

  // Messaging Submit
  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForMsg || !messageDraft.trim()) return;
    const targetBooking = bookings.find((b) => b.id === selectedBookingForMsg);
    onSendAdminMessage(selectedBookingForMsg, messageDraft.trim(), messageChannel);

    if (targetBooking && messageChannel === 'WhatsApp') {
      const cleanDigits = targetBooking.customerPhone.replace(/\D/g, '');
      const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
      const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(
        messageDraft.trim()
      )}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setMessageDispatchNotice(
        'Logged message to booking thread and opened WhatsApp with pre-filled text.'
      );
    } else if (targetBooking && messageChannel === 'Email') {
      const mailUrl = `mailto:${targetBooking.customerEmail}?subject=${encodeURIComponent(
        `${businessProfile.salonName || 'OPS Salon'} Appointment ${
          targetBooking.bookingRef
        }`
      )}&body=${encodeURIComponent(messageDraft.trim())}`;
      window.location.href = mailUrl;
      setMessageDispatchNotice(
        'Logged message to booking thread and opened your email client.'
      );
    } else {
      setMessageDispatchNotice('Portal message saved to customer booking thread.');
    }

    setMessageDraft('');
  };

  // Business Profile Form Updaters
  const updateProfileField = <K extends keyof BusinessProfile>(
    key: K,
    value: BusinessProfile[K]
  ) => {
    setProfileDraft((prev) => ({ ...prev, [key]: value }));
    setIsProfileDirty(true);
    setProfileNotice(null);
  };

  const updateDayHours = (
    dayIndex: number,
    updates: Partial<DayBusinessHours>
  ) => {
    setProfileDraft((prev) => {
      const nextHours = prev.businessHours.map((item, idx) =>
        idx === dayIndex ? { ...item, ...updates } : item
      );
      return { ...prev, businessHours: nextHours };
    });
    setIsProfileDirty(true);
    setProfileNotice(null);
  };

  const copyMondayHoursToAllOpenDays = () => {
    const monday = profileDraft.businessHours[0];
    if (!monday) return;
    setProfileDraft((prev) => ({
      ...prev,
      businessHours: prev.businessHours.map((d) =>
        d.isClosed
          ? d
          : {
              ...d,
              openTime: monday.openTime,
              closeTime: monday.closeTime,
              breakStart: monday.breakStart,
              breakEnd: monday.breakEnd,
            }
      ),
    }));
    setIsProfileDirty(true);
    setProfileNotice(null);
  };

  const handleSaveBusinessProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);

    if (!profileDraft.salonName.trim()) {
      setProfileNotice({
        type: 'error',
        text: 'Salon display name cannot be empty.',
      });
      return;
    }

    if (
      profileDraft.primaryPhone.trim() &&
      !isValidPhone(profileDraft.primaryPhone)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'Primary phone number must contain 10 to 15 digits.',
      });
      return;
    }

    if (
      profileDraft.whatsappNumber.trim() &&
      !isValidPhone(profileDraft.whatsappNumber)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'WhatsApp number must contain 10 to 15 digits.',
      });
      return;
    }

    if (
      profileDraft.businessEmail.trim() &&
      !isValidEmail(profileDraft.businessEmail)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'Please enter a valid business email address.',
      });
      return;
    }

    if (
      profileDraft.googleMapsUrl.trim() &&
      !isValidHttpUrl(profileDraft.googleMapsUrl)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'Google Maps URL must start with https:// or http://.',
      });
      return;
    }

    if (
      profileDraft.instagramUrl.trim() &&
      !isValidHttpUrl(profileDraft.instagramUrl)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'Instagram URL must start with https:// or http://.',
      });
      return;
    }

    if (
      profileDraft.facebookUrl.trim() &&
      !isValidHttpUrl(profileDraft.facebookUrl)
    ) {
      setProfileNotice({
        type: 'error',
        text: 'Facebook URL must start with https:// or http://.',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const result = await onSaveBusinessProfile(profileDraft);
      if (result.ok) {
        setIsProfileDirty(false);
        setProfileNotice({
          type: 'success',
          text: 'Business profile saved. Contact details, location, hours, and policies are now live across the website.',
        });
      } else {
        setProfileNotice({
          type: 'error',
          text: result.error || 'Failed to save business profile settings.',
        });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const activeBookingForChat =
    bookings.find((b) => b.id === selectedBookingForMsg) || bookings[0];

  return (
    <div className="ops-container py-10 space-y-8">
      {/* Top Admin Workspace Header */}
      <div className="ops-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="ops-eyebrow">
            {businessProfile.salonName || 'OPS Salon'} · Authenticated Owner Console
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif-display font-medium text-[#292720] mt-2">
            Salon Operations, Appointments, Stylists & Business Settings
          </h1>
          <p className="text-sm text-[#79756C] mt-1">
            Today’s Date:{' '}
            <span className="font-mono-tabular font-medium text-[#292720]">
              {todayStr}
            </span>{' '}
            · Manage appointments, configure stylist schedules & holidays, and update
            live salon contact details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`ops-btn-outline text-xs py-2.5 px-4 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#9A7950] border-[#9A7950] text-white'
                : ''
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>
              Business Profile Settings{isProfileDirty ? ' (Unsaved)' : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="ops-btn text-xs py-2.5 px-4 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Accurate Revenue & Booking Value Breakdown Strip (Section 10) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="ops-card p-5">
          <div className="text-[11px] text-[#79756C] uppercase tracking-wider font-semibold">
            Total Active Booked Value
          </div>
          <div className="text-2xl font-semibold font-mono-tabular text-[#292720] mt-2">
            ₹{metrics.totalBookedValue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#79756C] mt-1">
            {metrics.activeCount} non-cancelled appointments
          </div>
        </div>

        <div className="ops-card p-5">
          <div className="text-[11px] text-[#79756C] uppercase tracking-wider font-semibold">
            Completed Appointment Value
          </div>
          <div className="text-2xl font-semibold font-mono-tabular text-[#4C6545] mt-2">
            ₹{metrics.completedValue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#79756C] mt-1">
            {metrics.completedCount} completed · Settled in studio/on-site
          </div>
        </div>

        <div className="ops-card p-5">
          <div className="text-[11px] text-[#79756C] uppercase tracking-wider font-semibold">
            Upcoming Booking Value
          </div>
          <div className="text-2xl font-semibold font-mono-tabular text-[#9A7950] mt-2">
            ₹{metrics.upcomingValue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#79756C] mt-1">
            {metrics.upcomingCount} pending / confirmed / in progress
          </div>
        </div>

        <div className="ops-card p-5">
          <div className="text-[11px] text-[#79756C] uppercase tracking-wider font-semibold">
            Cancelled / No-Show Value
          </div>
          <div className="text-2xl font-semibold font-mono-tabular text-[#79756C] mt-2">
            ₹{metrics.cancelledValue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#79756C] mt-1">
            {metrics.cancelledCount} cancelled or no-show (slots released)
          </div>
        </div>

        <div className="ops-card p-5">
          <div className="text-[11px] text-[#79756C] uppercase tracking-wider font-semibold">
            Today’s Schedule ({todayStr})
          </div>
          <div className="text-2xl font-semibold font-mono-tabular text-[#292720] mt-2">
            {metrics.todayCount} Appts
          </div>
          <div className="text-xs text-[#4C6545] mt-1 font-medium">
            {metrics.todayMembers} client(s) · {employees.filter((e) => e.active).length}/
            {employees.length} stylists active
          </div>
        </div>
      </div>

      {/* Interactive Admin Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED1] pb-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F3EDE2] border border-[#E7DED1]">
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Appointments ({filteredAndSortedBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'employees'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Stylists & Schedules ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'services'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Services & Gallery ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Live Timeline & Conflict Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Client Messaging
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#292720] text-white'
                : 'text-[#79756C] hover:text-[#292720]'
            }`}
          >
            Business Profile{isProfileDirty ? ' •' : ''}
          </button>
        </div>

        {/* Quick Date Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="Filter appointments by specific date"
            value={dateFilter === 'ALL' ? '' : dateFilter}
            onChange={(e) => setDateFilter(e.target.value || 'ALL')}
            className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
          />
          <button
            type="button"
            onClick={() => setDateFilter(todayStr)}
            className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
              dateFilter === todayStr
                ? 'bg-[#9A7950] text-white border-[#9A7950]'
                : 'bg-white text-[#79756C] border-[#E7DED1] hover:text-[#292720]'
            }`}
          >
            Today ({todayStr})
          </button>
          <button
            type="button"
            onClick={() => setDateFilter(tomorrowStr)}
            className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
              dateFilter === tomorrowStr
                ? 'bg-[#9A7950] text-white border-[#9A7950]'
                : 'bg-white text-[#79756C] border-[#E7DED1] hover:text-[#292720]'
            }`}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
              dateFilter === 'ALL'
                ? 'bg-[#9A7950] text-white border-[#9A7950]'
                : 'bg-white text-[#79756C] border-[#E7DED1] hover:text-[#292720]'
            }`}
          >
            All Dates ({bookings.length})
          </button>
        </div>
      </div>

      {/* TAB 1: APPOINTMENTS MANAGEMENT WITH MULTI-FILTER, DETAILS MODAL & RESCHEDULING */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="ops-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#292720]">
                <SlidersHorizontal className="w-4 h-4 text-[#9A7950] shrink-0" />
                <span>
                  Search & Filter Appointments (Customer · Status · Stylist · Service ·
                  Location)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDateFilter('ALL');
                  setStatusFilter('ALL');
                  setServiceFilter('ALL');
                  setLocationFilter('ALL');
                  setTimelineFilter('ALL');
                  setEmployeeFilter('ALL');
                  setPriceFilter('ALL');
                  setSearchQuery('');
                  setSortBy('TIMELINE_ASC');
                }}
                className="text-xs text-[#9A7950] hover:underline font-semibold cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="admin-search"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Search Customer Name / Phone / Ref
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#79756C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Customer name, phone, NZM-..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-status"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Filter by Status
                </label>
                <select
                  id="admin-status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as BookingStatus | 'ALL')
                  }
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All Statuses</option>
                  {BOOKING_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-emp"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Filter by Stylist / Employee
                </label>
                <select
                  id="admin-emp"
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All Stylists</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-srv"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Filter by Service
                </label>
                <select
                  id="admin-srv"
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All 8 Services</option>
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.code}. {srv.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-loc"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Hyderabad Locality
                </label>
                <select
                  id="admin-loc"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All Hyderabad Localities</option>
                  {HYDERABAD_AREAS.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name} ({area.pinCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-slot"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Time Slot
                </label>
                <select
                  id="admin-slot"
                  value={timelineFilter}
                  onChange={(e) => setTimelineFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All Time Slots (09 AM – 08 PM)</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-price"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Price Bracket (₹)
                </label>
                <select
                  id="admin-price"
                  value={priceFilter}
                  onChange={(e) =>
                    setPriceFilter(e.target.value as typeof priceFilter)
                  }
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="ALL">All Price Ranges</option>
                  <option value="UNDER_1500">Under ₹1,500</option>
                  <option value="1500_3000">₹1,500 – ₹3,000</option>
                  <option value="OVER_3000">Above ₹3,000 (Packages)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="admin-sort"
                  className="block text-[11px] font-semibold text-[#79756C] mb-1"
                >
                  Sort Order
                </label>
                <select
                  id="admin-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                >
                  <option value="TIMELINE_ASC">Timeline (Chronological)</option>
                  <option value="PRICE_DESC">Price: High to Low (₹)</option>
                  <option value="PRICE_ASC">Price: Low to High (₹)</option>
                  <option value="LOCATION_ASC">Hyderabad Locality (A–Z)</option>
                  <option value="MEMBERS_DESC">Members Count (Most First)</option>
                </select>
              </div>
            </div>
          </div>

          {filteredAndSortedBookings.length === 0 ? (
            <div className="ops-card p-12 text-center space-y-3">
              <div className="text-xl font-serif-display font-medium text-[#292720]">
                No Appointments Match Current Filter Criteria
              </div>
              <p className="text-xs text-[#79756C] max-w-md mx-auto">
                Try switching the date filter to “All Dates” or resetting the status,
                service, location, or stylist filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDateFilter('ALL');
                  setStatusFilter('ALL');
                  setServiceFilter('ALL');
                  setLocationFilter('ALL');
                  setTimelineFilter('ALL');
                  setEmployeeFilter('ALL');
                  setPriceFilter('ALL');
                  setSearchQuery('');
                }}
                className="ops-btn text-xs cursor-pointer"
              >
                Show All Appointments
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="ops-card p-6 transition-colors hover:border-[#9A7950]"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-[#E7DED1]">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#79756C] font-mono-tabular">
                        <span className="font-semibold text-[#9A7950]">
                          {booking.bookingRef}
                        </span>
                        <span>·</span>
                        <span>Appt: {booking.appointmentDate}</span>
                        <span>·</span>
                        <span className="font-semibold text-[#292720]">
                          {booking.timeSlot}
                        </span>
                        <span>·</span>
                        <span>{booking.serviceMode}</span>
                        <span>·</span>
                        <span
                          className={`font-semibold ${
                            booking.status === 'Completed'
                              ? 'text-[#4C6545]'
                              : booking.status === 'In Progress' ||
                                booking.status === 'Pending'
                              ? 'text-[#9A7950]'
                              : booking.status === 'Cancelled' ||
                                booking.status === 'No-Show'
                              ? 'text-[#991B1B]'
                              : 'text-[#292720]'
                          }`}
                        >
                          Status: {booking.status}
                        </span>
                      </div>
                      <h3 className="text-2xl font-serif-display font-medium text-[#292720]">
                        {booking.customerName} ({booking.memberCount}{' '}
                        {booking.memberCount === 1 ? 'Member' : 'Members'})
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#79756C]">
                        <span>Phone: {booking.customerPhone}</span>
                        <span>·</span>
                        <span>Email: {booking.customerEmail}</span>
                        <span>·</span>
                        <span>
                          Locality:{' '}
                          <strong className="text-[#292720]">
                            {booking.hyderabadArea}
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="font-mono-tabular">
                          Created:{' '}
                          {new Date(booking.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-[#79756C] pt-0.5">
                        Address: {booking.fullAddress}
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0">
                      <div className="text-left lg:text-right">
                        <div className="text-xs text-[#79756C]">
                          {booking.isCustomPackage
                            ? booking.packageName || 'Custom Multi-Service Package'
                            : 'Standard Booking'}
                        </div>
                        <div className="text-2xl font-semibold font-mono-tabular text-[#292720]">
                          ₹{booking.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-[#79756C] font-mono-tabular">
                          {booking.totalDurationMinutes} mins total
                          {booking.packageDiscount > 0 &&
                            ` · 10% Pkg Discount (−₹${booking.packageDiscount})`}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Update status for booking ${booking.bookingRef}`}
                          value={booking.status}
                          onChange={(e) =>
                            handleRescheduleOrStatusUpdate(booking.id, {
                              status: e.target.value as BookingStatus,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-medium bg-[#F3EDE2] border border-[#E7DED1] text-[#292720]"
                        >
                          {BOOKING_STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st === 'Cancelled' ? 'Cancelled (Release Slot)' : st}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => openBookingDetailsModal(booking)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FAF7F2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#9A7950] shrink-0" />
                          <span>Full Details / Reschedule</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingForMsg(booking.id);
                            setActiveTab('messages');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                          <span>Message</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#292720] mb-2">
                        Party Members Breakdown (Age · Gender · Assigned Stylist ·
                        Services)
                      </div>
                      <div className="space-y-2">
                        {booking.members.map((member, idx) => (
                          <div
                            key={member.id}
                            className="p-2.5 bg-[#FAF7F2] border border-[#E7DED1] text-xs flex flex-col gap-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-[#292720]">
                                Member 0{idx + 1}: {member.label}
                              </span>
                              <span className="font-mono-tabular text-[#79756C]">
                                Age: {member.age} · {member.gender}
                              </span>
                            </div>
                            <div className="text-[#79756C]">
                              Services:{' '}
                              <span className="text-[#292720] font-medium">
                                {member.serviceIds.map(getServiceName).join(', ')}
                              </span>
                            </div>
                            <div className="text-[#9A7950] font-medium">
                              Assigned Stylist:{' '}
                              {getEmployeeName(member.assignedEmployeeId)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between space-y-3 min-w-0">
                      <div className="grid grid-cols-2 gap-2 p-3 bg-[#FAF7F2] border border-[#E7DED1] text-xs">
                        <div>
                          <span className="text-[#79756C] block">Services Subtotal:</span>
                          <strong className="font-mono-tabular text-[#292720]">
                            ₹{booking.subtotalAmount.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#79756C] block">10% Pkg Discount:</span>
                          <strong className="font-mono-tabular text-[#4C6545]">
                            −₹{booking.packageDiscount.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#79756C] block">Home Visit Fee:</span>
                          <strong className="font-mono-tabular text-[#292720]">
                            ₹{booking.homeVisitFee.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#79756C] block">Total Amount:</span>
                          <strong className="font-mono-tabular text-[#9A7950]">
                            ₹{booking.totalAmount.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-[#292720] mb-1">
                          Client Notes & Special Instructions
                        </div>
                        <p className="text-xs text-[#79756C] bg-[#FAF7F2] p-2.5 border border-[#E7DED1]">
                          {booking.notes || 'No extra notes provided.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E7DED1]">
                        <span className="text-xs text-[#79756C]">
                          Assigned Team:{' '}
                          <strong className="text-[#292720]">
                            {booking.assignedEmployeeIds
                              .map(getEmployeeName)
                              .join(', ')}
                          </strong>
                        </span>
                        <div className="flex items-center gap-2">
                          {isValidPhone(booking.customerPhone) && (
                            <a
                              href={`https://wa.me/${booking.customerPhone.replace(
                                /\D/g,
                                ''
                              )}?text=${encodeURIComponent(
                                `Hello ${booking.customerName}, reaching out from ${
                                  businessProfile.salonName || 'OPS Salon'
                                } regarding your appointment ${booking.bookingRef} (${
                                  booking.appointmentDate
                                } · ${booking.timeSlot}).`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-semibold bg-[#EDF1E8] text-[#4C6545] hover:bg-[#4C6545] hover:text-white transition-colors"
                            >
                              WhatsApp Client
                            </a>
                          )}
                          {isValidEmail(booking.customerEmail) && (
                            <a
                              href={`mailto:${
                                booking.customerEmail
                              }?subject=${encodeURIComponent(
                                `${businessProfile.salonName || 'OPS Salon'} Booking ${
                                  booking.bookingRef
                                }`
                              )}`}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#F3EDE2] text-[#9A7950] hover:bg-[#9A7950] hover:text-white transition-colors"
                            >
                              Email Client
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMPLOYEE PROFILES, WORKING DAYS, BREAKS, HOLIDAYS & SCHEDULE MANAGEMENT */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Columns: Add / Edit Employee Profile, Services & Schedule Form */}
          <div className="lg:col-span-5 ops-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-[#E7DED1] pb-3">
              <div className="min-w-0">
                <div className="ops-eyebrow">
                  {editingEmployeeId
                    ? 'Editing Existing Stylist Profile'
                    : 'Add New Stylist Profile'}
                </div>
                <h2 className="text-xl font-serif-display font-medium text-[#292720] mt-1">
                  {editingEmployeeId
                    ? `Edit ${empName}`
                    : 'Configure Stylist & Schedule'}
                </h2>
              </div>
              {editingEmployeeId && (
                <button
                  type="button"
                  onClick={resetEmployeeForm}
                  className="px-2.5 py-1 text-xs bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {empSaveNotice && (
              <div className="p-3 bg-[#EDF1E8] border border-[#4C6545]/30 text-xs text-[#4C6545] flex items-center justify-between">
                <span>{empSaveNotice}</span>
                <button
                  type="button"
                  onClick={() => setEmpSaveNotice(null)}
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveEmployeeForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Stylist full name"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Duty Status
                  </label>
                  <select
                    value={empActiveStatus ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setEmpActiveStatus(e.target.value === 'ACTIVE')}
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  >
                    <option value="ACTIVE">Active (On Duty)</option>
                    <option value="INACTIVE">Deactivated / Off Duty</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Role / Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={empExp}
                    onChange={(e) => setEmpExp(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Signature Specialty Headline *
                </label>
                <input
                  type="text"
                  required
                  value={empSpecialty}
                  onChange={(e) => setEmpSpecialty(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Contact Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="Leave blank if private"
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Assigned Hyderabad Zone
                  </label>
                  <select
                    value={empZone}
                    onChange={(e) => setEmpZone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  >
                    <option value="Jubilee Hills & Banjara Hills">
                      Jubilee Hills & Banjara Hills
                    </option>
                    <option value="HITEC City, Madhapur & Jubilee Hills">
                      HITEC City, Madhapur & Jubilee Hills
                    </option>
                    <option value="Gachibowli, Kokapet & Financial District">
                      Gachibowli, Kokapet & Financial District
                    </option>
                    <option value="Somajiguda, Begumpet & Secunderabad">
                      Somajiguda, Begumpet & Secunderabad
                    </option>
                    <option value="Kondapur, Manikonda & Kukatpally">
                      Kondapur, Manikonda & Kukatpally
                    </option>
                  </select>
                </div>
              </div>

              {/* Employee Image Upload & Live Preview (Updates Everywhere When Saved) */}
              <div className="p-3.5 bg-[#FAF7F2] border border-[#E7DED1] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-[#292720]">
                    Employee Profile Image (Upload Photo or Choose Avatar)
                  </label>
                  {editingEmployeeId && (
                    <span className="text-[10px] font-mono-tabular text-[#9A7950] font-semibold">
                      Editing: {empName}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3.5">
                  <div className="w-24 h-24 bg-white border border-[#E7DED1] p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={empPortraitUrl || SALON_UPLOADED_ASSETS.empPortraitAarav}
                      alt={empName || 'Employee preview'}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/employees/emp-aarav.svg';
                      }}
                      className="w-full h-full object-contain object-center"
                    />
                  </div>

                  <div className="flex-1 space-y-2 w-full min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer">
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isUploadingPortrait
                            ? 'Uploading Image...'
                            : 'Upload Employee Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEmployeeImageFileChange}
                          disabled={isUploadingPortrait}
                          className="hidden"
                        />
                      </label>

                      {editingEmployeeId && (
                        <button
                          type="button"
                          onClick={handleQuickSaveEditingEmployeePhoto}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#4C6545] text-white hover:bg-[#3b5035] transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5 shrink-0" />
                          <span>Save Photo Everywhere</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-[#79756C] leading-snug m-0">
                      Upload a portrait photo (JPG, PNG, WebP) from your computer/phone. Once saved, this employee’s image updates automatically across Home, Our Stylists, Booking, and Admin pages.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <select
                    value={
                      AVAILABLE_PORTRAIT_ASSETS.some((a) => a.url === empPortraitUrl)
                        ? empPortraitUrl
                        : 'CUSTOM'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'CUSTOM') {
                        setEmpPortraitUrl(e.target.value);
                      }
                    }}
                    aria-label="Choose default avatar placeholder or custom uploaded image"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E7DED1]"
                  >
                    {AVAILABLE_PORTRAIT_ASSETS.map((asset) => (
                      <option key={asset.url} value={asset.url}>
                        {asset.label}
                      </option>
                    ))}
                    <option value="CUSTOM">Uploaded / Custom Employee Image</option>
                  </select>

                  <input
                    type="text"
                    value={empPortraitUrl}
                    onChange={(e) => setEmpPortraitUrl(e.target.value)}
                    placeholder="Uploaded image path or URL..."
                    aria-label="Employee image URL"
                    className="w-full px-2.5 py-1.5 text-[11px] font-mono-tabular bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>

              {/* Shift Start, Shift End & Break Period Configuration */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#FAF7F2] border border-[#E7DED1]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#292720] mb-1">
                    Shift Start
                  </label>
                  <select
                    value={empShiftStart}
                    onChange={(e) => setEmpShiftStart(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  >
                    {SHIFT_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#292720] mb-1">
                    Shift End
                  </label>
                  <select
                    value={empShiftEnd}
                    onChange={(e) => setEmpShiftEnd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  >
                    {SHIFT_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#292720] mb-1">
                    Break Start
                  </label>
                  <select
                    value={empBreakStart}
                    onChange={(e) => setEmpBreakStart(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  >
                    <option value="">No Break</option>
                    {SHIFT_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#292720] mb-1">
                    Break End
                  </label>
                  <select
                    value={empBreakEnd}
                    onChange={(e) => setEmpBreakEnd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  >
                    <option value="">No Break</option>
                    {SHIFT_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Working Days of Week */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#292720]">
                  Working Days ({empWorkingDays.length} days/week)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = empWorkingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleEmployeeWorkingDay(day)}
                        className={`px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#292720] text-white border-[#292720] font-semibold'
                            : 'bg-white text-[#79756C] border-[#E7DED1]'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Holidays & Days Off */}
              <div className="space-y-1.5 p-3 bg-[#FAF7F2] border border-[#E7DED1]">
                <label className="block text-xs font-semibold text-[#292720]">
                  Scheduled Holidays / Days Off ({empHolidays.length})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    min={todayStr}
                    value={newHolidayInput}
                    onChange={(e) => setNewHolidayInput(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1] flex-1"
                  />
                  <button
                    type="button"
                    onClick={addHolidayDate}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer"
                  >
                    + Add Date Off
                  </button>
                </div>
                {empHolidays.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {empHolidays.map((dateStr) => (
                      <span
                        key={dateStr}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono-tabular bg-white border border-[#E7DED1] text-[#292720]"
                      >
                        <span>{dateStr}</span>
                        <button
                          type="button"
                          onClick={() => removeHolidayDate(dateStr)}
                          className="text-[#991B1B] hover:underline"
                          aria-label={`Remove holiday ${dateStr}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Employee Offered Services Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-[#292720]">
                  Qualified Services Performed ({empServiceIds.length} selected)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-[#FAF7F2] border border-[#E7DED1]">
                  {services.map((srv) => {
                    const checked = empServiceIds.includes(srv.id);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => toggleFormService(srv.id)}
                        className={`px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#292720] text-white border-[#292720] font-medium'
                            : 'bg-white text-[#79756C] border-[#E7DED1] hover:text-[#292720]'
                        }`}
                      >
                        <span className="truncate">{srv.name}</span>
                        <span className="shrink-0">{checked ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Employee Individual Daily Schedule Slots */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#292720]">
                    Active Booking Slots ({empAvailableSlots.length} / {TIME_SLOTS.length}{' '}
                    hrs)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEmpAvailableSlots([...TIME_SLOTS])}
                      className="px-2 py-0.5 text-[10px] bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                    >
                      Full Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmpAvailableSlots(TIME_SLOTS.slice(0, 6))}
                      className="px-2 py-0.5 text-[10px] bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                    >
                      Morning
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmpAvailableSlots(TIME_SLOTS.slice(4))}
                      className="px-2 py-0.5 text-[10px] bg-[#F3EDE2] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                    >
                      Afternoon
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-[#FAF7F2] border border-[#E7DED1]">
                  {TIME_SLOTS.map((slot) => {
                    const isWorking = empAvailableSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleFormSlot(slot)}
                        className={`px-2 py-1.5 text-[10px] font-mono-tabular border transition-colors cursor-pointer ${
                          isWorking
                            ? 'bg-[#9A7950] text-white border-[#9A7950] font-semibold'
                            : 'bg-white text-[#79756C] border-[#E7DED1]'
                        }`}
                      >
                        {slot.replace(' - ', '–')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Profile Bio & Training Notes
                </label>
                <textarea
                  rows={2}
                  value={empBio}
                  onChange={(e) => setEmpBio(e.target.value)}
                  placeholder="Short note on training and styling strengths..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <button type="submit" className="ops-btn w-full text-xs cursor-pointer">
                {editingEmployeeId ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Save Stylist Profile & Schedule Changes</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>Add Stylist to Active Roster</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right 7 Columns: Current Employees List with Upcoming Appointments, Edit, Duty Toggle */}
          <div className="lg:col-span-7 space-y-4">
            {employees.map((emp) => {
              const upcomingAssignedBookings = bookings.filter(
                (b) =>
                  b.status !== 'Cancelled' &&
                  b.status !== 'No-Show' &&
                  b.status !== 'Completed' &&
                  b.appointmentDate >= todayStr &&
                  (b.assignedEmployeeIds.includes(emp.id) ||
                    b.primaryEmployeeId === emp.id ||
                    b.members.some((m) => m.assignedEmployeeId === emp.id))
              );
              const isBeingEdited = editingEmployeeId === emp.id;

              return (
                <div
                  key={emp.id}
                  className={`ops-card p-5 space-y-4 transition-colors ${
                    isBeingEdited ? 'ring-2 ring-[#9A7950]' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-16 h-16 bg-white p-1 text-[#292720] flex items-center justify-center font-serif-display font-medium text-base shrink-0 overflow-hidden border border-[#E7DED1]">
                        {emp.portraitUrl ? (
                          <img
                            src={emp.portraitUrl}
                            alt={emp.name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/images/employees/emp-aarav.svg';
                            }}
                            className="w-full h-full object-contain object-center"
                          />
                        ) : (
                          emp.avatarInitials
                        )}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif-display font-medium text-[#292720]">
                            {emp.name}
                          </h3>
                          <span className="text-xs text-[#79756C]">·</span>
                          <span className="text-xs text-[#9A7950] font-semibold uppercase tracking-wider">
                            {emp.role}
                          </span>
                        </div>
                        <p className="text-xs text-[#79756C]">{emp.specialty}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#79756C] font-mono-tabular">
                          <span>{emp.experienceYears} yrs exp</span>
                          {emp.phone?.trim() && (
                            <>
                              <span>·</span>
                              <span>{emp.phone}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>Shift: {emp.shiftHours}</span>
                          {emp.breakStart && emp.breakEnd && (
                            <>
                              <span>·</span>
                              <span>
                                Break: {emp.breakStart}–{emp.breakEnd}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-[#79756C]">
                          Working Days:{' '}
                          <span className="text-[#292720] font-medium">
                            {(emp.workingDays || DAYS_OF_WEEK)
                              .map((d) => d.slice(0, 3))
                              .join(', ')}
                          </span>
                          {emp.holidays && emp.holidays.length > 0 && (
                            <span className="ml-2 text-[#991B1B]">
                              · Holidays: {emp.holidays.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer">
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleQuickCardEmployeePhotoUpload(emp, e)}
                          disabled={isUploadingPortrait}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => startEditingEmployee(emp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#9A7950] shrink-0" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleEmployeeActive(emp.id)}
                        className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                          emp.active
                            ? 'bg-[#EDF1E8] text-[#4C6545] border-[#4C6545]/30'
                            : 'bg-[#FEF3C7] text-[#92400E] border-[#92400E]/30'
                        }`}
                      >
                        {emp.active ? 'Active (On Duty)' : 'Deactivated'}
                      </button>

                      {employees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingEmployeeId === emp.id) resetEmployeeForm();
                            onRemoveEmployee(emp.id);
                          }}
                          className="p-2 text-[#79756C] hover:text-[#991B1B] border border-transparent hover:border-[#991B1B]/30 transition-colors cursor-pointer"
                          title="Remove employee profile"
                          aria-label={`Remove ${emp.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Services & Live Today's Schedule */}
                  <div className="pt-3 border-t border-[#E7DED1] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-[#292720] block mb-1">
                        Qualified Services ({emp.offeredServiceIds?.length || 0}):
                      </span>
                      <div className="text-[#79756C] leading-relaxed">
                        {(emp.offeredServiceIds || [])
                          .map((id) => getServiceName(id))
                          .join(' · ')}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-[#292720] block mb-1">
                        Today’s Schedule ({todayStr}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {TIME_SLOTS.map((slot) => {
                          const availability = checkEmployeeAvailability({
                            employee: emp,
                            appointmentDate: todayStr,
                            timeSlot: slot,
                            existingBookings: bookings,
                            allServices: services,
                            businessProfile,
                          });
                          return (
                            <span
                              key={slot}
                              className={`px-1.5 py-0.5 text-[10px] font-mono-tabular border ${
                                !availability.available
                                  ? availability.reason === 'ALREADY_BOOKED'
                                    ? 'bg-[#9A7950] text-white border-[#9A7950] font-semibold'
                                    : 'bg-[#F3EDE2]/60 text-[#79756C]/50 border-transparent line-through'
                                  : 'bg-[#FAF7F2] border-[#E7DED1] text-[#4C6545]'
                              }`}
                              title={availability.message}
                            >
                              {slot.split(' - ')[0]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Assigned Appointments for this Employee */}
                  <div className="pt-3 border-t border-[#E7DED1] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#292720]">
                        Upcoming Assigned Appointments ({upcomingAssignedBookings.length})
                      </span>
                      {!emp.active && (
                        <span className="text-[11px] text-[#92400E]">
                          Historical & existing appointments preserved while deactivated
                        </span>
                      )}
                    </div>
                    {upcomingAssignedBookings.length === 0 ? (
                      <p className="text-xs text-[#79756C]">
                        No upcoming active appointments assigned to {emp.name}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {upcomingAssignedBookings.map((b) => (
                          <div
                            key={b.id}
                            className="p-2.5 bg-[#FAF7F2] border border-[#E7DED1] text-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-mono-tabular text-[11px] text-[#9A7950] font-semibold">
                                {b.bookingRef} · {b.appointmentDate}
                              </div>
                              <div className="font-medium text-[#292720] truncate">
                                {b.customerName} ({b.timeSlot})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openBookingDetailsModal(b)}
                              className="px-2 py-1 text-[11px] bg-white border border-[#E7DED1] hover:border-[#9A7950] shrink-0 cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2B: SERVICES & MULTI-PLATE GALLERY MANAGEMENT (CREATE IN SECTOR, EDIT, UPLOAD IMAGES, DELETE) */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Columns: Create New Service in Sector or Edit Existing Service & Upload Plates 01/02/03 */}
          <div className="lg:col-span-5 ops-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-[#E7DED1] pb-3">
              <div className="min-w-0">
                <div className="ops-eyebrow">
                  {editingServiceId
                    ? 'Editing Existing Service & Gallery'
                    : 'Create New Service in Specific Sector'}
                </div>
                <h2 className="text-xl font-serif-display font-medium text-[#292720] mt-1">
                  {editingServiceId
                    ? `Edit ${srvName || 'Service'}`
                    : 'Add Salon Service & Upload Photos'}
                </h2>
              </div>
              {editingServiceId && (
                <button
                  type="button"
                  onClick={() => resetServiceForm()}
                  className="px-2.5 py-1 text-xs bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                >
                  + Switch to New Service
                </button>
              )}
            </div>

            {srvSaveNotice && (
              <div className="p-3 bg-[#EDF1E8] border border-[#4C6545]/30 text-xs text-[#4C6545] flex items-center justify-between gap-2">
                <span>{srvSaveNotice}</span>
                <button
                  type="button"
                  onClick={() => setSrvSaveNotice(null)}
                  aria-label="Dismiss service notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveServiceForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    placeholder="e.g., Signature Haircut & Blow-Dry"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Service Code
                  </label>
                  <input
                    type="text"
                    value={srvCode}
                    onChange={(e) => setSrvCode(e.target.value)}
                    placeholder={String(services.length + 1).padStart(2, '0')}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Service Sector / Category *
                  </label>
                  <select
                    value={srvCategory}
                    onChange={(e) => setSrvCategory(e.target.value as ServiceCategory)}
                    className="w-full px-2.5 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                  >
                    {SERVICE_SECTOR_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    required
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Duration (Mins) *
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={5}
                    required
                    value={srvDuration}
                    onChange={(e) => setSrvDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                  />
                </div>
              </div>

              {/* 3 Service Image Plates Upload & Live Preview (Plates 01, 02, 03) */}
              <div className="p-3.5 bg-[#FAF7F2] border border-[#E7DED1] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-[#292720]">
                    Service Gallery Images — Plates 01, 02 &amp; 03 (Upload Photos)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (srvPlate1Url) {
                        setSrvPlate2Url(srvPlate1Url);
                        setSrvPlate3Url(srvPlate1Url);
                      }
                    }}
                    className="text-[10px] text-[#9A7950] font-semibold hover:underline cursor-pointer"
                  >
                    Copy Plate 01 Photo to 02 &amp; 03
                  </button>
                </div>

                {(
                  [
                    {
                      num: 1 as const,
                      url: srvPlate1Url,
                      setUrl: setSrvPlate1Url,
                      label: srvPlate1Label,
                      setLabel: setSrvPlate1Label,
                      caption: srvPlate1Caption,
                      setCaption: setSrvPlate1Caption,
                    },
                    {
                      num: 2 as const,
                      url: srvPlate2Url,
                      setUrl: setSrvPlate2Url,
                      label: srvPlate2Label,
                      setLabel: setSrvPlate2Label,
                      caption: srvPlate2Caption,
                      setCaption: setSrvPlate2Caption,
                    },
                    {
                      num: 3 as const,
                      url: srvPlate3Url,
                      setUrl: setSrvPlate3Url,
                      label: srvPlate3Label,
                      setLabel: setSrvPlate3Label,
                      caption: srvPlate3Caption,
                      setCaption: setSrvPlate3Caption,
                    },
                  ]
                ).map((p) => (
                  <div
                    key={p.num}
                    className="p-2.5 bg-white border border-[#E7DED1] flex flex-col sm:flex-row items-center gap-3"
                  >
                    <div className="w-24 h-20 bg-white border border-[#E7DED1] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={p.url || SALON_UPLOADED_ASSETS.scissorTexture}
                        alt={`Plate 0${p.num} preview`}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/images/services/haircut-1.svg';
                        }}
                        className="w-full h-full object-contain object-center"
                      />
                    </div>

                    <div className="flex-1 w-full space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-mono-tabular font-semibold text-[#292720]">
                          PLATE 0{p.num}
                        </span>
                        <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer">
                          <Upload className="w-3 h-3 shrink-0" />
                          <span>
                            {uploadingPlateIndex === p.num
                              ? 'Uploading...'
                              : `Upload Plate 0${p.num} Photo`}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleServiceFormPlateFileChange(p.num, e)}
                            disabled={uploadingPlateIndex !== null}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <input
                        type="text"
                        value={p.label}
                        onChange={(e) => p.setLabel(e.target.value)}
                        placeholder={`Plate 0${p.num} Title...`}
                        className="w-full px-2 py-1 text-[11px] bg-[#FAF7F2] border border-[#E7DED1]"
                      />
                      <input
                        type="text"
                        value={p.url}
                        onChange={(e) => p.setUrl(e.target.value)}
                        placeholder={`Plate 0${p.num} Image URL...`}
                        className="w-full px-2 py-1 text-[10px] font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Short Card Summary *
                </label>
                <input
                  type="text"
                  required
                  value={srvShortSummary}
                  onChange={(e) => setSrvShortSummary(e.target.value)}
                  placeholder="Concise 1-line summary shown on Home & Service cards..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Detailed Service Description
                </label>
                <textarea
                  rows={2}
                  value={srvDescription}
                  onChange={(e) => setSrvDescription(e.target.value)}
                  placeholder="Full ritual description, botanical ingredients, and styling notes..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292720] mb-1">
                  Included Ritual Steps (One per line)
                </label>
                <textarea
                  rows={3}
                  value={srvStepsText}
                  onChange={(e) => setSrvStepsText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E7DED1]"
                />
              </div>

              {/* Qualified Stylists Performing This Service */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#292720]">
                  Stylists Offering This Service ({srvQualifiedEmpIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#FAF7F2] border border-[#E7DED1]">
                  {employees.map((emp) => {
                    const checked = srvQualifiedEmpIds.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleServiceQualifiedEmployee(emp.id)}
                        className={`px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#292720] text-white border-[#292720] font-semibold'
                            : 'bg-white text-[#79756C] border-[#E7DED1]'
                        }`}
                      >
                        {emp.name} {checked ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="ops-btn w-full text-xs cursor-pointer">
                <Save className="w-4 h-4 shrink-0" />
                <span>
                  {editingServiceId
                    ? 'Save Service & Update Images Everywhere'
                    : 'Create New Service & Save Everywhere'}
                </span>
              </button>
            </form>
          </div>

          {/* Right 7 Columns: Existing Services by Sector with Direct 1-Click Image Upload, Edit & Delete */}
          <div className="lg:col-span-7 space-y-4">
            <div className="ops-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', ...SERVICE_SECTOR_OPTIONS] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setAdminServiceSectorFilter(sec)}
                    className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                      adminServiceSectorFilter === sec
                        ? 'bg-[#292720] text-white border-[#292720]'
                        : 'bg-[#FAF7F2] text-[#79756C] border-[#E7DED1] hover:text-[#292720]'
                    }`}
                  >
                    {sec === 'ALL' ? `All Sectors (${services.length})` : sec}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  resetServiceForm(
                    adminServiceSectorFilter === 'ALL'
                      ? 'Haircut & Styling'
                      : adminServiceSectorFilter
                  )
                }
                className="px-3 py-1.5 text-xs font-semibold bg-[#9A7950] text-white hover:bg-[#292720] transition-colors cursor-pointer"
              >
                + New Service in{' '}
                {adminServiceSectorFilter === 'ALL'
                  ? 'Selected Sector'
                  : adminServiceSectorFilter}
              </button>
            </div>

            {filteredAdminServices.map((srv) => {
              const isBeingEdited = editingServiceId === srv.id;
              return (
                <div
                  key={srv.id}
                  className={`ops-card p-5 space-y-4 transition-colors ${
                    isBeingEdited ? 'ring-2 ring-[#9A7950]' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E7DED1] pb-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono-tabular font-bold uppercase tracking-wider px-2 py-0.5 bg-[#F3EDE2] text-[#9A7950] border border-[#E7DED1]">
                          SERVICE / {srv.code} · {srv.category}
                        </span>
                        <span className="text-sm font-mono-tabular font-bold text-[#292720]">
                          ₹{srv.price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs font-mono-tabular text-[#79756C]">
                          · {srv.durationMinutes} mins
                        </span>
                      </div>
                      <h3 className="text-lg font-serif-display font-medium text-[#292720]">
                        {srv.name}
                      </h3>
                      <p className="text-xs text-[#79756C] m-0">{srv.shortSummary}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditingService(srv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#9A7950] shrink-0" />
                        <span>Edit Service</span>
                      </button>

                      {services.length > 1 && onDeleteService && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingServiceId === srv.id) resetServiceForm();
                            onDeleteService(srv.id);
                            setSrvSaveNotice(
                              `Deleted "${srv.name}" and updated the service catalog everywhere.`
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#991B1B] bg-[#FEF2F2] border border-[#991B1B]/30 hover:bg-[#991B1B] hover:text-white transition-colors cursor-pointer"
                          title={`Delete ${srv.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Direct 1-Click Image Upload for Plate 01, Plate 02, and Plate 03 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([0, 1, 2] as const).map((plateIdx) => {
                      const plate = srv.plates?.[plateIdx];
                      const plateKey = `${srv.id}-p${plateIdx + 1}`;
                      const isUploadingThis = uploadingCardPlateKey === plateKey;

                      return (
                        <div
                          key={plateKey}
                          className="p-2.5 bg-[#FAF7F2] border border-[#E7DED1] flex flex-col justify-between gap-2"
                        >
                          <div className="h-28 w-full bg-white border border-[#E7DED1] p-1.5 flex items-center justify-center overflow-hidden">
                            <img
                              src={
                                plate?.imageUrl ||
                                srv.imageUrl ||
                                SALON_UPLOADED_ASSETS.scissorTexture
                              }
                              alt={`${srv.name} Plate 0${plateIdx + 1}`}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/services/haircut-1.svg';
                              }}
                              className="w-full h-full object-contain object-center"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-mono-tabular font-semibold text-[#292720] truncate">
                              Plate 0{plateIdx + 1}
                            </span>

                            <label className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors cursor-pointer shrink-0">
                              <Upload className="w-3 h-3 shrink-0" />
                              <span>
                                {isUploadingThis
                                  ? 'Saving...'
                                  : `Upload 0${plateIdx + 1}`}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleQuickServiceCardPlateUpload(srv, plateIdx, e)
                                }
                                disabled={uploadingCardPlateKey !== null}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE & SLOT CONFLICT MATRIX */}
      {activeTab === 'timeline' && (
        <div className="ops-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="ops-eyebrow">Real-Time Interval Lock</div>
              <h2 className="text-2xl font-serif-display font-medium text-[#292720] mt-1">
                Employee Timeline & Double-Booking Prevention Matrix
              </h2>
              <p className="text-xs text-[#79756C]">
                Showing live schedule for{' '}
                <strong className="font-mono-tabular text-[#292720]">
                  {dateFilter === 'ALL' ? todayStr : dateFilter}
                </strong>
                . Accounts for shift hours, breaks, holidays, service durations, and
                active appointments.
              </p>
            </div>
            <input
              type="date"
              aria-label="Filter matrix date"
              value={dateFilter === 'ALL' ? todayStr : dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs font-mono-tabular bg-[#FAF7F2] border border-[#E7DED1]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="border-b border-[#E7DED1] text-[11px] font-semibold text-[#79756C]">
                  <th className="py-3 px-3 w-44">Time Slot</th>
                  {employees.map((emp) => (
                    <th key={emp.id} className="py-3 px-3">
                      <div className="text-xs text-[#292720] font-semibold">
                        {emp.name}
                      </div>
                      <div className="text-[10px] text-[#79756C] font-normal">
                        {emp.shiftHours}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED1] text-xs">
                {TIME_SLOTS.map((slot) => {
                  const targetDate = dateFilter === 'ALL' ? todayStr : dateFilter;
                  return (
                    <tr key={slot} className="hover:bg-[#FAF7F2]">
                      <td className="py-3 px-3 font-mono-tabular font-medium text-[#292720] whitespace-nowrap">
                        {slot}
                      </td>
                      {employees.map((emp) => {
                        const availability = checkEmployeeAvailability({
                          employee: emp,
                          appointmentDate: targetDate,
                          timeSlot: slot,
                          existingBookings: bookings,
                          allServices: services,
                          businessProfile,
                        });

                        const conflictBooking =
                          availability.reason === 'ALREADY_BOOKED'
                            ? bookings.find(
                                (b) => b.bookingRef === availability.conflictingBookingRef
                              )
                            : undefined;

                        if (!emp.active) {
                          return (
                            <td key={emp.id} className="py-2.5 px-3">
                              <span className="text-[11px] text-[#79756C]">
                                Deactivated
                              </span>
                            </td>
                          );
                        }

                        if (conflictBooking) {
                          return (
                            <td key={emp.id} className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => openBookingDetailsModal(conflictBooking)}
                                className="w-full text-left p-2 bg-[#F3EDE2] border border-[#9A7950] space-y-0.5 hover:bg-[#EAE0D0] transition-colors cursor-pointer"
                              >
                                <div className="font-semibold text-[#292720] flex items-center justify-between gap-1">
                                  <span className="truncate">
                                    {conflictBooking.customerName}
                                  </span>
                                  <span className="font-mono-tabular text-[10px] text-[#9A7950]">
                                    {conflictBooking.bookingRef}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#79756C]">
                                  {conflictBooking.hyderabadArea} · ₹
                                  {conflictBooking.totalAmount}
                                </div>
                              </button>
                            </td>
                          );
                        }

                        if (!availability.available) {
                          return (
                            <td key={emp.id} className="py-2.5 px-3">
                              <span className="text-[11px] text-[#79756C]/70 font-mono-tabular">
                                {availability.reason === 'ON_BREAK'
                                  ? 'Break'
                                  : availability.reason === 'ON_HOLIDAY' ||
                                    availability.reason === 'DAY_OFF'
                                  ? 'Day Off'
                                  : 'Outside Shift'}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={emp.id} className="py-2.5 px-3">
                            <span className="text-[11px] text-[#4C6545] font-medium">
                              Available
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MESSAGING & WHATSAPP / EMAIL DISPATCH */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 ops-card p-5 space-y-3">
            <h3 className="text-lg font-serif-display font-medium text-[#292720]">
              Select Client Booking to Message
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {bookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBookingForMsg(b.id);
                    setMessageDispatchNotice(null);
                  }}
                  className={`w-full text-left p-3.5 border transition-colors cursor-pointer ${
                    selectedBookingForMsg === b.id
                      ? 'bg-[#F3EDE2] border-[#9A7950]'
                      : 'bg-[#FAF7F2] border-[#E7DED1] hover:border-[#9A7950]/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono-tabular text-[#79756C]">
                    <span className="font-semibold text-[#9A7950]">{b.bookingRef}</span>
                    <span>
                      {b.appointmentDate} · {b.timeSlot}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#292720] mt-1">
                    {b.customerName}
                  </div>
                  <div className="text-xs text-[#79756C] mt-0.5">
                    {b.hyderabadArea} · {b.customerPhone} · {b.messages.length} msg(s)
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 ops-card p-6 flex flex-col justify-between space-y-6">
            {activeBookingForChat ? (
              <>
                <div className="pb-4 border-b border-[#E7DED1] flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono-tabular text-[#9A7950] font-semibold">
                      {activeBookingForChat.bookingRef} ·{' '}
                      {activeBookingForChat.hyderabadArea}, Hyderabad
                    </div>
                    <h3 className="text-2xl font-serif-display font-medium text-[#292720]">
                      {activeBookingForChat.customerName}
                    </h3>
                    <p className="text-xs text-[#79756C]">
                      {activeBookingForChat.customerPhone} ·{' '}
                      {activeBookingForChat.customerEmail}
                    </p>
                  </div>
                  {isValidPhone(activeBookingForChat.customerPhone) && (
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://wa.me/${activeBookingForChat.customerPhone.replace(
                          /\D/g,
                          ''
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 text-xs font-semibold bg-[#4C6545] text-white hover:bg-[#3A4F34] transition-colors"
                      >
                        Open WhatsApp Chat
                      </a>
                    </div>
                  )}
                </div>

                {messageDispatchNotice && (
                  <div className="p-3 bg-[#EDF1E8] border border-[#4C6545]/30 text-xs text-[#4C6545] flex items-center justify-between">
                    <span>{messageDispatchNotice}</span>
                    <button
                      type="button"
                      onClick={() => setMessageDispatchNotice(null)}
                      aria-label="Close notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-3 max-h-[260px] overflow-y-auto py-2">
                  {activeBookingForChat.messages.length === 0 ? (
                    <p className="text-xs text-[#79756C] italic">
                      No messages recorded yet for this appointment. Use the dispatch
                      box below to message the customer.
                    </p>
                  ) : (
                    activeBookingForChat.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3.5 text-xs space-y-1 border ${
                          msg.sender === 'Shop Owner'
                            ? 'bg-[#F3EDE2] border-[#9A7950]/40'
                            : 'bg-[#FAF7F2] border-[#E7DED1]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#79756C] font-mono-tabular">
                          <span className="font-semibold text-[#292720]">
                            {msg.sender} via {msg.channel}
                          </span>
                          <span>{msg.sentAt}</span>
                        </div>
                        <p className="text-[#292720]">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handleSendMessageSubmit}
                  className="space-y-3 pt-3 border-t border-[#E7DED1]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#292720]">
                      Dispatch Channel:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(['Portal Message', 'WhatsApp', 'Email'] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setMessageChannel(ch)}
                          className={`px-3 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                            messageChannel === ch
                              ? 'bg-[#292720] text-white border-[#292720]'
                              : 'bg-[#F3EDE2] text-[#79756C] border-[#E7DED1]'
                          }`}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder={`Write update for ${activeBookingForChat.customerName}...`}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FAF7F2] border border-[#E7DED1] focus:outline-none focus:border-[#9A7950]"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const contactSuffix = businessProfile.primaryPhone?.trim()
                          ? ` For assistance, call ${businessProfile.primaryPhone.trim()}.`
                          : '';
                        setMessageDraft(
                          `Namaste ${activeBookingForChat.customerName}, your ${
                            businessProfile.salonName || 'OPS Salon'
                          } appointment (${activeBookingForChat.bookingRef}) on ${
                            activeBookingForChat.appointmentDate
                          } at ${activeBookingForChat.timeSlot} in ${
                            activeBookingForChat.hyderabadArea
                          }, Hyderabad is ${activeBookingForChat.status.toLowerCase()}. Total: ₹${
                            activeBookingForChat.totalAmount
                          }.${contactSuffix}`
                        );
                      }}
                      className="text-xs text-[#9A7950] font-semibold hover:underline cursor-pointer"
                    >
                      Insert Confirmation Template (Uses Saved Business Profile)
                    </button>
                    <button
                      type="submit"
                      className="ops-btn text-xs py-2 px-4 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {messageChannel === 'Portal Message'
                          ? 'Post to Booking Thread'
                          : `Log & Open ${messageChannel}`}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 5: BUSINESS PROFILE & SALON SETTINGS (SECTION 4 & 5) */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveBusinessProfileSubmit} className="space-y-6">
          <div className="ops-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED1] pb-5">
              <div className="max-w-2xl">
                <div className="ops-eyebrow">Centralized Salon Configuration</div>
                <h2 className="text-2xl sm:text-3xl font-serif-display font-medium text-[#292720] mt-1">
                  Business Profile & Salon Settings
                </h2>
                <p className="text-xs text-[#79756C] mt-1">
                  Enter and save your genuine business contact details, studio address,
                  opening hours, booking policies, and customer announcements. Saved
                  values update immediately across the website without altering
                  historical booking records.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {isProfileDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDraft(businessProfile);
                      setIsProfileDirty(false);
                      setProfileNotice(null);
                    }}
                    className="ops-btn-outline text-xs py-2.5 px-4 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Discard Unsaved Changes</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="ops-btn text-xs py-2.5 px-5 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            {isProfileDirty && (
              <div className="p-3 bg-[#FEF3C7] border border-[#92400E]/30 text-xs text-[#92400E] flex items-center justify-between">
                <span>
                  You have unsaved changes in your Business Profile. Click “Save
                  Changes” to publish them across the website.
                </span>
              </div>
            )}

            {profileNotice && (
              <div
                className={`p-4 border text-xs flex items-start justify-between gap-3 ${
                  profileNotice.type === 'success'
                    ? 'bg-[#EDF1E8] border-[#4C6545]/30 text-[#4C6545]'
                    : 'bg-[#FEF2F2] border-[#991B1B]/30 text-[#991B1B]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {profileNotice.type === 'success' ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{profileNotice.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileNotice(null)}
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. BUSINESS IDENTITY */}
              <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
                <h3 className="text-lg font-serif-display font-medium text-[#292720] border-b border-[#E7DED1] pb-2">
                  1. Business Identity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Salon Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={profileDraft.salonName}
                      onChange={(e) => updateProfileField('salonName', e.target.value)}
                      placeholder="OPS Salon"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Contact Person’s Name
                    </label>
                    <input
                      type="text"
                      value={profileDraft.contactPersonName}
                      onChange={(e) =>
                        updateProfileField('contactPersonName', e.target.value)
                      }
                      placeholder="Owner or Manager Name (Optional)"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Business Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={profileDraft.businessDescription}
                    onChange={(e) =>
                      updateProfileField('businessDescription', e.target.value)
                    }
                    placeholder="Short description of your salon..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>

              {/* 2. CONTACT INFORMATION */}
              <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
                <h3 className="text-lg font-serif-display font-medium text-[#292720] border-b border-[#E7DED1] pb-2">
                  2. Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Primary Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileDraft.primaryPhone}
                      onChange={(e) =>
                        updateProfileField('primaryPhone', e.target.value)
                      }
                      placeholder="e.g. +91 9XXXXXXXXX"
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      value={profileDraft.whatsappNumber}
                      onChange={(e) =>
                        updateProfileField('whatsappNumber', e.target.value)
                      }
                      placeholder="e.g. +91 9XXXXXXXXX"
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Business Email Address
                  </label>
                  <input
                    type="email"
                    value={profileDraft.businessEmail}
                    onChange={(e) =>
                      updateProfileField('businessEmail', e.target.value)
                    }
                    placeholder="Official salon email address"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>

              {/* 3. PHYSICAL LOCATION */}
              <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
                <h3 className="text-lg font-serif-display font-medium text-[#292720] border-b border-[#E7DED1] pb-2">
                  3. Physical Location
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Complete Street Address
                  </label>
                  <input
                    type="text"
                    value={profileDraft.streetAddress}
                    onChange={(e) =>
                      updateProfileField('streetAddress', e.target.value)
                    }
                    placeholder="Building, Road No., Landmark"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Locality
                    </label>
                    <input
                      type="text"
                      value={profileDraft.locality}
                      onChange={(e) => updateProfileField('locality', e.target.value)}
                      placeholder="e.g. Jubilee Hills"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={profileDraft.city}
                      onChange={(e) => updateProfileField('city', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={profileDraft.state}
                      onChange={(e) => updateProfileField('state', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={profileDraft.pinCode}
                      onChange={(e) => updateProfileField('pinCode', e.target.value)}
                      placeholder="5000XX"
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Google Maps URL
                  </label>
                  <input
                    type="url"
                    value={profileDraft.googleMapsUrl}
                    onChange={(e) =>
                      updateProfileField('googleMapsUrl', e.target.value)
                    }
                    placeholder="https://maps.google.com/..."
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>

              {/* 4. SOCIAL MEDIA & CUSTOMER ANNOUNCEMENT */}
              <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
                <h3 className="text-lg font-serif-display font-medium text-[#292720] border-b border-[#E7DED1] pb-2">
                  4. Social Media & Website Announcement
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Instagram URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={profileDraft.instagramUrl}
                      onChange={(e) =>
                        updateProfileField('instagramUrl', e.target.value)
                      }
                      placeholder="https://instagram.com/..."
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#292720] mb-1">
                      Facebook URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={profileDraft.facebookUrl}
                      onChange={(e) =>
                        updateProfileField('facebookUrl', e.target.value)
                      }
                      placeholder="https://facebook.com/..."
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E7DED1] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#292720]">
                      Customer Announcement Banner
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileDraft.announcementActive}
                        onChange={(e) =>
                          updateProfileField('announcementActive', e.target.checked)
                        }
                        className="accent-[#9A7950] w-4 h-4"
                      />
                      <span className="font-medium text-[#292720]">
                        Display Announcement on Website
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={profileDraft.announcementText}
                    onChange={(e) =>
                      updateProfileField('announcementText', e.target.value)
                    }
                    placeholder="Optional seasonal notice, holiday schedule, or studio announcement..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>
            </div>

            {/* 5. BUSINESS HOURS */}
            <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED1] pb-2">
                <div>
                  <h3 className="text-lg font-serif-display font-medium text-[#292720]">
                    5. Business Hours, Weekly Closing Days & Break Periods
                  </h3>
                  <p className="text-xs text-[#79756C]">
                    Configure opening/closing hours and optional break periods for each
                    day of the week. Leave times blank if hours are not yet published.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyMondayHoursToAllOpenDays}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#F3EDE2] text-[#292720] border border-[#E7DED1] hover:border-[#9A7950] cursor-pointer"
                >
                  Apply Monday Hours to All Open Days
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[680px] text-xs">
                  <thead>
                    <tr className="border-b border-[#E7DED1] text-[11px] text-[#79756C] font-semibold">
                      <th className="py-2 pr-3">Day of Week</th>
                      <th className="py-2 px-3">Weekly Closing Day</th>
                      <th className="py-2 px-3">Opening Time</th>
                      <th className="py-2 px-3">Closing Time</th>
                      <th className="py-2 px-3">Break Start (Optional)</th>
                      <th className="py-2 pl-3">Break End (Optional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7DED1]">
                    {profileDraft.businessHours.map((dayRow, idx) => (
                      <tr key={dayRow.day}>
                        <td className="py-2.5 pr-3 font-semibold text-[#292720]">
                          {dayRow.day}
                        </td>
                        <td className="py-2.5 px-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dayRow.isClosed}
                              onChange={(e) =>
                                updateDayHours(idx, { isClosed: e.target.checked })
                              }
                              className="accent-[#9A7950] w-3.5 h-3.5"
                            />
                            <span
                              className={
                                dayRow.isClosed
                                  ? 'text-[#991B1B] font-semibold'
                                  : 'text-[#79756C]'
                              }
                            >
                              {dayRow.isClosed ? 'Closed' : 'Open'}
                            </span>
                          </label>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            disabled={dayRow.isClosed}
                            value={dayRow.openTime}
                            onChange={(e) =>
                              updateDayHours(idx, { openTime: e.target.value })
                            }
                            className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1] disabled:opacity-50"
                          >
                            <option value="">Not Set</option>
                            {SHIFT_TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            disabled={dayRow.isClosed}
                            value={dayRow.closeTime}
                            onChange={(e) =>
                              updateDayHours(idx, { closeTime: e.target.value })
                            }
                            className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1] disabled:opacity-50"
                          >
                            <option value="">Not Set</option>
                            {SHIFT_TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            disabled={dayRow.isClosed}
                            value={dayRow.breakStart}
                            onChange={(e) =>
                              updateDayHours(idx, { breakStart: e.target.value })
                            }
                            className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1] disabled:opacity-50"
                          >
                            <option value="">No Break</option>
                            {SHIFT_TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pl-3">
                          <select
                            disabled={dayRow.isClosed}
                            value={dayRow.breakEnd}
                            onChange={(e) =>
                              updateDayHours(idx, { breakEnd: e.target.value })
                            }
                            className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-[#E7DED1] disabled:opacity-50"
                          >
                            <option value="">No Break</option>
                            {SHIFT_TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. BOOKING POLICIES */}
            <div className="p-5 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
              <h3 className="text-lg font-serif-display font-medium text-[#292720] border-b border-[#E7DED1] pb-2">
                6. Booking Policies & Client Instructions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Cancellation Policy (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.cancellationPolicy}
                    onChange={(e) =>
                      updateProfileField('cancellationPolicy', e.target.value)
                    }
                    placeholder="e.g., Cancellations are accepted up to 3 hours prior to the scheduled slot..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Rescheduling Policy (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.reschedulingPolicy}
                    onChange={(e) =>
                      updateProfileField('reschedulingPolicy', e.target.value)
                    }
                    placeholder="e.g., Appointments may be rescheduled subject to stylist availability..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292720] mb-1">
                    Booking Instructions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.bookingInstructions}
                    onChange={(e) =>
                      updateProfileField('bookingInstructions', e.target.value)
                    }
                    placeholder="e.g., Please arrive 5 minutes early for studio consultations..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="ops-btn text-xs py-3 px-6 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>
                  {isSavingProfile
                    ? 'Saving Business Profile...'
                    : 'Save Business Profile Settings'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* FULL APPOINTMENT DETAILS & RESCHEDULE MODAL (SECTION 6) */}
      {selectedBookingForModal && (
        <div
          className="fixed inset-0 z-50 bg-[#292720]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appt-detail-modal-title"
        >
          <div className="ops-card max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED1] pb-4">
              <div>
                <div className="ops-eyebrow">
                  Appointment Record · {selectedBookingForModal.bookingRef}
                </div>
                <h3
                  id="appt-detail-modal-title"
                  className="text-2xl font-serif-display text-[#292720] mt-1"
                >
                  {selectedBookingForModal.customerName} (
                  {selectedBookingForModal.memberCount}{' '}
                  {selectedBookingForModal.memberCount === 1 ? 'Member' : 'Members'})
                </h3>
                <p className="text-xs text-[#79756C] font-mono-tabular mt-1">
                  Created:{' '}
                  {new Date(selectedBookingForModal.createdAt).toLocaleString(
                    'en-IN'
                  )}{' '}
                  · Scheduled: {selectedBookingForModal.appointmentDate} (
                  {selectedBookingForModal.timeSlot})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingDetailId(null)}
                className="p-1.5 text-[#79756C] hover:text-[#292720] cursor-pointer"
                aria-label="Close appointment details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {rescheduleFeedback && (
              <div
                className={`p-3 border text-xs flex items-center gap-2 ${
                  rescheduleFeedback.type === 'success'
                    ? 'bg-[#EDF1E8] border-[#4C6545]/30 text-[#4C6545]'
                    : 'bg-[#FEF2F2] border-[#991B1B]/30 text-[#991B1B]'
                }`}
              >
                {rescheduleFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{rescheduleFeedback.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-1.5">
                <div className="font-semibold text-[#292720]">
                  Customer & Contact Details
                </div>
                <div>Name: {selectedBookingForModal.customerName}</div>
                <div className="font-mono-tabular">
                  Phone: {selectedBookingForModal.customerPhone}
                </div>
                <div>Email: {selectedBookingForModal.customerEmail}</div>
                <div>Status: {selectedBookingForModal.status}</div>
              </div>

              <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-1.5">
                <div className="font-semibold text-[#292720]">
                  Venue & Location Details
                </div>
                <div>Mode: {selectedBookingForModal.serviceMode}</div>
                <div>Locality: {selectedBookingForModal.hyderabadArea}</div>
                <div>Address: {selectedBookingForModal.fullAddress}</div>
                <div className="font-mono-tabular text-[11px] text-[#79756C]">
                  Coordinates: {selectedBookingForModal.coordinates.lat.toFixed(4)}° N,{' '}
                  {selectedBookingForModal.coordinates.lng.toFixed(4)}° E
                </div>
              </div>
            </div>

            {/* Member & Service Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#292720]">
                Members, Selected Services & Assigned Stylists
              </div>
              <div className="space-y-2">
                {selectedBookingForModal.members.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3 bg-[#FAF7F2] border border-[#E7DED1] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-[#292720]">
                      <span>
                        0{idx + 1}. {m.label} ({m.age} yrs · {m.gender})
                      </span>
                      <span className="text-[#9A7950]">
                        Stylist: {getEmployeeName(m.assignedEmployeeId)}
                      </span>
                    </div>
                    <div className="text-[#79756C]">
                      Services: {m.serviceIds.map(getServiceName).join(' + ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="p-4 bg-[#F3EDE2] border border-[#E7DED1] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#79756C]">Services Subtotal</span>
                <span className="font-mono-tabular">
                  ₹{selectedBookingForModal.subtotalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              {selectedBookingForModal.packageDiscount > 0 && (
                <div className="flex justify-between text-[#4C6545] font-semibold">
                  <span>10% Custom Package Discount</span>
                  <span className="font-mono-tabular">
                    −₹{selectedBookingForModal.packageDiscount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {selectedBookingForModal.homeVisitFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#79756C]">Hyderabad Home Dispatch Fee</span>
                  <span className="font-mono-tabular">
                    +₹{selectedBookingForModal.homeVisitFee.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#292720] pt-2 border-t border-[#E7DED1]">
                <span>
                  Total ({selectedBookingForModal.totalDurationMinutes} mins)
                </span>
                <span className="font-mono-tabular text-[#9A7950]">
                  ₹{selectedBookingForModal.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Reschedule & Status Control */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E7DED1] space-y-4">
              <div className="text-xs font-semibold text-[#292720] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#9A7950]" />
                <span>Reschedule Appointment or Update Status</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#79756C] mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#79756C] mb-1">
                    Time Slot
                  </label>
                  <select
                    value={rescheduleSlot}
                    onChange={(e) => setRescheduleSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-[#E7DED1]"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#79756C] mb-1">
                    Status
                  </label>
                  <select
                    value={selectedBookingForModal.status}
                    onChange={(e) =>
                      handleRescheduleOrStatusUpdate(selectedBookingForModal.id, {
                        status: e.target.value as BookingStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E7DED1]"
                  >
                    {BOOKING_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {selectedBookingForModal.status !== 'Cancelled' && (
                  <button
                    type="button"
                    disabled={isUpdatingBooking}
                    onClick={() =>
                      handleRescheduleOrStatusUpdate(selectedBookingForModal.id, {
                        status: 'Cancelled',
                      })
                    }
                    className="px-3.5 py-2 text-xs font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#991B1B]/30 hover:bg-[#991B1B] hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel Appointment (Release Slot)
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={isUpdatingBooking}
                    onClick={() =>
                      handleRescheduleOrStatusUpdate(selectedBookingForModal.id, {
                        appointmentDate: rescheduleDate,
                        timeSlot: rescheduleSlot,
                      })
                    }
                    className="ops-btn text-xs py-2 px-4 cursor-pointer disabled:opacity-60"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isUpdatingBooking
                        ? 'Updating...'
                        : 'Save Rescheduled Date & Slot'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
