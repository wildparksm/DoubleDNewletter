import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "daeduck.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    migrate(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      author_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_articles (
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      newsletter_id INTEGER REFERENCES newsletters(id) ON DELETE CASCADE,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (collection_id, newsletter_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT NOT NULL DEFAULT '',
      cover_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      author_id INTEGER NOT NULL,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department TEXT,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      newsletter_id INTEGER NOT NULL,
      subscriber_id INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      opened_at DATETIME,
      FOREIGN KEY (newsletter_id) REFERENCES newsletters(id),
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id),
      UNIQUE(newsletter_id, subscriber_id)
    );

    CREATE TABLE IF NOT EXISTS tracking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      newsletter_id INTEGER NOT NULL,
      short_code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      click_count INTEGER DEFAULT 0,
      FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
    );

    CREATE TABLE IF NOT EXISTS link_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_link_id INTEGER NOT NULL,
      subscriber_id INTEGER,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tracking_link_id) REFERENCES tracking_links(id)
    );

    CREATE TABLE IF NOT EXISTS subscriber_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total INTEGER NOT NULL DEFAULT 0,
      new_count INTEGER NOT NULL DEFAULT 0,
      unsub_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rss_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rss_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      summary TEXT,
      image_url TEXT,
      pub_date TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES rss_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS newsletter_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      newsletter_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (newsletter_id) REFERENCES newsletters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_nv_newsletter_time
      ON newsletter_views(newsletter_id, viewed_at);
  `);
}

function migrate(db: Database.Database) {
  const nlCols = (db.pragma("table_info(newsletters)") as { name: string }[]).map((c) => c.name);
  if (!nlCols.includes("cover_image")) db.exec("ALTER TABLE newsletters ADD COLUMN cover_image TEXT");
  if (!nlCols.includes("scheduled_at")) db.exec("ALTER TABLE newsletters ADD COLUMN scheduled_at DATETIME");
  if (!nlCols.includes("category")) db.exec("ALTER TABLE newsletters ADD COLUMN category TEXT DEFAULT '일반'");
  if (!nlCols.includes("card_title")) db.exec("ALTER TABLE newsletters ADD COLUMN card_title TEXT");

  if (!nlCols.includes("view_count")) db.exec("ALTER TABLE newsletters ADD COLUMN view_count INTEGER DEFAULT 0");
  if (!nlCols.includes("tags"))       db.exec("ALTER TABLE newsletters ADD COLUMN tags TEXT DEFAULT ''");

  const artCols = (db.pragma("table_info(rss_articles)") as { name: string }[]).map((c) => c.name);
  if (!artCols.includes("image_url")) db.exec("ALTER TABLE rss_articles ADD COLUMN image_url TEXT");

  const subCols = (db.pragma("table_info(subscribers)") as { name: string }[]).map((c) => c.name);
  if (!subCols.includes("tags")) db.exec("ALTER TABLE subscribers ADD COLUMN tags TEXT DEFAULT ''");
  if (!subCols.includes("confirm_token")) db.exec("ALTER TABLE subscribers ADD COLUMN confirm_token TEXT");
  if (!subCols.includes("confirmed_at")) db.exec("ALTER TABLE subscribers ADD COLUMN confirmed_at DATETIME");
  if (!subCols.includes("confirm_token_created_at")) db.exec("ALTER TABLE subscribers ADD COLUMN confirm_token_created_at DATETIME");
}

export default getDb;
