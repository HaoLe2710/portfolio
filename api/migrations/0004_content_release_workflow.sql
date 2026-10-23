DROP INDEX IF EXISTS idx_admin_content_drafts_state_updated;
DROP INDEX IF EXISTS idx_admin_content_drafts_slug_unique;

CREATE TABLE admin_content_drafts_v4 (
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'profile', 'skills', 'project', 'blogPost', 'achievement',
    'certificate', 'contactLink', 'siteSettings'
  )),
  entity_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object'),
  version INTEGER NOT NULL CHECK (version > 0),
  base_revision TEXT,
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'PUBLISHED', 'DISCARDED')),
  author_id TEXT NOT NULL REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  discarded_at TEXT,
  PRIMARY KEY (entity_type, entity_id)
);

INSERT INTO admin_content_drafts_v4
  (entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at, discarded_at)
SELECT entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at, discarded_at
FROM admin_content_drafts;

DROP TABLE admin_content_drafts;
ALTER TABLE admin_content_drafts_v4 RENAME TO admin_content_drafts;

CREATE INDEX idx_admin_content_drafts_state_updated
  ON admin_content_drafts(state, updated_at DESC);
CREATE UNIQUE INDEX idx_admin_content_drafts_slug_unique
  ON admin_content_drafts(entity_type, json_extract(snapshot_json, '$.slug'))
  WHERE state = 'DRAFT' AND entity_type IN ('project', 'blogPost');

CREATE TABLE content_releases (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
  release_number INTEGER NOT NULL CHECK (release_number > 0),
  status TEXT NOT NULL CHECK (status IN (
    'PREPARING', 'PENDING_DEPLOYMENT', 'BUILDING', 'VERIFYING', 'LIVE',
    'FAILED', 'VERIFICATION_FAILED', 'RECONCILIATION_REQUIRED', 'ROLLED_BACK', 'SUPERSEDED'
  )),
  operation TEXT NOT NULL CHECK (operation IN ('PUBLISH', 'UPDATE', 'UNPUBLISH', 'ROLLBACK')),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'profile', 'skills', 'project', 'blogPost', 'achievement',
    'certificate', 'contactLink', 'siteSettings'
  )),
  entity_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES admin_users(id),
  source_revision_id TEXT,
  source_draft_version INTEGER,
  previous_release_id TEXT REFERENCES content_releases(id),
  content_checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  activated_at TEXT,
  rolled_back_at TEXT,
  error_code TEXT,
  error_message TEXT,
  UNIQUE (environment, release_number)
);

CREATE INDEX idx_content_releases_environment_created
  ON content_releases(environment, created_at DESC, release_number DESC);
CREATE INDEX idx_content_releases_status
  ON content_releases(status, created_at);

CREATE TABLE content_release_items (
  release_id TEXT NOT NULL REFERENCES content_releases(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'profile', 'skills', 'project', 'blogPost', 'achievement',
    'certificate', 'contactLink', 'siteSettings'
  )),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('SNAPSHOT', 'PUBLISH', 'UPDATE', 'UNPUBLISH', 'ROLLBACK')),
  draft_revision_id TEXT,
  source_draft_version INTEGER,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object'),
  previous_published_json TEXT CHECK (previous_published_json IS NULL OR (json_valid(previous_published_json) AND json_type(previous_published_json) = 'object')),
  snapshot_hash TEXT NOT NULL,
  PRIMARY KEY (release_id, entity_type, entity_id)
);

CREATE TABLE release_environment_state (
  environment TEXT PRIMARY KEY CHECK (environment IN ('staging', 'production')),
  active_release_id TEXT,
  live_release_id TEXT REFERENCES content_releases(id),
  next_release_number INTEGER NOT NULL DEFAULT 1 CHECK (next_release_number > 0),
  updated_at TEXT NOT NULL
);

INSERT INTO release_environment_state (environment, next_release_number, updated_at)
VALUES ('staging', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       ('production', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE deployment_jobs (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL UNIQUE REFERENCES content_releases(id),
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
  provider TEXT NOT NULL CHECK (provider = 'cloudflare_pages_api'),
  pages_project TEXT NOT NULL,
  git_branch TEXT NOT NULL,
  commit_sha TEXT,
  deployment_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'QUEUED', 'TRIGGERING', 'UNKNOWN', 'INITIALIZING', 'CLONING', 'BUILDING', 'DEPLOYING',
    'VERIFYING', 'SUCCESS', 'FAILED', 'CANCELED', 'VERIFICATION_FAILED', 'RECONCILIATION_REQUIRED', 'ROLLED_BACK'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  idempotency_key TEXT NOT NULL,
  request_marker TEXT NOT NULL,
  preview_url TEXT,
  triggered_at TEXT,
  last_checked_at TEXT,
  completed_at TEXT,
  retry_after TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (environment, idempotency_key)
);

CREATE UNIQUE INDEX idx_deployment_jobs_one_active_environment
  ON deployment_jobs(environment)
  WHERE status IN ('QUEUED', 'TRIGGERING', 'UNKNOWN', 'INITIALIZING', 'CLONING', 'BUILDING', 'DEPLOYING', 'VERIFYING', 'RECONCILIATION_REQUIRED');
CREATE INDEX idx_deployment_jobs_status_updated
  ON deployment_jobs(status, updated_at);
CREATE INDEX idx_deployment_jobs_release
  ON deployment_jobs(release_id, created_at DESC);

CREATE TABLE deployment_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES deployment_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider_request_reference TEXT NOT NULL,
  provider_deployment_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'TRIGGERING', 'ACCEPTED', 'RECONCILED', 'FAILED', 'UNKNOWN'
  )),
  response_metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_metadata_json) AND json_type(response_metadata_json) = 'object'),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (job_id, attempt_number)
);

CREATE INDEX idx_deployment_attempts_job
  ON deployment_attempts(job_id, attempt_number DESC);
