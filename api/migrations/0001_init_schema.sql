CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  full_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  gpa TEXT NOT NULL,
  email TEXT NOT NULL,
  github_url TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  cv_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS profile_translations (
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  role TEXT NOT NULL,
  location TEXT NOT NULL,
  university TEXT NOT NULL,
  major TEXT NOT NULL,
  focus TEXT NOT NULL,
  summary TEXT NOT NULL,
  about TEXT NOT NULL,
  career_objective TEXT NOT NULL,
  PRIMARY KEY (profile_id, locale)
);

CREATE TABLE IF NOT EXISTS skill_groups (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS skill_group_translations (
  skill_group_id TEXT NOT NULL REFERENCES skill_groups(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (skill_group_id, locale)
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  skill_group_id TEXT NOT NULL REFERENCES skill_groups(id) ON DELETE CASCADE,
  icon TEXT,
  level TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS skill_translations (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  name TEXT NOT NULL,
  PRIMARY KEY (skill_id, locale)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS project_translations (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  role TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (project_id, locale)
);

CREATE TABLE IF NOT EXISTS project_status_labels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tone TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  UNIQUE (project_id, display_order)
);

CREATE TABLE IF NOT EXISTS project_status_label_translations (
  status_label_id TEXT NOT NULL REFERENCES project_status_labels(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  label TEXT NOT NULL,
  PRIMARY KEY (status_label_id, locale)
);

CREATE TABLE IF NOT EXISTS project_tech_stack (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technology TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, technology),
  UNIQUE (project_id, display_order)
);

CREATE TABLE IF NOT EXISTS project_highlights (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  UNIQUE (project_id, display_order)
);

CREATE TABLE IF NOT EXISTS project_highlight_translations (
  highlight_id TEXT NOT NULL REFERENCES project_highlights(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  text TEXT NOT NULL,
  PRIMARY KEY (highlight_id, locale)
);

CREATE TABLE IF NOT EXISTS project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  href TEXT NOT NULL,
  icon TEXT NOT NULL,
  link_type TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  UNIQUE (project_id, display_order)
);

CREATE TABLE IF NOT EXISTS project_link_translations (
  project_link_id TEXT NOT NULL REFERENCES project_links(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  label TEXT NOT NULL,
  PRIMARY KEY (project_link_id, locale)
);

CREATE TABLE IF NOT EXISTS project_content_blocks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'MARKDOWN', 'FEATURE_GRID', 'ARCHITECTURE_FLOW', 'MODULE_LIST',
    'CI_CD_FLOW', 'IMAGE_GALLERY', 'METRIC_CARDS', 'LINK_GROUP'
  )),
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (project_id, display_order)
);

CREATE TABLE IF NOT EXISTS project_content_block_translations (
  content_block_id TEXT NOT NULL REFERENCES project_content_blocks(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  title TEXT NOT NULL,
  markdown TEXT,
  description TEXT,
  PRIMARY KEY (content_block_id, locale)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  issuer TEXT,
  achieved_at TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS achievement_translations (
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (achievement_id, locale)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('learning', 'preparation', 'practice')),
  official INTEGER NOT NULL DEFAULT 0 CHECK (official IN (0, 1)),
  credential_url TEXT,
  issued_at TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS certificate_translations (
  certificate_id TEXT NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (certificate_id, locale)
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published_at TEXT NOT NULL,
  reading_time_minutes INTEGER NOT NULL CHECK (reading_time_minutes > 0),
  cover_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS blog_post_translations (
  blog_post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  canonical_path TEXT,
  og_image_url TEXT,
  PRIMARY KEY (blog_post_id, locale)
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  blog_post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (blog_post_id, tag),
  UNIQUE (blog_post_id, display_order)
);

CREATE TABLE IF NOT EXISTS contact_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('email', 'github', 'linkedin', 'cv')),
  icon TEXT NOT NULL,
  href TEXT NOT NULL,
  value TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (type, display_order)
);

CREATE TABLE IF NOT EXISTS contact_link_translations (
  contact_link_id TEXT NOT NULL REFERENCES contact_links(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  label TEXT NOT NULL,
  PRIMARY KEY (contact_link_id, locale)
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  default_locale TEXT NOT NULL CHECK (default_locale IN ('en', 'vi')),
  supported_locales_json TEXT NOT NULL CHECK (json_valid(supported_locales_json) AND json_type(supported_locales_json) = 'array'),
  default_og_image_url TEXT,
  github_url TEXT,
  linked_in_url TEXT,
  email TEXT,
  cv_url TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS site_settings_translations (
  site_settings_id TEXT NOT NULL REFERENCES site_settings(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  site_name TEXT NOT NULL,
  author_name TEXT NOT NULL,
  default_title TEXT,
  default_description TEXT,
  title_template TEXT,
  PRIMARY KEY (site_settings_id, locale)
);

CREATE TABLE IF NOT EXISTS seed_runs (
  id TEXT PRIMARY KEY,
  seed_name TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  imported_rows_json TEXT NOT NULL CHECK (json_valid(imported_rows_json) AND json_type(imported_rows_json) = 'object'),
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_skill_groups_status_order ON skill_groups(status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_skills_group_status_order ON skills(skill_group_id, status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_projects_status_order ON projects(status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_project_status_labels_order ON project_status_labels(project_id, status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_project_highlights_order ON project_highlights(project_id, status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_project_links_order ON project_links(project_id, status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_project_content_blocks_order ON project_content_blocks(project_id, status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_achievements_status_order ON achievements(status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_certificates_status_order ON certificates(status, display_order, id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_order ON blog_posts(status, display_order, published_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_contact_links_status_order ON contact_links(status, display_order, id);
