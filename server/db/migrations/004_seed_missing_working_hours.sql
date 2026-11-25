INSERT INTO working_hours(day_of_week, opening_time, closing_time, is_open)
SELECT day, '09:00', '18:00', false
FROM generate_series(0, 6) AS day
ON CONFLICT (day_of_week) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('004_seed_missing_working_hours') ON CONFLICT DO NOTHING;
