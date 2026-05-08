import { db } from "./client";

db.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON workspaces(user_id);

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('scene', 'character', 'style', 'audio')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    image_urls TEXT NOT NULL DEFAULT '[]',
    audio_url TEXT NOT NULL DEFAULT '',
    audio_mime_type TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS assets_workspace_id_idx ON assets(workspace_id);

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS images_workspace_id_idx ON images(workspace_id);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    logline TEXT NOT NULL DEFAULT '',
    timeline_state TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);

  CREATE TABLE IF NOT EXISTS project_assets (
    project_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, asset_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_scenes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    look TEXT NOT NULL DEFAULT '',
    first_frame_url TEXT NOT NULL DEFAULT '',
    last_frame_url TEXT NOT NULL DEFAULT '',
    first_frame_description TEXT NOT NULL DEFAULT '',
    last_frame_description TEXT NOT NULL DEFAULT '',
    asset_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS project_scenes_project_id_idx ON project_scenes(project_id);

  CREATE TABLE IF NOT EXISTS scene_assets (
    scene_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(scene_id, asset_id),
    FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    project_id TEXT,
    scene_id TEXT,
    kind TEXT NOT NULL DEFAULT 'video',
    asset_id TEXT,
    frame_type TEXT,
    description TEXT NOT NULL DEFAULT '',
    image_id TEXT,
    image_url TEXT,
    reference_image_urls TEXT NOT NULL DEFAULT '[]',
    generation_model TEXT,
    generation_options TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    video_url TEXT,
    error TEXT,
    openrouter_job_id TEXT,
    openrouter_polling_url TEXT,
    last_queried TEXT,
    last_query_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS render_jobs_workspace_id_idx ON render_jobs(workspace_id);
  CREATE INDEX IF NOT EXISTS render_jobs_scene_id_idx ON render_jobs(scene_id);
`);

function addColumnIfNotExists(table: string, column: string, type: string) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!info.find((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

function ensureAudioAssetsSupported() {
  const createSql = (
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'assets'").get() as { sql?: string } | undefined
  )?.sql ?? "";

  if (createSql.includes("'audio'")) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF");
  db.transaction(() => {
    db.exec(`
      CREATE TABLE assets_next (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('scene', 'character', 'style', 'audio')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL DEFAULT '',
        image_urls TEXT NOT NULL DEFAULT '[]',
        audio_url TEXT NOT NULL DEFAULT '',
        audio_mime_type TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      INSERT INTO assets_next
        (id, workspace_id, type, title, description, text, image_urls, audio_url, audio_mime_type, created_at, updated_at)
      SELECT
        id, workspace_id, type, title, description, text, image_urls, '', '', created_at, updated_at
      FROM assets;

      DROP TABLE assets;
      ALTER TABLE assets_next RENAME TO assets;
      CREATE INDEX IF NOT EXISTS assets_workspace_id_idx ON assets(workspace_id);
    `);
  })();
  db.exec("PRAGMA foreign_keys = ON");
}

ensureAudioAssetsSupported();
addColumnIfNotExists("project_scenes", "first_frame_description", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("project_scenes", "last_frame_description", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("projects", "timeline_state", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("assets", "audio_url", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("assets", "audio_mime_type", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("render_jobs", "last_queried", "TEXT");
addColumnIfNotExists("render_jobs", "last_query_status", "TEXT");
addColumnIfNotExists("render_jobs", "openrouter_polling_url", "TEXT");
addColumnIfNotExists("render_jobs", "kind", "TEXT NOT NULL DEFAULT 'video'");
addColumnIfNotExists("render_jobs", "asset_id", "TEXT");
addColumnIfNotExists("render_jobs", "frame_type", "TEXT");
addColumnIfNotExists("render_jobs", "description", "TEXT NOT NULL DEFAULT ''");
addColumnIfNotExists("render_jobs", "image_id", "TEXT");
addColumnIfNotExists("render_jobs", "image_url", "TEXT");
addColumnIfNotExists("render_jobs", "reference_image_urls", "TEXT NOT NULL DEFAULT '[]'");
addColumnIfNotExists("render_jobs", "generation_model", "TEXT");
addColumnIfNotExists("render_jobs", "generation_options", "TEXT NOT NULL DEFAULT '{}'");
