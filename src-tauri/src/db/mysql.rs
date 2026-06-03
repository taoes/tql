use mysql_async::prelude::*;
use mysql_async::Conn;

use super::types::{ColumnInfo, DataSourceConfig, QueryResult};

/// Build MySQL connection URL from config.
/// If `config.database` is set, the URL targets that database.
fn build_url(config: &DataSourceConfig) -> String {
    let user = config.user.as_deref().unwrap_or("root");
    let pw = config.password.as_deref().unwrap_or("");
    let db = config.database.as_deref().unwrap_or("");
    let ssl = if config.enable_ssl {
        "?require_ssl=true"
    } else {
        ""
    };
    format!(
        "mysql://{}:{}@{}:{}/{}{}",
        user, pw, config.host, config.port, db, ssl
    )
}

/// Open a new MySQL connection.
async fn connect(config: &DataSourceConfig) -> Result<Conn, String> {
    let url = build_url(config);
    Conn::from_url(&url)
        .await
        .map_err(|e| format!("MySQL connection failed: {e}"))
}

/// List all non-system databases.
pub async fn list_databases(config: &DataSourceConfig) -> Result<Vec<String>, String> {
    let mut conn = connect(config).await?;
    let dbs: Vec<String> = conn
        .query("SHOW DATABASES")
        .await
        .map_err(|e| format!("Failed to list databases: {e}"))?;
    conn.disconnect().await.ok();

    let system = ["information_schema", "mysql", "performance_schema", "sys"];
    Ok(dbs
        .into_iter()
        .filter(|d| !system.contains(&d.as_str()))
        .collect())
}

/// List all tables in a given database.
pub async fn list_tables(config: &DataSourceConfig, database: &str) -> Result<Vec<String>, String> {
    let mut conn = connect(config).await?;
    let tables: Vec<String> = conn
        .exec(
            "SELECT TABLE_NAME FROM information_schema.TABLES \
             WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
            (database,),
        )
        .await
        .map_err(|e| format!("Failed to list tables: {e}"))?;
    conn.disconnect().await.ok();
    Ok(tables)
}

/// List columns with metadata for a given table.
pub async fn list_columns(
    config: &DataSourceConfig,
    database: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, String> {
    let mut conn = connect(config).await?;
    let rows: Vec<(String, String, String, String, String)> = conn
        .exec(
            "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, \
             IFNULL(COLUMN_DEFAULT, '') \
             FROM information_schema.COLUMNS \
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
             ORDER BY ORDINAL_POSITION",
            (database, table),
        )
        .await
        .map_err(|e| format!("Failed to list columns: {e}"))?;
    conn.disconnect().await.ok();

    Ok(rows
        .into_iter()
        .map(|(name, col_type, nullable, key, default)| ColumnInfo {
            name,
            col_type,
            nullable: nullable == "YES",
            key,
            default: if default.is_empty() { None } else { Some(default) },
        })
        .collect())
}

/// Quick connection test — returns true on success.
pub async fn test_connection(config: &DataSourceConfig) -> Result<bool, String> {
    let mut conn = connect(config).await?;
    conn.ping()
        .await
        .map_err(|e| format!("MySQL ping failed: {e}"))?;
    conn.disconnect().await.ok();
    Ok(true)
}

/// Build a MySQL connection URL that includes a specific database.
fn build_url_with_db(config: &DataSourceConfig, database: &str) -> String {
    let user = config.user.as_deref().unwrap_or("root");
    let pw = config.password.as_deref().unwrap_or("");
    let db = database.replace('`', "``");
    if config.enable_ssl {
        format!(
            "mysql://{}:{}@{}:{}/{}?require_ssl=true",
            user, pw, config.host, config.port, db
        )
    } else {
        format!(
            "mysql://{}:{}@{}:{}/{}",
            user, pw, config.host, config.port, db
        )
    }
}

/// Open a new MySQL connection tied to a specific database.
async fn connect_with_db(
    config: &DataSourceConfig,
    database: &str,
) -> Result<Conn, String> {
    let url = build_url_with_db(config, database);
    Conn::from_url(&url)
        .await
        .map_err(|e| format!("MySQL connection failed: {e}"))
}

/// Convert a mysql_async Value to a serde_json Value.
fn value_to_json(v: &mysql_async::Value) -> serde_json::Value {
    use mysql_async::Value;
    match v {
        Value::NULL => serde_json::Value::Null,
        Value::Bytes(b) => {
            serde_json::Value::String(String::from_utf8_lossy(b).into_owned())
        }
        Value::Int(i) => serde_json::json!(i),
        Value::UInt(u) => serde_json::json!(u),
        Value::Float(f) => serde_json::json!(f),
        Value::Double(d) => serde_json::json!(d),
        Value::Date(y, mo, d, h, mi, s, _us) => serde_json::Value::String(format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
            y, mo, d, h, mi, s
        )),
        Value::Time(neg, days, h, mi, s, _us) => {
            let sign = if *neg { "-" } else { "" };
            serde_json::Value::String(format!(
                "{}{}:{:02}:{:02}:{:02}",
                sign, days, h, mi, s
            ))
        }
    }
}

/// Execute a SQL query against a MySQL database and return results.
///
/// * `config` — connection parameters (host, port, user, password, etc.)
/// * `database` — which database to USE (included in the connection URL)
/// * `sql` — the SQL statement to execute
/// * `max_rows` — cap on the number of rows returned
pub async fn execute_query(
    config: &DataSourceConfig,
    database: &str,
    sql: &str,
    max_rows: u32,
) -> Result<QueryResult, String> {
    let mut conn = connect_with_db(config, database).await?;

    // Execute the query — query_iter consumes the connection
    let mut result = conn
        .query_iter(sql)
        .await
        .map_err(|e| format!("Query execution failed: {e}"))?;

    // Extract column metadata
    let columns: Vec<ColumnInfo> = result
        .columns_ref()
        .iter()
        .map(|col| ColumnInfo {
            name: col.name_str().into_owned(),
            col_type: format!("{:?}", col.column_type()),
            nullable: false,
            key: String::new(),
            default: None,
        })
        .collect();

    // Iterate rows, respecting max_rows
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    while let Some(row) = result
        .next()
        .await
        .map_err(|e| format!("Failed to read row: {e}"))?
    {
        let values: Vec<serde_json::Value> = (0..row.len())
            .map(|i| {
                row.as_ref(i)
                    .map(value_to_json)
                    .unwrap_or(serde_json::Value::Null)
            })
            .collect();
        rows.push(values);

        if rows.len() >= max_rows as usize {
            break;
        }
    }

    let row_count = rows.len();

    // Drain remaining rows so the connection can close cleanly
    while result
        .next()
        .await
        .map_err(|e| format!("Failed to drain rows: {e}"))?
        .is_some()
    {}

    Ok(QueryResult {
        columns,
        rows,
        row_count,
    })
}
