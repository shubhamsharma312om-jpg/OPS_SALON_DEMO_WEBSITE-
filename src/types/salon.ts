export type ServiceCategory =
  | 'Haircut & Styling'
  | 'Beard & Shave'
  | 'Head & Body Massage'
  | 'Spa & Skin Rituals';

export interface ServicePlate {
  id: string;
  label: string;
  caption: string;
  themeVariant:
    | 'scissors'
    | 'beard'
    | 'champi'
    | 'neck_massage'
    | 'keratin'
    | 'facial'
    | 'groom'
    | 'trim';
  angleIndex: 0 | 1 | 2;
  imageUrl?: string;
  needsRealPhoto?: boolean;
  photoPromptNote?: string;
}

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  price: number; // INR
  durationMinutes: number;
  shortSummary: string;
  description: string;
  includedSteps: string[];
  recommendedFor: string;
  imageUrl?: string;
  plates: [ServicePlate, ServicePlate, ServicePlate];
}

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface Employee {
  id: string;
  name: string;
  role: string;
  specialty: string;
  experienceYears: number;
  phone: string;
  primaryZone: string;
  rating: number;
  completedAppointments: number;
  active: boolean;
  shiftHours: string;
  shiftStart?: string; // e.g. '09:00 AM'
  shiftEnd?: string; // e.g. '07:00 PM'
  breakStart?: string; // e.g. '01:00 PM'
  breakEnd?: string; // e.g. '02:00 PM'
  workingDays?: DayOfWeek[];
  holidays?: string[]; // YYYY-MM-DD dates off
  avatarInitials: string;
  bio: string;
  portraitUrl?: string;
  offeredServiceIds: string[];
  availableSlots: string[];
}

export type GenderOption = 'Male' | 'Female' | 'Non-Binary';

export interface MemberGuest {
  id: string;
  label: string;
  age: number;
  gender: GenderOption;
  serviceIds: string[];
  assignedEmployeeId: string;
}

export interface HyderabadArea {
  id: string;
  name: string;
  zone:
    | 'West Cyberabad'
    | 'Central Heritage'
    | 'North Secunderabad'
    | 'South & East Corridor';
  lat: number;
  lng: number;
  pinCode: string;
  landmarkHint: string;
  distanceKmFromStudio: number;
}

export interface AdminMessage {
  id: string;
  sentAt: string;
  sender: 'Shop Owner' | 'Customer';
  channel: 'Portal Message' | 'WhatsApp' | 'Email';
  content: string;
}

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'No-Show';

export interface BookingRecord {
  id: string;
  bookingRef: string;
  createdAt: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. '12:00 PM - 01:00 PM'
  serviceMode: 'Flagship Studio (Jubilee Hills)' | 'Home / On-Location Service';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  hyderabadArea: string;
  fullAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  memberCount: number;
  members: MemberGuest[];
  selectedServiceIds: string[];
  isCustomPackage: boolean;
  packageName?: string;
  subtotalAmount: number;
  packageDiscount: number;
  homeVisitFee: number;
  totalAmount: number;
  totalDurationMinutes: number;
  primaryEmployeeId: string;
  assignedEmployeeIds: string[];
  status: BookingStatus;
  notes: string;
  messages: AdminMessage[];
}

export interface DayBusinessHours {
  day: DayOfWeek;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string;
  breakEnd: string;
}

export interface BusinessProfile {
  // Business Identity
  salonName: string;
  contactPersonName: string;
  businessDescription: string;
  // Contact Information
  primaryPhone: string;
  whatsappNumber: string;
  businessEmail: string;
  // Physical Location
  streetAddress: string;
  locality: string;
  city: string;
  state: string;
  pinCode: string;
  googleMapsUrl: string;
  // Social Media
  instagramUrl: string;
  facebookUrl: string;
  // Business Hours
  businessHours: DayBusinessHours[];
  // Booking Policies
  cancellationPolicy: string;
  reschedulingPolicy: string;
  bookingInstructions: string;
  // Customer Announcement
  announcementText: string;
  announcementActive: boolean;
  updatedAt?: string;
}

export type ActivePage =
  | 'dashboard'
  | 'services'
  | 'book'
  | 'stylists'
  | 'contact'
  | 'admin';
