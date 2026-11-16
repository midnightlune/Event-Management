import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Phone must be 10-15 digits").optional().or(z.literal("")),
  role: z.enum(["CUSTOMER", "ORGANIZER"]).default("CUSTOMER"), // ADMIN can never be self-registered
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const bookingSchema = z.object({
  showId: z.number().int().positive(),
  showSeatIds: z.array(z.number().int().positive()).min(1, "Select at least one seat").max(8, "You can book at most 8 seats at once"),
});

export const paySchema = z.object({ method: z.enum(["UPI", "CARD", "NETBANKING", "WALLET"]) });

export const reviewSchema = z.object({
  eventId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(500),
});

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(150),
  category: z.enum(["CONCERT", "MOVIE", "SPORTS", "THEATRE", "CONFERENCE", "OTHER"]),
  description: z.string().trim().min(10).max(2000),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  venueId: z.number().int().positive(),
  startTime: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, "Invalid start time"),
  endTime: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, "Invalid end time"),
});

export const showSchema = z.object({
  venueId: z.number().int().positive(),
  startTime: eventSchema.shape.startTime,
  endTime: eventSchema.shape.endTime,
});

export const venueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(255).optional().default(""),
  rows: z.number().int().min(1).max(26),
  seatsPerRow: z.number().int().min(1).max(30),
  vipPrice: z.number().min(0).max(1000000),
  goldPrice: z.number().min(0).max(1000000),
  silverPrice: z.number().min(0).max(1000000),
});

export const userUpdateSchema = z.object({
  role: z.enum(["CUSTOMER", "ORGANIZER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

/** 'YYYY-MM-DDTHH:mm' (from <input type=datetime-local>) -> 'YYYY-MM-DD HH:mm:00' for MySQL */
export function toMysqlDateTime(v: string) {
  const s = v.replace("T", " ");
  return s.length === 16 ? s + ":00" : s.slice(0, 19);
}
