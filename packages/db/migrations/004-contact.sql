CREATE TABLE contact_submissions (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(320) NOT NULL,
  business_name   VARCHAR(200),
  subject         VARCHAR(100) NOT NULL,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_created ON contact_submissions(created_at DESC);
