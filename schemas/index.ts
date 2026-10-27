/**
 * eventSync DB Schemas (Reference Only)
 * -------------------------------------
 * These TypeScript interfaces represent the exact structure of the normalized
 * relational PostgreSQL architecture depicted in the ER Diagram.
 */

export interface User {
  user_id: string;      // Primary Key (UUID)
  name: string;
  email: string;
  phone: string;
  password?: string;    // Highly sensitive (typically hashed)
}

export interface Organizer {
  organizer_id: string; // Primary Key (UUID)
  name: string;
  email: string;
  phone: string;
  organization_name: string;
}

export interface EventCategory {
  category_id: string;  // Primary Key (UUID)
  name: string;
  description: string;
}

export interface Event {
  event_id: string;     // Primary Key (UUID)
  organizer_id: string; // Foreign Key -> Organizer
  category_id: string;  // Foreign Key -> EventCategory
  title: string;
  description: string;
  location: string;
  date: Date | string;
  capacity: number;
  price: number;
}

export interface EventImage {
  image_id: string;     // Primary Key (UUID)
  event_id: string;     // Foreign Key -> Event
  url: string;
}

export interface Booking {
  booking_id: string;   // Primary Key (UUID)
  user_id: string;      // Foreign Key -> User
  event_id: string;     // Foreign Key -> Event
  booking_date: Date | string;
  ticket_count: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}

export interface Payment {
  payment_id: string;   // Primary Key (UUID)
  booking_id: string;   // Foreign Key -> Booking (1-to-1 strict ledger)
  amount: number;
  method: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  time: Date | string;
}
