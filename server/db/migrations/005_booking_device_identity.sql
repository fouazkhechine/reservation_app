ALTER TABLE bookings ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS bookings_device_id_idx ON bookings(device_id);

INSERT INTO schema_migrations(version) VALUES ('005_booking_device_identity') ON CONFLICT DO NOTHING;
