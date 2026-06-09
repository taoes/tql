use tokio_postgres::{Client, NoTls};

use super::types::{ColumnInfo, DataSourceConfig, QueryResult};

// ── Connection ────────────────────────────────────────────────────

/// Build a PostgreSQL connection string from config.
/// Format: host=... port=... user=... [password=...] dbname=...
fn build_connection_string(config: &DataSourceConfig, database: Option<&str>) -> String {
    let user = config.user.as_deref().unwrap_or("postgres");
    let pw = config.password.as_deref().unwrap_or("");
    let ssl_mode = if config.enable_ssl {
        "require"
    } else {
        "prefer"
    };
    let db = database.unwrap_or("postgres");

    let mut conn_str = format!(
        "host={} port={} user={} dbname={} sslmode={} connect_timeout={}",
        config.host,
        config.port,
        user,
        db,
        ssl_mode,
        config.connect_timeout.max(1)
    );

    // Only include password if one is set — empty password causes
    // authentication failures with trust/peer auth PostgreSQL servers.
    if !pw.is_empty() {
        conn_str.push_str(&format!(" password={}", pw));
    }

    conn_str
}

/// Open a new PostgreSQL connection and return the client.
/// The background connection task is spawned onto the Tokio runtime.
async fn connect(config: &DataSourceConfig, database: Option<&str>) -> Result<Client, String> {
    let conn_str = build_connection_string(config, database);
    let (client, connection) = tokio_postgres::connect(&conn_str, NoTls)
        .await
        .map_err(|e| format!("PostgreSQL connection failed: {e}"))?;

    // Spawn the connection handler — it manages the transport in the background
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL connection error: {e}");
        }
    });

    Ok(client)
}

// ── Connection test ───────────────────────────────────────────────

/// Quick connection test — returns true on success.
pub async fn test_connection(config: &DataSourceConfig) -> Result<bool, String> {
    let client = connect(config, None).await?;
    // A simple query verifies the connection is alive
    client
        .query_one("SELECT 1", &[])
        .await
        .map_err(|e| format!("PostgreSQL ping failed: {e}"))?;
    Ok(true)
}

// ── Version ───────────────────────────────────────────────────────

/// Get the PostgreSQL server version string (e.g. "16.3").
pub async fn get_version(config: &DataSourceConfig) -> Result<String, String> {
    let client = connect(config, None).await?;
    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(|e| format!("Failed to get PostgreSQL version: {e}"))?;
    let full: String = row.get(0);
    // Parse "PostgreSQL 16.3 ..." → "16.3"
    let version = full
        .split_whitespace()
        .nth(1)
        .unwrap_or(&full)
        .to_string();
    Ok(version)
}

// ── List databases ────────────────────────────────────────────────

/// List all non-template, user-accessible databases.
pub async fn list_databases(config: &DataSourceConfig) -> Result<Vec<String>, String> {
    let client = connect(config, None).await?;
    let rows = client
        .query(
            "SELECT datname FROM pg_database \
             WHERE datistemplate = false \
             AND datname NOT IN ('postgres') \
             ORDER BY datname",
            &[],
        )
        .await
        .map_err(|e| format!("Failed to list databases: {e}"))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

// ── List schemas ──────────────────────────────────────────────────

/// List all non-system schemas in a given database.
pub async fn list_schemas(
    config: &DataSourceConfig,
    database: &str,
) -> Result<Vec<String>, String> {
    let client = connect(config, Some(database)).await?;
    let rows = client
        .query(
            "SELECT schema_name FROM information_schema.schemata \
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') \
             ORDER BY schema_name",
            &[],
        )
        .await
        .map_err(|e| format!("Failed to list schemas: {e}"))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

// ── List tables ───────────────────────────────────────────────────

/// List all tables in a given database, grouped by schema.
/// Returns strings in "schema.table" format.
pub async fn list_tables(
    config: &DataSourceConfig,
    database: &str,
) -> Result<Vec<String>, String> {
    let client = connect(config, Some(database)).await?;
    let rows = client
        .query(
            "SELECT table_schema, table_name \
             FROM information_schema.tables \
             WHERE table_type = 'BASE TABLE' \
             AND table_schema NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY table_schema, table_name",
            &[],
        )
        .await
        .map_err(|e| format!("Failed to list tables: {e}"))?;

    Ok(rows
        .iter()
        .map(|r| {
            let schema: String = r.get(0);
            let table: String = r.get(1);
            if schema == "public" {
                table
            } else {
                format!("{}.{}", schema, table)
            }
        })
        .collect())
}

// ── List columns ──────────────────────────────────────────────────

/// List columns with metadata for a given table.
/// `table` may be "public.mytable" or just "mytable".
pub async fn list_columns(
    config: &DataSourceConfig,
    database: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, String> {
    let client = connect(config, Some(database)).await?;

    // Split "schema.table" or use "public" as default schema
    let (schema, table_name) = if let Some((s, t)) = table.split_once('.') {
        (s, t)
    } else {
        ("public", table)
    };

    let rows = client
        .query(
            "SELECT c.column_name, c.data_type, c.is_nullable, \
                    tc.constraint_type, c.column_default \
             FROM information_schema.columns c \
             LEFT JOIN information_schema.key_column_usage kcu \
               ON c.table_schema = kcu.table_schema \
              AND c.table_name = kcu.table_name \
              AND c.column_name = kcu.column_name \
             LEFT JOIN information_schema.table_constraints tc \
               ON kcu.constraint_name = tc.constraint_name \
              AND tc.constraint_type = 'PRIMARY KEY' \
             WHERE c.table_schema = $1 AND c.table_name = $2 \
             ORDER BY c.ordinal_position",
            &[&schema, &table_name],
        )
        .await
        .map_err(|e| format!("Failed to list columns: {e}"))?;

    Ok(rows
        .iter()
        .map(|r| {
            let col_name: String = r.get(0);
            let data_type: String = r.get(1);
            let is_nullable: String = r.get(2);
            let constraint_type: Option<String> = r.get(3);
            let column_default: Option<String> = r.get(4);

            ColumnInfo {
                name: col_name,
                col_type: data_type,
                nullable: is_nullable == "YES",
                key: if constraint_type.is_some() {
                    "PRI".to_string()
                } else {
                    String::new()
                },
                default: column_default,
            }
        })
        .collect())
}

// ── Execute query ─────────────────────────────────────────────────

/// Execute a SQL query against a PostgreSQL database and return results.
///
/// Uses the **simple query protocol** (PQexec) so that arbitrary user SQL
/// is sent to the server as-is — without parameter-placeholder parsing.
/// This avoids the "Query preparation failed" errors that occur with the
/// extended query protocol when SQL contains `$N` tokens (dollar-quoting,
/// JSON path expressions, function bodies, etc.).
///
/// DML statements (INSERT / UPDATE / DELETE) are auto-committed — the
/// simple query protocol runs each statement outside an explicit
/// transaction block, so changes take effect immediately.
///
/// * `config` — connection parameters (host, port, user, password, etc.)
/// * `database` — which database to connect to
/// * `sql` — the SQL statement(s) to execute (multi-statement OK)
/// * `max_rows` — cap on the number of rows returned
pub async fn execute_query(
    config: &DataSourceConfig,
    database: &str,
    sql: &str,
    max_rows: u32,
) -> Result<QueryResult, String> {
    let client = connect(config, Some(database)).await?;

    // simple_query sends raw SQL — no parameter binding, no PREPARE step.
    let messages = client
        .simple_query(sql)
        .await
        .map_err(|e| format!("Query execution failed: {e}"))?;

    let mut columns: Vec<ColumnInfo> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut total_affected: u64 = 0;

    for msg in messages {
        match msg {
            tokio_postgres::SimpleQueryMessage::Row(row) => {
                // Build column metadata from the first Row we see.
                if columns.is_empty() {
                    columns = row
                        .columns()
                        .iter()
                        .map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            col_type: String::new(), // simple protocol doesn't expose types
                            nullable: true,
                            key: String::new(),
                            default: None,
                        })
                        .collect();
                }

                if rows.len() < max_rows as usize {
                    let values: Vec<serde_json::Value> = (0..row.columns().len())
                        .map(|i| match row.get(i) {
                            Some(v) => serde_json::Value::String(v.to_string()),
                            None => serde_json::Value::Null,
                        })
                        .collect();
                    rows.push(values);
                }
            }
            tokio_postgres::SimpleQueryMessage::CommandComplete(affected) => {
                total_affected += affected;
            }
            _ => {} // RowDescription and other variants — ignored
        }
    }

    let row_count = if columns.is_empty() {
        total_affected as usize
    } else {
        rows.len()
    };

    Ok(QueryResult {
        columns,
        rows,
        row_count,
    })
}
