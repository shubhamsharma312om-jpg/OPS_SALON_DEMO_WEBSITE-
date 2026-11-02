import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  DAYS_OF_WEEK,
  EMPLOYEE_PORTRAIT_MAP,
  INITIAL_BUSINESS_PROFILE,
  INITIAL_EMPLOYEES,
  INITIAL_SERVICES,
  SALON_UPLOADED_ASSETS,
  TIME_SLOTS,
  createInitialBookings,
} from './src/data/initialSalonData';
import {
  BookingRecord,
  BookingStatus,
  BusinessProfile,
  Employee,
  ServiceItem,
} from './src/types/salon';
import {
  calculateMultiMemberBookingPricing,
  checkEmployeeAvailability,
  isValidEmail,
  isValidHttpUrl,
  isValidPhone,
} from './src/utils/salonPricingAndValidation';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ops_salon_db.json');

// Owner credentials verified strictly server-side using timing-safe scrypt comparison
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'ops').trim();
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'Ops@2026';
const SCRYPT_SALT = crypto.randomBytes(16);
const EXPECTED_PASSCODE_HASH = crypto.scryptSync(ADMIN_PASSCODE, SCRYPT_SALT, 64);

function verifyCredentials(usernameInput: string, passcodeInput: string): boolean {
  const cleanUser = usernameInput.trim();
  const userBuf = Buffer.from(cleanUser, 'utf8');
  const expectedUserBuf = Buffer.from(ADMIN_USERNAME, 'utf8');
  const userMatches =
    userBuf.length === expectedUserBuf.length &&
    crypto.timingSafeEqual(userBuf, expectedUserBuf);

  const inputHash = crypto.scryptSync(passcodeInput, SCRYPT_SALT, 64);
  const passMatches = crypto.timingSafeEqual(inputHash, EXPECTED_PASSCODE_HASH);

  return userMatches && passMatches;
}

// Active Admin Sessions (Token -> Expiry Timestamp)
const activeAdminSessions = new Map<string, number>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeAdminSessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidAdminToken(token?: string): boolean {
  if (!token) return false;
  const expiry = activeAdminSessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    activeAdminSessions.delete(token);
    return false;
  }
  return true;
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  return authHeader.slice(7).trim();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!isValidAdminToken(token)) {
    res.status(401).json({
      error: 'Unauthorized: Valid owner authentication session is required for this action.',
    });
    return;
  }
  next();
}

interface PersistedDatabase {
  services: ServiceItem[];
  employees: Employee[];
  bookings: BookingRecord[];
  businessProfile: BusinessProfile;
}

const SERVICE_PHOTO_URLS = new Set<string>([
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

function normalizeUploadedAssetUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) return '';
  const trimmed = rawUrl.trim();
  const uploadMatch = trimmed.match(/\/(?:assets\/aistudio|images\/uploads)\/((?:emp-upload-|srv-upload-|upload-)[^/?#]+)$/);
  if (uploadMatch) {
    return `/api/uploads/${uploadMatch[1]}`;
  }
  return trimmed;
}

function resolveEmployeePortraitUrl(empId: string, currentUrl?: string): string {
  const defaultAvatar =
    EMPLOYEE_PORTRAIT_MAP[empId] || SALON_UPLOADED_ASSETS.empPortraitAarav;
  if (!currentUrl || !currentUrl.trim()) {
    return defaultAvatar;
  }
  const normalized = normalizeUploadedAssetUrl(currentUrl);
  // Reset deleted cropped files, old SVG placeholders, or service action shots that were previously used on employee cards
  if (
    normalized.includes('/assets/aistudio/emp-portrait-') ||
    normalized.includes('/assets/aistudio/srv-') ||
    normalized.includes('/assets/aistudio/studio-gallery-') ||
    normalized.startsWith('/images/employees/emp-') ||
    SERVICE_PHOTO_URLS.has(normalized)
  ) {
    return defaultAvatar;
  }
  // Preserve any admin-uploaded image (/api/uploads/..., data:image/..., or custom URL)
  return normalized;
}

function sanitizeServices(services?: ServiceItem[]): ServiceItem[] {
  if (!Array.isArray(services) || services.length === 0) {
    return INITIAL_SERVICES;
  }

  return services.map((srv, idx) => {
    const rawPlates = Array.isArray(srv.plates) && srv.plates.length > 0 ? srv.plates : [];
    const normalizedMainUrl = normalizeUploadedAssetUrl(
      srv.imageUrl || rawPlates[0]?.imageUrl || SALON_UPLOADED_ASSETS.scissorTexture
    );

    const buildPlate = (plateIdx: 0 | 1 | 2) => {
      const existingPlate = rawPlates[plateIdx];
      const plateUrl = normalizeUploadedAssetUrl(
        existingPlate?.imageUrl || normalizedMainUrl
      );
      const isUploadedPhoto =
        plateUrl.startsWith('/api/uploads/') ||
        plateUrl.startsWith('data:image/') ||
        plateUrl.startsWith('/assets/aistudio/');
      return {
        id: existingPlate?.id || `${srv.id}-p${plateIdx + 1}`,
        label:
          existingPlate?.label ||
          `Plate 0${plateIdx + 1} · ${srv.name}`,
        caption:
          existingPlate?.caption ||
          `${srv.name} — View 0${plateIdx + 1}`,
        themeVariant: existingPlate?.themeVariant || ('scissors' as const),
        angleIndex: plateIdx,
        imageUrl: plateUrl,
        needsRealPhoto: isUploadedPhoto ? false : Boolean(existingPlate?.needsRealPhoto),
        photoPromptNote: isUploadedPhoto ? undefined : existingPlate?.photoPromptNote,
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
      imageUrl: plates[0].imageUrl || normalizedMainUrl,
      includedSteps:
        Array.isArray(srv.includedSteps) && srv.includedSteps.length > 0
          ? srv.includedSteps
          : ['Personal consultation & preparation', 'Signature ritual execution', 'Finishing & aftercare guidance'],
      plates,
    };
  });
}

function sanitizeEmployees(employees: Employee[]): Employee[] {
  const existingIds = new Set(employees.map((e) => e.id));
  const combined = [...employees];
  for (const initEmp of INITIAL_EMPLOYEES) {
    if (!existingIds.has(initEmp.id)) {
      combined.push(initEmp);
    }
  }

  return combined.map((e) => {
    const initialMatch = INITIAL_EMPLOYEES.find((ie) => ie.id === e.id);
    const mergedServices = Array.from(
      new Set([
        ...(e.offeredServiceIds || []),
        ...(initialMatch?.offeredServiceIds || ['srv-haircut', 'srv-beard', 'srv-head-massage']),
      ])
    );

    return {
      ...e,
      phone:
        e.phone && /^(\+91\s*98490\s*(11204|22819|33910|44512|55801))$/.test(e.phone.trim())
          ? ''
          : e.phone || '',
      portraitUrl: resolveEmployeePortraitUrl(e.id, e.portraitUrl),
      workingDays:
        e.workingDays && e.workingDays.length > 0 ? e.workingDays : [...DAYS_OF_WEEK],
      holidays: Array.isArray(e.holidays) ? e.holidays : [],
      offeredServiceIds: mergedServices,
      availableSlots:
        e.availableSlots && e.availableSlots.length > 0 ? e.availableSlots : [...TIME_SLOTS],
    };
  });
}

function loadDatabase(): PersistedDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
      const loadedDb: PersistedDatabase = {
        services: sanitizeServices(parsed.services),
        employees: sanitizeEmployees(
          Array.isArray(parsed.employees) && parsed.employees.length > 0
            ? parsed.employees
            : INITIAL_EMPLOYEES
        ),
        bookings:
          Array.isArray(parsed.bookings) && parsed.bookings.length > 0
            ? parsed.bookings
            : createInitialBookings(),
        businessProfile: {
          ...INITIAL_BUSINESS_PROFILE,
          ...(parsed.businessProfile || {}),
          businessHours:
            Array.isArray(parsed.businessProfile?.businessHours) &&
            parsed.businessProfile!.businessHours.length === 7
              ? parsed.businessProfile!.businessHours
              : INITIAL_BUSINESS_PROFILE.businessHours,
        },
      };
      return loadedDb;
    }
  } catch (err) {
    console.error('Error loading OPS Salon database, initializing default state:', err);
  }

  const initialDb: PersistedDatabase = {
    services: sanitizeServices(INITIAL_SERVICES),
    employees: sanitizeEmployees(INITIAL_EMPLOYEES),
    bookings: createInitialBookings(),
    businessProfile: INITIAL_BUSINESS_PROFILE,
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: PersistedDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error saving OPS Salon database:', err);
  }
}

let dbState: PersistedDatabase = loadDatabase();

// Server-side atomic reservation mutex
let bookingLockPromise: Promise<void> = Promise.resolve();

async function withServerBookingLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let release!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previousLock = bookingLockPromise;
  bookingLockPromise = previousLock.then(() => nextLock);
  await previousLock;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Serve admin-uploaded images directly via /api/uploads/:filename (bypasses external /assets/aistudio/ proxy & Vite watcher)
  app.get('/api/uploads/:filename', (req: Request, res: Response) => {
    const safeName = path.basename(req.params.filename || '');
    if (!safeName) {
      res.status(404).end();
      return;
    }

    const candidates = [
      path.resolve(process.cwd(), 'public', 'images', 'uploads', safeName),
      path.resolve(process.cwd(), 'public', 'assets', 'aistudio', safeName),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(safeName).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.avif': 'image/avif',
        };
        res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.sendFile(filePath);
        return;
      }
    }

    res.status(404).json({ error: 'Uploaded image not found.' });
  });

  // 1. Public & Admin State Hydration
  app.get('/api/state', (req: Request, res: Response) => {
    dbState = loadDatabase();
    const isAdmin = isValidAdminToken(extractBearerToken(req));
    res.json({
      services: dbState.services,
      employees: dbState.employees,
      businessProfile: dbState.businessProfile,
      bookings: dbState.bookings,
      isAdminAuthenticated: isAdmin,
    });
  });

  // Merge any browser-persisted records safely without losing existing bookings or employees
  app.post('/api/state/sync-client', (req: Request, res: Response) => {
    dbState = loadDatabase();
    const { clientBookings, clientEmployees } = req.body || {};
    let changed = false;

    if (Array.isArray(clientBookings)) {
      const existingIds = new Set(dbState.bookings.map((b) => b.id));
      for (const b of clientBookings) {
        if (b && b.id && !existingIds.has(b.id)) {
          dbState.bookings.unshift(b);
          existingIds.add(b.id);
          changed = true;
        }
      }
    }

    if (Array.isArray(clientEmployees)) {
      const existingEmpIds = new Set(dbState.employees.map((e) => e.id));
      for (const emp of clientEmployees) {
        if (emp && emp.id && !existingEmpIds.has(emp.id)) {
          dbState.employees.push(emp);
          existingEmpIds.add(emp.id);
          changed = true;
        }
      }
      dbState.employees = sanitizeEmployees(dbState.employees);
    }

    if (changed) {
      saveDatabase(dbState);
    }

    res.json({
      ok: true,
      employees: dbState.employees,
      bookings: dbState.bookings,
      businessProfile: dbState.businessProfile,
    });
  });

  // 2. Owner Authentication Endpoints
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, passcode } = req.body || {};
    if (typeof username !== 'string' || typeof passcode !== 'string') {
      res.status(400).json({ error: 'Please enter both your username and passcode.' });
      return;
    }

    if (!verifyCredentials(username, passcode)) {
      res.status(401).json({
        error: 'Incorrect username or passcode. Please verify your owner credentials and try again.',
      });
      return;
    }

    const token = createAdminSession();
    res.json({
      ok: true,
      token,
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) {
      activeAdminSessions.delete(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    res.json({ authenticated: isValidAdminToken(token) });
  });

  // 3. Business Profile Settings (Protected by requireAdminAuth)
  app.put('/api/business-profile', requireAdminAuth, (req: Request, res: Response) => {
    const incoming = req.body as Partial<BusinessProfile>;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid business profile payload.' });
      return;
    }

    const salonName = (incoming.salonName || '').trim();
    if (!salonName) {
      res.status(400).json({ error: 'Salon display name is required.' });
      return;
    }

    if (incoming.primaryPhone?.trim() && !isValidPhone(incoming.primaryPhone)) {
      res.status(400).json({
        error: 'Primary phone number must contain between 10 and 15 digits.',
      });
      return;
    }

    if (incoming.whatsappNumber?.trim() && !isValidPhone(incoming.whatsappNumber)) {
      res.status(400).json({
        error: 'WhatsApp number must contain between 10 and 15 digits.',
      });
      return;
    }

    if (incoming.businessEmail?.trim() && !isValidEmail(incoming.businessEmail)) {
      res.status(400).json({
        error: 'Please enter a valid business email address.',
      });
      return;
    }

    if (incoming.googleMapsUrl?.trim() && !isValidHttpUrl(incoming.googleMapsUrl)) {
      res.status(400).json({
        error: 'Google Maps URL must be a valid http:// or https:// URL.',
      });
      return;
    }

    if (incoming.instagramUrl?.trim() && !isValidHttpUrl(incoming.instagramUrl)) {
      res.status(400).json({
        error: 'Instagram URL must be a valid http:// or https:// URL.',
      });
      return;
    }

    if (incoming.facebookUrl?.trim() && !isValidHttpUrl(incoming.facebookUrl)) {
      res.status(400).json({
        error: 'Facebook URL must be a valid http:// or https:// URL.',
      });
      return;
    }

    dbState = loadDatabase();
    const updatedProfile: BusinessProfile = {
      ...dbState.businessProfile,
      salonName,
      contactPersonName: (incoming.contactPersonName || '').trim(),
      businessDescription: (incoming.businessDescription || '').trim(),
      primaryPhone: (incoming.primaryPhone || '').trim(),
      whatsappNumber: (incoming.whatsappNumber || '').trim(),
      businessEmail: (incoming.businessEmail || '').trim(),
      streetAddress: (incoming.streetAddress || '').trim(),
      locality: (incoming.locality || '').trim(),
      city: (incoming.city || 'Hyderabad').trim(),
      state: (incoming.state || 'Telangana').trim(),
      pinCode: (incoming.pinCode || '').trim(),
      googleMapsUrl: (incoming.googleMapsUrl || '').trim(),
      instagramUrl: (incoming.instagramUrl || '').trim(),
      facebookUrl: (incoming.facebookUrl || '').trim(),
      businessHours:
        Array.isArray(incoming.businessHours) && incoming.businessHours.length === 7
          ? incoming.businessHours
          : dbState.businessProfile.businessHours,
      cancellationPolicy: (incoming.cancellationPolicy || '').trim(),
      reschedulingPolicy: (incoming.reschedulingPolicy || '').trim(),
      bookingInstructions: (incoming.bookingInstructions || '').trim(),
      announcementText: (incoming.announcementText || '').trim(),
      announcementActive: Boolean(incoming.announcementActive),
      updatedAt: new Date().toISOString(),
    };

    dbState.businessProfile = updatedProfile;
    saveDatabase(dbState);

    res.json({
      ok: true,
      businessProfile: updatedProfile,
    });
  });

  // 4. Atomic Booking Creation with Server-Side Price & Conflict Validation
  app.post('/api/bookings', async (req: Request, res: Response) => {
    try {
      const result = await withServerBookingLock(() => {
        dbState = loadDatabase();
        const incoming = req.body as BookingRecord;
        if (!incoming || !Array.isArray(incoming.members) || incoming.members.length === 0) {
          return {
            status: 400,
            body: { error: 'Booking must include at least 1 member and selected service(s).' },
          };
        }

        if (incoming.members.length > 6) {
          return {
            status: 400,
            body: { error: 'Bookings support a maximum of 6 members per appointment.' },
          };
        }

        // Validate intra-booking conflict & employee availability against latest DB state
        const usedEmpIds = new Set<string>();
        for (const member of incoming.members) {
          const emp = dbState.employees.find((e) => e.id === member.assignedEmployeeId);
          if (!emp) {
            return {
              status: 400,
              body: { error: `Selected stylist for ${member.label} could not be found.` },
            };
          }
          if (usedEmpIds.has(emp.id)) {
            return {
              status: 409,
              body: {
                error: `${emp.name} cannot be assigned to multiple members simultaneously in the same ${incoming.timeSlot} slot. Please select another available stylist for ${member.label}.`,
              },
            };
          }
          usedEmpIds.add(emp.id);

          const memberDuration = (member.serviceIds || []).reduce((sum, sid) => {
            const srv = dbState.services.find((s) => s.id === sid);
            return sum + (srv ? srv.durationMinutes : 30);
          }, 0);

          const check = checkEmployeeAvailability({
            employee: emp,
            appointmentDate: incoming.appointmentDate,
            timeSlot: incoming.timeSlot,
            requestedDurationMinutes: Math.max(60, memberDuration),
            requiredServiceIds: member.serviceIds,
            existingBookings: dbState.bookings,
            allServices: dbState.services,
            businessProfile: dbState.businessProfile,
          });

          if (!check.available) {
            return {
              status: 409,
              body: {
                error: `${emp.name} is no longer available on ${incoming.appointmentDate} at ${incoming.timeSlot} (${check.message}). Please select another time slot or stylist.`,
              },
            };
          }
        }

        // Server-side authoritative pricing calculation (prevents double discounts or tampered totals)
        const authoritativePricing = calculateMultiMemberBookingPricing(
          incoming.members,
          dbState.services,
          dbState.employees,
          incoming.serviceMode
        );

        const assignedEmployeeIds = Array.from(
          new Set(incoming.members.map((m) => m.assignedEmployeeId))
        );

        const verifiedBooking: BookingRecord = {
          ...incoming,
          id: incoming.id || `bk-${Date.now()}`,
          bookingRef:
            incoming.bookingRef || `NZM-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: incoming.createdAt || new Date().toISOString(),
          memberCount: incoming.members.length,
          selectedServiceIds: authoritativePricing.allServiceIds,
          isCustomPackage: authoritativePricing.isCustomPackage,
          subtotalAmount: authoritativePricing.subtotal,
          packageDiscount: authoritativePricing.discountAmount,
          homeVisitFee: authoritativePricing.homeVisitFee,
          totalAmount: authoritativePricing.totalAmount,
          totalDurationMinutes: authoritativePricing.totalDurationMinutes,
          primaryEmployeeId: assignedEmployeeIds[0],
          assignedEmployeeIds,
          status: incoming.status || 'Confirmed',
        };

        dbState.bookings = [verifiedBooking, ...dbState.bookings];
        saveDatabase(dbState);

        return {
          status: 201,
          body: {
            ok: true,
            booking: verifiedBooking,
            bookings: dbState.bookings,
          },
        };
      });

      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Error creating booking:', err);
      res.status(500).json({ error: 'Unable to save booking. Please try again.' });
    }
  });

  // 5. Update Booking Status or Reschedule Appointment (Protected by requireAdminAuth)
  app.patch('/api/bookings/:id', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.id;
      const { status, appointmentDate, timeSlot, notes } = req.body as {
        status?: BookingStatus;
        appointmentDate?: string;
        timeSlot?: string;
        notes?: string;
      };

      const result = await withServerBookingLock(() => {
        dbState = loadDatabase();
        const idx = dbState.bookings.findIndex((b) => b.id === bookingId);
        if (idx === -1) {
          return { status: 404, body: { error: 'Appointment record not found.' } };
        }

        const existing = dbState.bookings[idx];
        const nextDate = appointmentDate || existing.appointmentDate;
        const nextSlot = timeSlot || existing.timeSlot;
        const nextStatus = status || existing.status;

        // If rescheduling to a new date/slot (and status is active), verify no conflicts
        const isRescheduling =
          nextDate !== existing.appointmentDate || nextSlot !== existing.timeSlot;
        const isActivatingCancelled =
          (existing.status === 'Cancelled' || existing.status === 'No-Show') &&
          nextStatus !== 'Cancelled' &&
          nextStatus !== 'No-Show';

        if (
          (isRescheduling || isActivatingCancelled) &&
          nextStatus !== 'Cancelled' &&
          nextStatus !== 'No-Show'
        ) {
          for (const member of existing.members) {
            const emp = dbState.employees.find((e) => e.id === member.assignedEmployeeId);
            if (!emp) continue;

            const memberDuration = (member.serviceIds || []).reduce((sum, sid) => {
              const srv = dbState.services.find((s) => s.id === sid);
              return sum + (srv ? srv.durationMinutes : 30);
            }, 0);

            const check = checkEmployeeAvailability({
              employee: emp,
              appointmentDate: nextDate,
              timeSlot: nextSlot,
              requestedDurationMinutes: Math.max(60, memberDuration),
              requiredServiceIds: member.serviceIds,
              existingBookings: dbState.bookings,
              excludeBookingId: existing.id,
              allServices: dbState.services,
              businessProfile: dbState.businessProfile,
            });

            if (!check.available) {
              return {
                status: 409,
                body: {
                  error: `Cannot reschedule: ${emp.name} is unavailable on ${nextDate} at ${nextSlot} (${check.message}).`,
                },
              };
            }
          }
        }

        const updated: BookingRecord = {
          ...existing,
          status: nextStatus,
          appointmentDate: nextDate,
          timeSlot: nextSlot,
          notes: notes !== undefined ? notes : existing.notes,
        };

        dbState.bookings[idx] = updated;
        saveDatabase(dbState);

        return {
          status: 200,
          body: {
            ok: true,
            booking: updated,
            bookings: dbState.bookings,
          },
        };
      });

      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Error updating booking:', err);
      res.status(500).json({ error: 'Failed to update appointment.' });
    }
  });

  // 6. Verified Customer Booking Lookup (Requires Booking Ref + Matching Phone Number)
  app.post('/api/bookings/lookup', (req: Request, res: Response) => {
    const { bookingRef, phone } = req.body as { bookingRef?: string; phone?: string };
    const cleanRef = (bookingRef || '').trim().toLowerCase();
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '');

    if (!cleanRef || cleanPhoneDigits.length < 4) {
      res.status(400).json({
        error:
          'Please enter both your Booking Reference (e.g., NZM-8401) and at least the last 4 digits of the phone number used when booking.',
      });
      return;
    }

    dbState = loadDatabase();
    const matched = dbState.bookings.find((b) => {
      const refMatches = b.bookingRef.toLowerCase() === cleanRef;
      const bookingPhoneDigits = b.customerPhone.replace(/\D/g, '');
      const phoneMatches =
        bookingPhoneDigits.endsWith(cleanPhoneDigits) ||
        (cleanPhoneDigits.length >= 10 && bookingPhoneDigits.includes(cleanPhoneDigits.slice(-10)));
      return refMatches && phoneMatches;
    });

    if (!matched) {
      res.status(404).json({
        error:
          'No booking matched that Booking Reference and phone number combination. Please verify both details.',
      });
      return;
    }

    res.json({
      ok: true,
      booking: matched,
    });
  });

  // 7. Send Message on Booking (Owner or Verified Customer)
  app.post('/api/bookings/:id/messages', (req: Request, res: Response) => {
    const bookingId = req.params.id;
    const { sender, channel, content, customerPhone } = req.body as {
      sender: 'Shop Owner' | 'Customer';
      channel: 'Portal Message' | 'WhatsApp' | 'Email';
      content: string;
      customerPhone?: string;
    };

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    dbState = loadDatabase();
    const idx = dbState.bookings.findIndex((b) => b.id === bookingId);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    if (sender === 'Shop Owner') {
      if (!isValidAdminToken(extractBearerToken(req))) {
        res.status(401).json({ error: 'Unauthorized: Owner session required.' });
        return;
      }
    } else {
      const targetPhoneDigits = dbState.bookings[idx].customerPhone.replace(/\D/g, '');
      const providedDigits = (customerPhone || '').replace(/\D/g, '');
      if (
        providedDigits.length < 4 ||
        (!targetPhoneDigits.endsWith(providedDigits) &&
          !targetPhoneDigits.includes(providedDigits.slice(-10)))
      ) {
        res.status(403).json({
          error: 'Phone verification required to post a message to this booking.',
        });
        return;
      }
    }

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMsg = {
      id: `msg-${Date.now()}`,
      sentAt: timestamp,
      sender,
      channel: channel || 'Portal Message',
      content: content.trim(),
    };

    dbState.bookings[idx] = {
      ...dbState.bookings[idx],
      messages: [...dbState.bookings[idx].messages, newMsg],
    };
    saveDatabase(dbState);

    res.json({
      ok: true,
      booking: dbState.bookings[idx],
      bookings: dbState.bookings,
    });
  });

  // 8. Employee Management Endpoints (Protected by requireAdminAuth)
  app.post('/api/employees', requireAdminAuth, (req: Request, res: Response) => {
    const incoming = req.body as Omit<Employee, 'id' | 'rating' | 'completedAppointments'>;
    if (!incoming || !incoming.name?.trim()) {
      res.status(400).json({ error: 'Employee name is required.' });
      return;
    }

    dbState = loadDatabase();
    const created: Employee = {
      ...incoming,
      id: `emp-${Date.now()}`,
      name: incoming.name.trim(),
      phone: (incoming.phone || '').trim(),
      portraitUrl: normalizeUploadedAssetUrl(incoming.portraitUrl) || SALON_UPLOADED_ASSETS.empPortraitAarav,
      rating: 4.9,
      completedAppointments: 0,
      workingDays:
        incoming.workingDays && incoming.workingDays.length > 0
          ? incoming.workingDays
          : [...DAYS_OF_WEEK],
      holidays: Array.isArray(incoming.holidays) ? incoming.holidays : [],
    };

    dbState.employees = [...dbState.employees, created];
    saveDatabase(dbState);

    res.status(201).json({
      ok: true,
      employee: created,
      employees: dbState.employees,
    });
  });

  app.put('/api/employees/:id', requireAdminAuth, (req: Request, res: Response) => {
    const empId = req.params.id;
    const incoming = req.body as Employee;

    dbState = loadDatabase();
    const idx = dbState.employees.findIndex((e) => e.id === empId);
    if (idx === -1) {
      res.status(404).json({ error: 'Employee record not found.' });
      return;
    }

    dbState.employees[idx] = {
      ...dbState.employees[idx],
      ...incoming,
      id: empId,
      phone: (incoming.phone || '').trim(),
      portraitUrl:
        normalizeUploadedAssetUrl(incoming.portraitUrl) ||
        dbState.employees[idx].portraitUrl,
    };
    saveDatabase(dbState);

    res.json({
      ok: true,
      employee: dbState.employees[idx],
      employees: dbState.employees,
    });
  });

  app.delete('/api/employees/:id', requireAdminAuth, (req: Request, res: Response) => {
    const empId = req.params.id;
    dbState = loadDatabase();
    if (dbState.employees.length <= 1) {
      res.status(400).json({ error: 'At least one stylist must remain in the roster.' });
      return;
    }
    dbState.employees = dbState.employees.filter((e) => e.id !== empId);
    saveDatabase(dbState);

    res.json({
      ok: true,
      employees: dbState.employees,
    });
  });

  // 9. Service Catalog Management Endpoints (Create, Edit, Upload Images, Delete — Protected by requireAdminAuth)
  app.post('/api/services', requireAdminAuth, (req: Request, res: Response) => {
    const incoming = req.body as Partial<ServiceItem> & { qualifiedEmployeeIds?: string[] };
    if (!incoming || !incoming.name?.trim()) {
      res.status(400).json({ error: 'Service name is required.' });
      return;
    }

    dbState = loadDatabase();
    const newId = incoming.id?.trim() || `srv-custom-${Date.now()}`;
    const nextCode =
      incoming.code?.trim() || String(dbState.services.length + 1).padStart(2, '0');

    const rawPlates = Array.isArray(incoming.plates) ? incoming.plates : [];
    const mainImg = normalizeUploadedAssetUrl(
      incoming.imageUrl || rawPlates[0]?.imageUrl || SALON_UPLOADED_ASSETS.scissorTexture
    );

    const buildNewPlate = (idx: 0 | 1 | 2) => {
      const p = rawPlates[idx];
      const url = normalizeUploadedAssetUrl(p?.imageUrl || mainImg);
      return {
        id: p?.id || `${newId}-p${idx + 1}`,
        label: p?.label?.trim() || `Plate 0${idx + 1} · ${incoming.name!.trim()}`,
        caption: p?.caption?.trim() || `${incoming.name!.trim()} — View 0${idx + 1}`,
        themeVariant: p?.themeVariant || ('scissors' as const),
        angleIndex: idx,
        imageUrl: url,
        needsRealPhoto: false,
      };
    };

    const createdService: ServiceItem = {
      id: newId,
      code: nextCode,
      name: incoming.name.trim(),
      category: incoming.category || 'Haircut & Styling',
      price: Math.max(50, Number(incoming.price) || 650),
      durationMinutes: Math.max(15, Number(incoming.durationMinutes) || 40),
      shortSummary:
        incoming.shortSummary?.trim() ||
        incoming.description?.trim() ||
        `Bespoke ${incoming.category || 'grooming'} ritual crafted at OPS Salon Hyderabad.`,
      description:
        incoming.description?.trim() ||
        incoming.shortSummary?.trim() ||
        `Signature ${incoming.name.trim()} performed by our senior specialists.`,
      includedSteps:
        Array.isArray(incoming.includedSteps) && incoming.includedSteps.length > 0
          ? incoming.includedSteps.filter((s) => Boolean(s && s.trim()))
          : [
              'Personal consultation & preparation',
              'Signature treatment execution',
              'Finishing & styling check',
            ],
      recommendedFor: incoming.recommendedFor?.trim() || 'All Clients · Studio & Home Service',
      imageUrl: buildNewPlate(0).imageUrl,
      plates: [buildNewPlate(0), buildNewPlate(1), buildNewPlate(2)],
    };

    dbState.services = [...dbState.services, createdService];

    // Assign this new service to selected employees (or all active employees by default)
    const targetEmpIds =
      Array.isArray(incoming.qualifiedEmployeeIds) && incoming.qualifiedEmployeeIds.length > 0
        ? incoming.qualifiedEmployeeIds
        : dbState.employees.map((e) => e.id);

    dbState.employees = dbState.employees.map((emp) => {
      if (targetEmpIds.includes(emp.id)) {
        const nextOffered = Array.from(new Set([...(emp.offeredServiceIds || []), createdService.id]));
        return { ...emp, offeredServiceIds: nextOffered };
      }
      return emp;
    });

    saveDatabase(dbState);

    res.status(201).json({
      ok: true,
      service: createdService,
      services: dbState.services,
      employees: dbState.employees,
    });
  });

  app.put('/api/services/:id', requireAdminAuth, (req: Request, res: Response) => {
    const serviceId = req.params.id;
    const incoming = req.body as Partial<ServiceItem> & { qualifiedEmployeeIds?: string[] };

    dbState = loadDatabase();
    const idx = dbState.services.findIndex((s) => s.id === serviceId);
    if (idx === -1) {
      res.status(404).json({ error: 'Service not found.' });
      return;
    }

    const existing = dbState.services[idx];
    const incomingPlates = Array.isArray(incoming.plates) ? incoming.plates : existing.plates;

    const updatedPlates: [
      ServiceItem['plates'][0],
      ServiceItem['plates'][1],
      ServiceItem['plates'][2],
    ] = [0, 1, 2].map((pIdx) => {
      const angle = pIdx as 0 | 1 | 2;
      const incPlate = incomingPlates[angle];
      const curPlate = existing.plates[angle];
      const resolvedUrl = normalizeUploadedAssetUrl(
        incPlate?.imageUrl || curPlate?.imageUrl || existing.imageUrl
      );
      const imageChanged = resolvedUrl !== curPlate?.imageUrl;
      const isUploaded =
        resolvedUrl.startsWith('/api/uploads/') || resolvedUrl.startsWith('data:image/');

      return {
        ...curPlate,
        ...(incPlate || {}),
        id: incPlate?.id || curPlate?.id || `${serviceId}-p${angle + 1}`,
        label: incPlate?.label?.trim() || curPlate?.label || `Plate 0${angle + 1}`,
        caption: incPlate?.caption?.trim() || curPlate?.caption || `${existing.name} — Plate 0${angle + 1}`,
        angleIndex: angle,
        imageUrl: resolvedUrl,
        needsRealPhoto: imageChanged || isUploaded ? false : Boolean(incPlate?.needsRealPhoto),
        photoPromptNote: imageChanged || isUploaded ? undefined : incPlate?.photoPromptNote,
      };
    }) as [ServiceItem['plates'][0], ServiceItem['plates'][1], ServiceItem['plates'][2]];

    const updatedService: ServiceItem = {
      ...existing,
      ...incoming,
      id: serviceId,
      name: incoming.name?.trim() || existing.name,
      category: incoming.category || existing.category,
      price: incoming.price !== undefined ? Math.max(50, Number(incoming.price)) : existing.price,
      durationMinutes:
        incoming.durationMinutes !== undefined
          ? Math.max(10, Number(incoming.durationMinutes))
          : existing.durationMinutes,
      shortSummary: incoming.shortSummary?.trim() || existing.shortSummary,
      description: incoming.description?.trim() || existing.description,
      recommendedFor: incoming.recommendedFor?.trim() || existing.recommendedFor,
      includedSteps:
        Array.isArray(incoming.includedSteps) && incoming.includedSteps.length > 0
          ? incoming.includedSteps.filter((s) => Boolean(s && s.trim()))
          : existing.includedSteps,
      imageUrl: updatedPlates[0].imageUrl || normalizeUploadedAssetUrl(incoming.imageUrl) || existing.imageUrl,
      plates: updatedPlates,
    };

    dbState.services[idx] = updatedService;

    if (Array.isArray(incoming.qualifiedEmployeeIds) && incoming.qualifiedEmployeeIds.length > 0) {
      dbState.employees = dbState.employees.map((emp) => {
        const hasService = (emp.offeredServiceIds || []).includes(serviceId);
        const shouldHave = incoming.qualifiedEmployeeIds!.includes(emp.id);
        if (shouldHave && !hasService) {
          return {
            ...emp,
            offeredServiceIds: [...(emp.offeredServiceIds || []), serviceId],
          };
        }
        if (!shouldHave && hasService && (emp.offeredServiceIds || []).length > 1) {
          return {
            ...emp,
            offeredServiceIds: emp.offeredServiceIds.filter((id) => id !== serviceId),
          };
        }
        return emp;
      });
    }

    saveDatabase(dbState);

    res.json({
      ok: true,
      service: updatedService,
      services: dbState.services,
      employees: dbState.employees,
    });
  });

  app.delete('/api/services/:id', requireAdminAuth, (req: Request, res: Response) => {
    const serviceId = req.params.id;
    dbState = loadDatabase();
    if (dbState.services.length <= 1) {
      res.status(400).json({ error: 'At least one service must remain in the catalog.' });
      return;
    }

    dbState.services = dbState.services.filter((s) => s.id !== serviceId);
    saveDatabase(dbState);

    res.json({
      ok: true,
      services: dbState.services,
    });
  });

  // 10. Upload Image (Employees & Services) — Saves to /public/images/uploads/ and serves via /api/uploads/:filename
  app.post('/api/upload-image', requireAdminAuth, (req: Request, res: Response) => {
    try {
      const { filename, dataUrl, prefix } = req.body as {
        filename?: string;
        dataUrl?: string;
        prefix?: string;
      };
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Please select a valid image file to upload.' });
        return;
      }

      const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({ error: 'Invalid image data format.' });
        return;
      }

      const rawExt = matches[1].toLowerCase();
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt;
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const safePrefix = prefix === 'service' ? 'srv-upload' : 'emp-upload';
      const safeBase = (filename || 'photo')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase()
        .slice(0, 36);
      const outFilename = `${safePrefix}-${safeBase}-${Date.now()}.${ext}`;

      const uploadDir = path.resolve(process.cwd(), 'public', 'images', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const outPath = path.join(uploadDir, outFilename);
      fs.writeFileSync(outPath, buffer);

      // Also save a backup copy in public/assets/aistudio
      const backupDir = path.resolve(process.cwd(), 'public', 'assets', 'aistudio');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(backupDir, outFilename), buffer);

      const publicUrl = `/api/uploads/${outFilename}`;
      res.status(201).json({
        ok: true,
        url: publicUrl,
      });
    } catch (err) {
      console.error('Error uploading image:', err);
      res.status(500).json({ error: 'Failed to save uploaded image.' });
    }
  });

  // Mount Vite or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OPS Salon Hyderabad server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
