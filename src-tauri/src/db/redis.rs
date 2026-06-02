use redis::aio::MultiplexedConnection;

use super::types::{DataSourceConfig, RedisDbInfo};

/// Open a Redis connection.
async fn connect(config: &DataSourceConfig) -> Result<MultiplexedConnection, String> {
    let addr = format!("{}:{}", config.host, config.port);
    let url = match config.password.as_deref() {
        Some(pw) => format!("redis://:{}@{}", pw, addr),
        None => format!("redis://{}", addr),
    };

    let client =
        redis::Client::open(url.as_str()).map_err(|e| format!("Redis client error: {e}"))?;

    client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| format!("Redis connection failed: {e}"))
}

/// Parse `INFO KEYSPACE` output into db index → key_count map.
fn parse_keyspace(info: &str) -> Vec<RedisDbInfo> {
    let mut dbs: Vec<RedisDbInfo> = Vec::new();

    for line in info.lines() {
        let line = line.trim();
        // Lines look like: db0:keys=123,expires=45,avg_ttl=...
        if let Some(rest) = line.strip_prefix("db") {
            let (idx_str, fields) = match rest.split_once(':') {
                Some(pair) => pair,
                None => continue,
            };
            let index: u32 = match idx_str.parse() {
                Ok(i) => i,
                Err(_) => continue,
            };

            let mut key_count: u64 = 0;
            for part in fields.split(',') {
                if let Some(val) = part.strip_prefix("keys=") {
                    key_count = val.parse().unwrap_or(0);
                }
            }

            dbs.push(RedisDbInfo { index, key_count });
        }
    }

    dbs.sort_by_key(|d| d.index);
    dbs
}

/// Get total number of databases from CONFIG GET.
async fn get_db_count(conn: &mut MultiplexedConnection) -> u32 {
    let result: Result<Vec<String>, _> = redis::cmd("CONFIG")
        .arg("GET")
        .arg("databases")
        .query_async(conn)
        .await;

    match result {
        Ok(vals) if vals.len() >= 2 => vals[1].parse().unwrap_or(16),
        _ => 16, // fallback default
    }
}

/// List all Redis databases with key counts.
pub async fn list_databases(config: &DataSourceConfig) -> Result<Vec<RedisDbInfo>, String> {
    let mut conn = connect(config).await?;

    // Get keyspace info
    let info: String = redis::cmd("INFO")
        .arg("KEYSPACE")
        .query_async(&mut conn)
        .await
        .map_err(|e| format!("Redis INFO KEYSPACE failed: {e}"))?;

    let mut dbs = parse_keyspace(&info);

    // Get total DB count and fill empty slots
    let db_count = get_db_count(&mut conn).await;
    for i in 0..db_count {
        if !dbs.iter().any(|d| d.index == i) {
            dbs.push(RedisDbInfo {
                index: i,
                key_count: 0,
            });
        }
    }
    dbs.sort_by_key(|d| d.index);

    // Graceful disconnect — ignore result
    let _ = redis::cmd("QUIT").query_async::<String>(&mut conn).await;

    Ok(dbs)
}

/// Quick connection test.
pub async fn test_connection(config: &DataSourceConfig) -> Result<bool, String> {
    let mut conn = connect(config).await?;
    redis::cmd("PING")
        .query_async::<String>(&mut conn)
        .await
        .map_err(|e| format!("Redis PING failed: {e}"))?;
    Ok(true)
}
