use std::path::PathBuf;
use std::time::Duration;

mod db;

// ── Theme detection ────────────────────────────────────────────────

/// Detect the OS-level color scheme.
/// Returns "dark" or "light".
#[tauri::command]
fn get_system_theme() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("defaults")
            .args(["read", "-g", "AppleInterfaceStyle"])
            .output()
            .map_err(|e| format!("无法读取系统主题: {e}"))?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.trim() == "Dark" {
                return Ok("dark".to_string());
            }
        }
        Ok("light".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        // Try GNOME gsettings first
        let output = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "color-scheme"])
            .output();
        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if stdout.contains("dark") || stdout.contains("prefer-dark") {
                    return Ok("dark".to_string());
                }
            }
        }
        // Fallback: check GTK_THEME env var
        if let Ok(gtk_theme) = std::env::var("GTK_THEME") {
            if gtk_theme.to_lowercase().contains("dark") {
                return Ok("dark".to_string());
            }
        }
        Ok("light".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        // Check Windows registry for app theme
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                "/v",
                "AppsUseLightTheme",
            ])
            .output()
            .map_err(|e| format!("无法读取系统主题: {e}"))?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 0x0 = dark, 0x1 = light
            if stdout.contains("0x0") {
                return Ok("dark".to_string());
            }
        }
        Ok("light".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    Ok("light".to_string())
}

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

/// Read a previously saved documentation file.
/// Read a previously generated table-level document.
/// Path: ~/.config/tql/{datasource}/{database}/{table}.md
#[tauri::command]
fn read_document(
    datasource_name: String,
    database: String,
    table_name: String,
) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let path = PathBuf::from(home)
        .join(".config")
        .join("tql")
        .join(&datasource_name)
        .join(&database)
        .join(format!("{}.md", table_name));
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文档失败 {}: {e}", path.display()))
}

/// Save a generated table-level document.
/// Path: ~/.config/tql/{datasource}/{database}/{table}.md
#[tauri::command]
fn save_document(
    datasource_name: String,
    database: String,
    table_name: String,
    content: String,
) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let dir = PathBuf::from(home)
        .join(".config")
        .join("tql")
        .join(&datasource_name)
        .join(&database);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建文档目录失败: {e}"))?;
    let path = dir.join(format!("{}.md", table_name));
    std::fs::write(&path, &content)
        .map_err(|e| format!("写入文档失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// Rename the datasource folder under ~/.config/tql when a data source is renamed.
/// If the old folder doesn't exist, this is a no-op (returns Ok).
#[tauri::command]
fn rename_document_folder(
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let base = PathBuf::from(home).join(".config").join("tql");
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
/// If both `datasource_name` and `database` are provided, opens the database subfolder.
#[tauri::command]
fn open_docs_folder(
    datasource_name: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| format!("无法读取 HOME: {e}"))?;
    let mut path = PathBuf::from(home).join(".config").join("tql");
    if let Some(name) = &datasource_name {
        path = path.join(name);
        if let Some(db) = &database {
            path = path.join(db);
        }
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
async fn get_mysql_version(
    config: db::types::DataSourceConfig,
) -> Result<String, String> {
    let timeout = Duration::from_secs(config.connect_timeout.max(1) as u64);
    tokio::time::timeout(timeout, db::mysql::get_version(&config))
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

#[tauri::command]
async fn execute_query(
    config: db::types::DataSourceConfig,
    database: String,
    sql: String,
    max_rows: u32,
    timeout_secs: u32,
) -> Result<db::types::QueryResult, String> {
    let timeout = Duration::from_secs(timeout_secs.max(1) as u64);
    tokio::time::timeout(
        timeout,
        db::mysql::execute_query(&config, &database, &sql, max_rows),
    )
    .await
    .map_err(|_| format!("Query timed out after {}s", timeout_secs))?
}

/// Write export content to a user-chosen file path.
/// Returns the absolute path of the saved file so the frontend can show it.
#[tauri::command]
fn write_export_file(path: String, content: String) -> Result<String, String> {
    std::fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file: {e}"))?;
    Ok(path)
}

// ── Application entry ───────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ))
        .setup(|app| {
            use tauri::Manager;
            use tauri::PhysicalPosition;
            use tauri::PhysicalSize;

            // ── Window: fill the screen ──────────────────────────
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let size = monitor.size();
                    let _ = window.set_position(PhysicalPosition::new(0, 0));
                    let _ = window.set_size(PhysicalSize::new(size.width, size.height));
                }
            }

            // ── Menu: simplified macOS menu bar ──────────────────
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, SubmenuBuilder};

                let handle = app.handle();

                // App menu (first submenu = app name)
                let app_menu = SubmenuBuilder::new(handle, "TQL")
                    .about(None)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                // Edit submenu
                let edit_menu = SubmenuBuilder::new(handle, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .separator()
                    .select_all()
                    .build()?;

                // Window submenu
                let window_menu = SubmenuBuilder::new(handle, "Window")
                    .minimize()
                    .close_window()
                    .separator()
                    .bring_all_to_front()
                    .build()?;

                let menu = MenuBuilder::new(handle)
                    .item(&app_menu)
                    .item(&edit_menu)
                    .item(&window_menu)
                    .build()?;

                app.set_menu(menu)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_theme,
            load_settings,
            save_settings,
            read_document,
            save_document,
            rename_document_folder,
            open_docs_folder,
            test_connection,
            get_mysql_version,
            list_mysql_databases,
            list_mysql_tables,
            list_mysql_columns,
            list_redis_databases,
            execute_query,
            write_export_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
