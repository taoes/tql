import { invoke } from "@tauri-apps/api/core";
import type { DataSourceConfig } from "./settings/types";
import { DICTS } from "./i18n";
import type { Locale } from "./i18n/types";

// ============================================================
// Database API — Tauri invoke wrappers
//
// Connects the React frontend to the Rust database commands.
// ============================================================

/** Application metadata returned by the Rust backend. */
export interface AppInfo {
  name: string;
  description: string;
  version: string;
  githubUrl: string;
  authorEmail: string;
}

/** Get application metadata (name, description, version, githubUrl).
 *  The version is read from Cargo.toml at build time — bump it
 *  there and rebuild to update the version everywhere. */
export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

/** Column metadata returned for MySQL tables */
export interface ColumnInfo {
  name: string;
  colType: string;
  nullable: boolean;
  /** "PRI", "UNI", "MUL", or "" */
  key: string;
  default: string | null;
}

/** Redis database index info */
export interface RedisDbInfo {
  index: number;
  keyCount: number;
}

/** Result of a SQL query execution.
 *  `columns` describes the result set schema;
 *  `rows` is a 2-D array, each inner array is one row
 *  positional-matched to `columns`;
 *  `executionTimeMs` is the server-side execution time in milliseconds (set by backend). */
export interface QueryResult {
  columns: ColumnInfo[];
  rows: (string | number | null | boolean)[][];
  rowCount: number;
  executionTimeMs?: number;
}

/** Test a database connection. Returns true on success. */
export async function testConnection(config: DataSourceConfig): Promise<boolean> {
  return invoke<boolean>("test_connection", { config });
}

/** Get the MySQL server version string (e.g. "8.0.35"). */
export async function getMysqlVersion(
  config: DataSourceConfig,
): Promise<string> {
  return invoke<string>("get_mysql_version", { config });
}

/** List all non‑system databases in a MySQL instance. */
export async function listMysqlDatabases(
  config: DataSourceConfig,
): Promise<string[]> {
  return invoke<string[]>("list_mysql_databases", { config });
}

/** List all tables in a MySQL database. */
export async function listMysqlTables(
  config: DataSourceConfig,
  database: string,
): Promise<string[]> {
  return invoke<string[]>("list_mysql_tables", { config, database });
}

/** List all columns in a MySQL table with metadata. */
export async function listMysqlColumns(
  config: DataSourceConfig,
  database: string,
  table: string,
): Promise<ColumnInfo[]> {
  return invoke<ColumnInfo[]>("list_mysql_columns", {
    config,
    database,
    table,
  });
}

/**
 * Read a previously generated table-level document from
 * ~/.config/tql/{datasource}/{database}/{table}.md.
 * Returns the file content, or throws if not found.
 */
export async function readDocument(
  datasourceName: string,
  database: string,
  tableName: string,
): Promise<string> {
  return invoke<string>("read_document", { datasourceName, database, tableName });
}

/**
 * Save a generated table-level document to
 * ~/.config/tql/{datasource}/{database}/{table}.md.
 * Returns the saved file path on success.
 */
export async function saveDocument(
  datasourceName: string,
  database: string,
  tableName: string,
  content: string,
): Promise<string> {
  return invoke<string>("save_document", {
    datasourceName,
    database,
    tableName,
    content,
  });
}

/**
 * Rename the docs folder when a data source is renamed.
 * Called automatically when the user edits a data source name.
 */
export async function renameDocumentFolder(
  oldName: string,
  newName: string,
): Promise<void> {
  return invoke("rename_document_folder", {
    oldName,
    newName,
  });
}

/**
 * Open the docs folder in the system file manager.
 * Opens the data-source-specific subfolder if `datasourceName` is provided,
 * or the database subfolder if both `datasourceName` and `database` are provided.
 */
export async function openDocsFolder(
  datasourceName?: string,
  database?: string,
): Promise<void> {
  return invoke("open_docs_folder", {
    datasourceName: datasourceName ?? null,
    database: database ?? null,
  });
}

/** Get the PostgreSQL server version string (e.g. "16.3"). */
export async function getPgsqlVersion(
  config: DataSourceConfig,
): Promise<string> {
  return invoke<string>("get_pgsql_version", { config });
}

/** List all non‑template databases in a PostgreSQL instance. */
export async function listPgsqlDatabases(
  config: DataSourceConfig,
): Promise<string[]> {
  return invoke<string[]>("list_pgsql_databases", { config });
}

/** List all non‑system schemas in a PostgreSQL database. */
export async function listPgsqlSchemas(
  config: DataSourceConfig,
  database: string,
): Promise<string[]> {
  return invoke<string[]>("list_pgsql_schemas", { config, database });
}

/** List all tables in a PostgreSQL database (schema-qualified for non‑public schemas). */
export async function listPgsqlTables(
  config: DataSourceConfig,
  database: string,
): Promise<string[]> {
  return invoke<string[]>("list_pgsql_tables", { config, database });
}

/** List all columns in a PostgreSQL table with metadata. */
export async function listPgsqlColumns(
  config: DataSourceConfig,
  database: string,
  table: string,
): Promise<ColumnInfo[]> {
  return invoke<ColumnInfo[]>("list_pgsql_columns", {
    config,
    database,
    table,
  });
}

/** List all Redis databases with key counts. */
export async function listRedisDatabases(
  config: DataSourceConfig,
): Promise<RedisDbInfo[]> {
  return invoke<RedisDbInfo[]>("list_redis_databases", { config });
}

/** Write file content to a given path on disk. Returns the saved path. */
export async function writeExportFile(
  path: string,
  content: string,
): Promise<string> {
  return invoke<string>("write_export_file", { path, content });
}

/** Execute a SQL query against a data source and return results.
 *  `config` — full connection config for the data source
 *  `database` — which database to USE within that data source
 *  `sql` — the SQL statement to execute
 *  `maxRows` — max rows to return (applied server-side via row cap)
 *  `timeoutSecs` — query timeout in seconds */
export async function executeQuery(
  config: DataSourceConfig,
  database: string,
  sql: string,
  maxRows: number,
  timeoutSecs: number,
): Promise<QueryResult> {
  return invoke<QueryResult>("execute_query", {
    config,
    database,
    sql,
    maxRows,
    timeoutSecs,
  });
}

// ============================================================
// Tray menu — sync labels with Rust backend
// ============================================================

/** Update the tray menu labels to match the given locale. */
export async function setTrayMenuLabels(
  openDocs: string,
  showHide: string,
  about: string,
  quit: string,
): Promise<void> {
  return invoke("set_tray_menu_labels", { openDocs, showHide, about, quit });
}

/** Look up tray menu labels for a locale and push them to the Rust backend. */
export async function syncTrayMenu(locale: Locale): Promise<void> {
  const dict = DICTS[locale] ?? DICTS["en-US"];
  await setTrayMenuLabels(
    dict.tray.openDocs,
    dict.tray.showHide,
    dict.tray.about,
    dict.tray.quit,
  );
}
