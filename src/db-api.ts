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
  col_type: string;
  nullable: boolean;
  /** "PRI", "UNI", "MUL", or "" */
  key: string;
  default: string | null;
}

/** Redis database index info */
export interface RedisDbInfo {
  index: number;
  key_count: number;
}

/** Test a database connection. Returns true on success. */
export async function testConnection(config: DataSourceConfig): Promise<boolean> {
  return invoke<boolean>("test_connection", { config });
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
 * Save a generated document to ~/.config/tql/docs/<datasource>/<database>.md.
 * Returns the saved file path on success.
 */
export async function saveDocument(
  datasourceName: string,
  database: string,
  content: string,
): Promise<string> {
  return invoke<string>("save_document", {
    datasourceName,
    database,
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
 * Opens the data-source-specific subfolder if `datasourceName` is provided.
 */
export async function openDocsFolder(datasourceName?: string): Promise<void> {
  return invoke("open_docs_folder", {
    datasourceName: datasourceName ?? null,
  });
}

/** List all Redis databases with key counts. */
export async function listRedisDatabases(
  config: DataSourceConfig,
): Promise<RedisDbInfo[]> {
  return invoke<RedisDbInfo[]>("list_redis_databases", { config });
}
