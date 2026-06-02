use std::path::PathBuf;
use std::time::Duration;

mod db;

// ── Existing sync commands ──────────────────────────────────────

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn settings_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME 环境变量: {e}"))?;
    Ok(PathBuf::from(home).join(".config").join("tql").join("setting.json"))
}

#[tauri::command]
fn load_settings() -> Result<serde_json::Value, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(serde_json::Value::Object(serde_json::Map::new()));
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取配置失败 {}: {e}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(serde_json::Value::Object(serde_json::Map::new()));
    }
    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {e}"))
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败 {}: {e}", parent.display()))?;
    }
    let content =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("序列化配置失败: {e}"))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入配置失败 {}: {e}", path.display()))?;
    Ok(())
}

// ── Document generation ─────────────────────────────────────────

#[tauri::command]
fn save_document(
    datasource_name: String,
    database: String,
    content: String,
) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let dir = PathBuf::from(home)
        .join(".config")
        .join("tql")
        .join("docs")
        .join(&datasource_name);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建文档目录失败: {e}"))?;
    let path = dir.join(format!("{}.md", database));
    std::fs::write(&path, &content)
        .map_err(|e| format!("写入文档失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// Rename the docs folder when a data source is renamed.
/// If the old folder doesn't exist, this is a no-op (returns Ok).
#[tauri::command]
fn rename_document_folder(
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let base = PathBuf::from(home).join(".config").join("tql").join("docs");
    let old_path = base.join(&old_name);
    let new_path = base.join(&new_name);

    if old_path.exists() && !new_path.exists() {
        std::fs::rename(&old_path, &new_path)
            .map_err(|e| format!("重命名文档目录失败: {e}"))?;
    }
    Ok(())
}

/// Open the docs folder in the system file manager.
/// If `datasource_name` is provided, opens that data source's subfolder.
#[tauri::command]
fn open_docs_folder(datasource_name: Option<String>) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let mut path = PathBuf::from(home).join(".config").join("tql").join("docs");
    if let Some(name) = &datasource_name {
        path = path.join(name);
    }
    // Create the directory if it doesn't exist yet
    std::fs::create_dir_all(&path).ok();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {e}"))?;
    }
    Ok(())
}

// ── Async database commands ─────────────────────────────────────

#[tauri::command]
async fn test_connection(config: db::types::DataSourceConfig) -> Result<bool, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(timeout, async {
        match &config.db_type {
            db::types::DbType::MySql => db::mysql::test_connection(&config).await,
            db::types::DbType::Redis => db::redis::test_connection(&config).await,
        }
    })
    .await
    .map_err(|_| format!("Connection timed out after {}s", config.connect_timeout))?
}

#[tauri::command]
async fn list_mysql_databases(
    config: db::types::DataSourceConfig,
) -> Result<Vec<String>, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(timeout, db::mysql::list_databases(&config))
        .await
        .map_err(|_| format!("Connection timed out after {}s", config.connect_timeout))?
}

#[tauri::command]
async fn list_mysql_tables(
    config: db::types::DataSourceConfig,
    database: String,
) -> Result<Vec<String>, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(timeout, db::mysql::list_tables(&config, &database))
        .await
        .map_err(|_| format!("Connection timed out after {}s", config.connect_timeout))?
}

#[tauri::command]
async fn list_mysql_columns(
    config: db::types::DataSourceConfig,
    database: String,
    table: String,
) -> Result<Vec<db::types::ColumnInfo>, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(
        timeout,
        db::mysql::list_columns(&config, &database, &table),
    )
    .await
    .map_err(|_| format!("Connection timed out after {}s", config.connect_timeout))?
}

#[tauri::command]
async fn list_redis_databases(
    config: db::types::DataSourceConfig,
) -> Result<Vec<db::types::RedisDbInfo>, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(timeout, db::redis::list_databases(&config))
        .await
        .map_err(|_| format!("Connection timed out after {}s", config.connect_timeout))?
}

// ── Application entry ───────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_settings,
            save_settings,
            save_document,
            rename_document_folder,
            open_docs_folder,
            test_connection,
            list_mysql_databases,
            list_mysql_tables,
            list_mysql_columns,
            list_redis_databases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
