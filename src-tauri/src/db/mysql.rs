use mysql_async::prelude::*;
use mysql_async::Conn;

use super::types::{ColumnInfo, DataSourceConfig};

/// Build MySQL connection URL from config.
fn build_url(config: &DataSourceConfig) -> String {
    let user = config.user.as_deref().unwrap_or("root");
    let pw = config.password.as_deref().unwrap_or("");
    if config.enable_ssl {
        format!(
            "mysql://{}:{}@{}:{}/?ssl-mode=REQUIRED",
            user, pw, config.host, config.port
        )
    } else {
        format!(
            "mysql://{}:{}@{}:{}/",
            user, pw, config.host, config.port
        )
    }
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
