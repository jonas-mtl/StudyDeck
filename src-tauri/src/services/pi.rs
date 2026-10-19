//! Multimodal Pi bridge: subscription OAuth only, no API-key fallback.
//! Node is executed locally; image pages are provided as native model image blocks.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualPage {
    pub page: i64,
    pub image_data: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVisuals {
    pub document_id: String,
    pub pages: Vec<VisualPage>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginState {
    pub phase: String,
    pub message: String,
    pub url: Option<String>,
}

fn resource_dir() -> Option<PathBuf> {
    std::env::var_os("STUDYDECK_RESOURCE_DIR").map(PathBuf::from)
}
fn bundled_bridge() -> PathBuf {
    if let Some(path) = std::env::var_os("STUDYDECK_PI_BRIDGE") {
        return PathBuf::from(path);
    }
    if let Some(dir) = resource_dir() {
        let candidate = dir.join("ai/bridge.mjs");
        if candidate.exists() {
            return candidate;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../ai/dist/bridge.mjs")
}
fn node_binary() -> PathBuf {
    if let Some(path) = std::env::var_os("STUDYDECK_NODE_PATH") {
        return PathBuf::from(path);
    }
    if let Some(dir) = resource_dir() {
        let file = if cfg!(windows) { "node.exe" } else { "node" };
        let path = dir.join("ai/runtime").join(file);
        if path.is_file() {
            return path;
        }
    }
    PathBuf::from(if cfg!(windows) { "node.exe" } else { "node" })
}
fn bridge_command() -> Result<Command, String> {
    let bridge = bundled_bridge();
    if !bridge.exists() {
        return Err("Pi-Bridge nicht gefunden. 'npm run build:bridge' ausführen.".into());
    }
    let mut command = Command::new(node_binary());
    command
        .arg(bridge)
        .env_remove("OPENAI_API_KEY")
        .env_remove("CODEX_API_KEY");
    Ok(command)
}
pub fn login_state(dir: &Path) -> LoginState {
    if let Ok(text) = std::fs::read_to_string(dir.join("pi-login-state.json")) {
        if let Ok(s) = serde_json::from_str::<LoginState>(&text) {
            return s;
        }
    }
    LoginState {
        phase: "disconnected".into(),
        message: "Mit ChatGPT anmelden, um die Folien visuell auszuwerten.".into(),
        url: None,
    }
}
pub fn connected(dir: &Path) -> bool {
    std::fs::read_to_string(dir.join("pi-oauth.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .is_some_and(|v| {
            v.get("openai-codex")
                .and_then(|c| c.get("type"))
                .and_then(Value::as_str)
                == Some("oauth")
        })
}
pub fn begin_login(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let s = login_state(dir);
    if ["opening", "browser", "waiting", "code"].contains(&s.phase.as_str()) {
        return Err("Eine Anmeldung läuft bereits".into());
    }
    // Previous OAuth tokens are kept until a successful new login.
    let _ = std::fs::remove_file(dir.join("pi-login-state.json"));
    let mut cmd = bridge_command()?;
    let log = std::fs::File::create(dir.join("pi-login-error.log")).map_err(|e| e.to_string())?;
    cmd.arg("login")
        .arg(dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::from(log));
    cmd.spawn()
        .map_err(|e| format!("KI-Anmeldung konnte nicht gestartet werden: {e}"))?;
    Ok(())
}
pub fn submit_code(dir: &Path, code: &str) -> Result<(), String> {
    if code.trim().is_empty() || code.len() > 1500 {
        return Err("Ungültiger Anmeldecode".into());
    }
    if login_state(dir).phase != "code" {
        return Err("Es wird gerade kein Code angefordert".into());
    }
    std::fs::write(dir.join("pi-auth-code.txt"), code.trim()).map_err(|e| e.to_string())
}
pub fn logout(dir: &Path) -> Result<(), String> {
    // Remove only StudyDeck's own credentials, never globally shared Pi/Codex logins.
    let _ = std::fs::remove_file(dir.join("pi-oauth.json"));
    let _ = std::fs::remove_file(dir.join("pi-login-state.json"));
    Ok(())
}

pub fn run(
    dir: &Path,
    prompt: &str,
    schema: &Value,
    visuals: &[VisualPage],
) -> Result<Value, String> {
    if !connected(dir) {
        return Err(
            "Bitte zuerst in StudyDeck mit ChatGPT anmelden. Ein API-Key ist nicht nötig.".into(),
        );
    }
    if visuals.len() > 30 {
        return Err(
            "Maximal dreißig Seiten pro KI-Auftrag. Große PDFs werden abschnittsweise verarbeitet."
                .into(),
        );
    }
    for visual in visuals {
        if visual.page < 1
            || visual.image_data.len() > 8_000_000
            || !(visual.image_data.starts_with("data:image/png;base64,")
                || visual.image_data.starts_with("data:image/jpeg;base64,"))
        {
            return Err(
                "Eine PDF-Seite hat ein ungültiges/zu großes Bild. Bitte niedriger auflösen."
                    .into(),
            );
        }
    }
    let job_dir = dir.join("pi_jobs").join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&job_dir).map_err(|e| e.to_string())?;
    let result = (|| {
        let input = job_dir.join("input.json");
        let output = job_dir.join("output.json");
        let errors = job_dir.join("errors.log");
        let body =
            serde_json::json!({"prompt":prompt,"schema":schema,"visuals":visuals,"outFile":output});
        std::fs::write(
            &input,
            serde_json::to_vec(&body).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let log = std::fs::File::create(&errors).map_err(|e| e.to_string())?;
        let mut child = bridge_command()?
            .arg("run")
            .arg(dir)
            .arg(&input)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::from(log))
            .spawn()
            .map_err(|e| format!("KI konnte nicht gestartet werden: {e}"))?;
        let start = Instant::now();
        let exit = loop {
            if let Some(s) = child.try_wait().map_err(|e| e.to_string())? {
                break s;
            }
            if start.elapsed() > Duration::from_secs(360) {
                let _ = child.kill();
                let _ = child.wait();
                return Err("KI-Zeitlimit überschritten (6 Minuten für einen Seitenblock)".into());
            }
            std::thread::sleep(Duration::from_millis(250));
        };
        if !exit.success() {
            let err = std::fs::read_to_string(&errors).unwrap_or_default();
            return Err(format!(
                "Pi-Anfrage fehlgeschlagen: {}",
                err.chars().take(1100).collect::<String>()
            ));
        }
        let raw = std::fs::read_to_string(&output).map_err(|e| format!("Keine KI-Antwort: {e}"))?;
        serde_json::from_str(&raw).map_err(|e| format!("Ungültiges Modell-JSON: {e}"))
    })();
    let _ = std::fs::remove_dir_all(job_dir);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_guard() {
        let page = VisualPage {
            page: 1,
            image_data: "bad".into(),
        };
        assert!(page.image_data.starts_with("data:image/jpeg;base64,") == false);
    }
}
