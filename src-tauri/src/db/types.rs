use serde::{Deserialize, Serialize};

/// Database type discriminator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DbType {
    #[serde(rename = "mysql")]
    MySql,
    #[serde(rename = "redis")]
    Redis,
    #[serde(rename = "postgresql")]
    PostgreSql,
}

/// Full connection configuration for a data source.
/// Passed from frontend to every Tauri command.
/// Frontend uses camelCase — serde maps automatically.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceConfig {
    pub id: String,
    pub name: String,
    pub db_type: DbType,
    pub host: String,
    pub port: u16,
    pub user: Option<String>,
    pub password: Option<String>,
    pub connect_timeout: u32,
    pub enable_ssl: bool,
    /// Optional default database for MySQL connections.
    /// When set, the connection URL includes this database
    /// so all queries default to it.
    pub database: Option<String>,
}

/// Column metadata returned for MySQL tables.
/// Frontend expects camelCase fields.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub col_type: String,
    pub nullable: bool,
    /// "PRI", "UNI", "MUL", or ""
    pub key: String,
    pub default: Option<String>,
}

/// Redis database index info.
/// Frontend expects camelCase fields.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisDbInfo {
    pub index: u32,
    pub key_count: u64,
}

/// Result of a SQL query execution.
/// `columns` describes the result set schema;
/// `rows` is a 2-D array of JSON values, each inner vec is one row
/// positional-matched to `columns`.
/// Frontend expects camelCase fields.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
}
