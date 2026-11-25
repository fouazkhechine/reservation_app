ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'));
INSERT INTO schema_migrations(version) VALUES ('003_fix_overlap_constraint') ON CONFLICT DO NOTHING;
