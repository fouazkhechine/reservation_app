CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_dzd INTEGER NOT NULL CHECK (price_dzd >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(day_of_week)
);
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  CHECK (end_at > start_at)
);
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  commune TEXT NOT NULL,
  address TEXT NOT NULL,
  additional_notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  total_price_dzd INTEGER NOT NULL CHECK (total_price_dzd >= 0),
  total_duration INTEGER NOT NULL CHECK (total_duration > 0),
  status booking_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'));
CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON bookings(start_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT NOT NULL,
  service_price_snapshot INTEGER NOT NULL,
  service_duration_snapshot INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  old_status booking_status,
  new_status booking_status NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO working_hours(day_of_week, opening_time, closing_time)
VALUES (0, '09:00', '18:00'), (1, '09:00', '18:00'), (2, '09:00', '18:00'), (3, '09:00', '18:00'), (4, '09:00', '18:00'), (5, '09:00', '18:00')
ON CONFLICT (day_of_week) DO NOTHING;
INSERT INTO services(name, description, price_dzd, duration_minutes, image_url)
SELECT * FROM (VALUES
 ('Coupe classique', 'Coupe précise, finitions aux ciseaux', 1800, 45, 'https://images.unsplash.com/photo-1635346087012-50cffbeb575f?auto=format&fit=crop&w=600&q=85'),
 ('Dégradé', 'Dégradé progressif et contours nets', 2200, 50, 'https://images.unsplash.com/photo-1635346125627-74d1b2867898?auto=format&fit=crop&w=600&q=85'),
 ('Skin fade', 'Dégradé à blanc, finition premium', 2500, 60, 'https://images.unsplash.com/photo-1790575546981-3ed726a823f1?auto=format&fit=crop&w=600&q=85'),
 ('Taille de barbe', 'Sculpture, serviette chaude et huile', 1200, 30, 'https://images.unsplash.com/photo-1788627720467-a7a751bcd9de?auto=format&fit=crop&w=600&q=85'),
 ('Coupe + barbe', 'Rituel complet signature à domicile', 3200, 75, 'https://images.unsplash.com/photo-1635346125627-74d1b2867898?auto=format&fit=crop&w=600&q=85'),
 ('Soin capillaire', 'Shampoing, massage et coiffage', 900, 25, 'https://images.unsplash.com/photo-1635346087012-50cffbeb575f?auto=format&fit=crop&w=600&q=85')
) AS seed(name, description, price_dzd, duration_minutes, image_url)
WHERE NOT EXISTS (SELECT 1 FROM services);
