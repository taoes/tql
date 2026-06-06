import { invoke } from "@tauri-apps/api/core";
import type { DataSourceConfig } from "./settings/types";

// ============================================================
// Database API — Tauri invoke wrappers
//
// Connects the React frontend to the Rust database commands.
// ============================================================

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
