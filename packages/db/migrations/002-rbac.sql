DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inertia_app') THEN
    CREATE ROLE inertia_app WITH LOGIN PASSWORD 'changeme';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO inertia_app;

-- Both tables: INSERT + SELECT only. No UPDATE, DELETE, TRUNCATE.
GRANT SELECT, INSERT ON TABLE sessions TO inertia_app;
GRANT SELECT, INSERT ON TABLE events TO inertia_app;
GRANT USAGE, SELECT ON SEQUENCE events_event_id_seq TO inertia_app;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE events FROM inertia_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE sessions FROM inertia_app;

GRANT SELECT ON TABLE _migrations TO inertia_app;
