use serde::Serialize;

/// Application metadata — single source of truth for the frontend.
///
/// `name`, `version`, `description`, and `github_url` come from
/// Cargo.toml (`env!("CARGO_PKG_…")`).  Update the version there
/// when releasing — it is embedded at compile time and surfaced
/// everywhere automatically.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub description: String,
    pub version: String,
    pub github_url: String,
    pub author_email: String,
}

/// Return application metadata (name, description, version, GitHub URL, author email).
///
/// The version and repository URL are read from Cargo.toml at build time,
/// so updating `version = "X.Y.Z"` there and rebuilding is all that's
/// needed to bump the version everywhere.
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "TQL".to_string(),
        description: env!("CARGO_PKG_DESCRIPTION").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        github_url: env!("CARGO_PKG_REPOSITORY").to_string(),
        author_email: "zhoutao3210@gmail.com".to_string(),
    }
}
