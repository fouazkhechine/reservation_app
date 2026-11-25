ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'));

UPDATE notifications SET status = 'SKIPPED', error_message = NULL
WHERE status = 'FAILED' AND error_message = 'Aucun appareil enregistré';

INSERT INTO schema_migrations(version) VALUES ('006_notification_skipped_status') ON CONFLICT DO NOTHING;
