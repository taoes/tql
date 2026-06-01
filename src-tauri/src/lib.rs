use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, load_settings, save_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
