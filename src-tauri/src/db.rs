//! Local SQLite persistence. No cloud sync of module data; Anki sync remains Anki's responsibility.
use crate::models::{Card, CardPatch, Document, Module, PageText};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;

pub struct AppState {
    pub db: std::sync::Mutex<Connection>,
    pub data_dir: PathBuf,
}

pub fn open(data_dir: PathBuf) -> Result<AppState, String> {
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(data_dir.join("studydeck.sqlite")).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS modules (id TEXT PRIMARY KEY, semester TEXT NOT NULL, name TEXT NOT NULL, profile_json TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, module_id TEXT NOT NULL REFERENCES modules(id), name TEXT NOT NULL, kind TEXT NOT NULL, pages_json TEXT NOT NULL, local_path TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, module_id TEXT NOT NULL REFERENCES modules(id), document_id TEXT REFERENCES documents(id), from_page INTEGER, to_page INTEGER, hints TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, module_id TEXT NOT NULL REFERENCES modules(id), batch_id TEXT REFERENCES batches(id), front TEXT NOT NULL, back TEXT NOT NULL, explanation TEXT NOT NULL DEFAULT '', source_page INTEGER, image_page INTEGER, image_data TEXT, tags_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', anki_note_id INTEGER, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_cards_module ON cards(module_id, status);
        CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module_id,kind);
    ").map_err(|e| e.to_string())?;
    Ok(AppState {
        db: std::sync::Mutex::new(conn),
        data_dir,
    })
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
pub fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn list_modules(db: &Connection) -> Result<Vec<Module>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id,semester,name,profile_json,created_at FROM modules ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            let profile: Option<String> = r.get(3)?;
            Ok(Module {
                id: r.get(0)?,
                semester: r.get(1)?,
                name: r.get(2)?,
                profile: profile.and_then(|s| serde_json::from_str(&s).ok()),
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn module(db: &Connection, id: &str) -> Result<Module, String> {
    list_modules(db)?
        .into_iter()
        .find(|m| m.id == id)
        .ok_or_else(|| "Modul nicht gefunden".into())
}

pub fn create_module(db: &Connection, name: &str, semester: &str) -> Result<Module, String> {
    if name.trim().is_empty() || semester.trim().is_empty() {
        return Err("Modulname und Semester fehlen".into());
    }
    let m = Module {
        id: uid(),
        semester: semester.trim().to_string(),
        name: name.trim().to_string(),
        profile: None,
        created_at: now(),
    };
    db.execute(
        "INSERT INTO modules (id,semester,name,created_at) VALUES (?1,?2,?3,?4)",
        params![m.id, m.semester, m.name, m.created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(m)
}

pub fn set_profile(
    db: &Connection,
    module_id: &str,
    profile: &serde_json::Value,
) -> Result<(), String> {
    db.execute(
        "UPDATE modules SET profile_json=?1 WHERE id=?2",
        params![profile.to_string(), module_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn save_document(
    db: &Connection,
    module_id: &str,
    name: &str,
    kind: &str,
    pages: &[PageText],
    path: &str,
) -> Result<Document, String> {
    if !["lecture", "exam"].contains(&kind) {
        return Err("Ungültiger Dokumenttyp".into());
    }
    let d = Document {
        id: uid(),
        module_id: module_id.into(),
        name: name.into(),
        kind: kind.into(),
        page_count: pages.len() as i64,
        created_at: now(),
    };
    db.execute("INSERT INTO documents (id,module_id,name,kind,pages_json,local_path,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",params![d.id,d.module_id,d.name,d.kind,serde_json::to_string(pages).map_err(|e|e.to_string())?,path,d.created_at]).map_err(|e|e.to_string())?;
    Ok(d)
}

pub fn documents(db: &Connection, module_id: &str) -> Result<Vec<Document>, String> {
    let mut stmt=db.prepare("SELECT id,module_id,name,kind,created_at,pages_json FROM documents WHERE module_id=?1 ORDER BY created_at DESC").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([module_id], |r| {
            let s: String = r.get(5)?;
            let count = serde_json::from_str::<Vec<PageText>>(&s)
                .map(|p| p.len() as i64)
                .unwrap_or(0);
            Ok(Document {
                id: r.get(0)?,
                module_id: r.get(1)?,
                name: r.get(2)?,
                kind: r.get(3)?,
                page_count: count,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn document_data(db: &Connection, id: &str) -> Result<(String, String, Vec<PageText>), String> {
    let row: (String, String, String) = db
        .query_row(
            "SELECT module_id,local_path,pages_json FROM documents WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;
    let pages = serde_json::from_str(&row.2).map_err(|e| e.to_string())?;
    Ok((row.0, row.1, pages))
}

pub fn new_batch(
    db: &Connection,
    module_id: &str,
    document_id: Option<&str>,
    from_page: i64,
    to_page: i64,
    hints: &str,
) -> Result<String, String> {
    let id = uid();
    db.execute("INSERT INTO batches(id,module_id,document_id,from_page,to_page,hints,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",params![id,module_id,document_id,from_page,to_page,hints,now()]).map_err(|e|e.to_string())?;
    Ok(id)
}

pub fn insert_card(db: &Connection, card: &Card) -> Result<(), String> {
    db.execute("INSERT INTO cards(id,module_id,batch_id,front,back,explanation,source_page,image_page,image_data,tags_json,status,anki_note_id,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",params![card.id,card.module_id,card.batch_id,card.front,card.back,card.explanation,card.source_page,card.image_page,card.image_data,serde_json::to_string(&card.tags).map_err(|e|e.to_string())?,card.status,card.anki_note_id,card.created_at]).map_err(|e|e.to_string())?;
    Ok(())
}

fn row_card(r: &rusqlite::Row<'_>) -> rusqlite::Result<Card> {
    let tags: String = r.get(9)?;
    Ok(Card {
        id: r.get(0)?,
        module_id: r.get(1)?,
        batch_id: r.get(2)?,
        front: r.get(3)?,
        back: r.get(4)?,
        explanation: r.get(5)?,
        source_page: r.get(6)?,
        image_page: r.get(7)?,
        image_data: r.get(8)?,
        source_name: r.get(13)?,
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        status: r.get(10)?,
        anki_note_id: r.get(11)?,
        created_at: r.get(12)?,
    })
}
const CARD_QUERY:&str="SELECT c.id,c.module_id,c.batch_id,c.front,c.back,c.explanation,c.source_page,c.image_page,c.image_data,c.tags_json,c.status,c.anki_note_id,c.created_at,d.name FROM cards c LEFT JOIN batches b ON c.batch_id=b.id LEFT JOIN documents d ON b.document_id=d.id";

pub fn cards(db: &Connection, module_id: &str) -> Result<Vec<Card>, String> {
    let mut stmt = db
        .prepare(&format!(
            "{CARD_QUERY} WHERE c.module_id=?1 AND c.status!='deleted' ORDER BY c.created_at ASC"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([module_id], row_card)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn card(db: &Connection, id: &str) -> Result<Card, String> {
    db.query_row(&format!("{CARD_QUERY} WHERE c.id=?1"), [id], row_card)
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Karte nicht gefunden".into())
}

pub fn update_card(db: &Connection, p: &CardPatch) -> Result<(), String> {
    let card = card(db, &p.id)?;
    if card.status != "draft" {
        return Err("Importierte Karten werden nicht automatisch verändert".into());
    }
    if p.front.trim().is_empty() || p.back.trim().is_empty() {
        return Err("Vorder- und Rückseite dürfen nicht leer sein".into());
    }
    db.execute("UPDATE cards SET front=?1,back=?2,explanation=?3,source_page=?4,image_page=?5,tags_json=?6 WHERE id=?7",params![p.front,p.back,p.explanation,p.source_page,p.image_page,serde_json::to_string(&p.tags).map_err(|e|e.to_string())?,p.id]).map_err(|e|e.to_string())?;
    Ok(())
}

pub fn image(db: &Connection, id: &str, data: &str, page: i64) -> Result<(), String> {
    if card(db, id)?.status != "draft" {
        return Err("Nur Entwürfe können bearbeitet werden".into());
    }
    db.execute(
        "UPDATE cards SET image_data=?1,image_page=?2 WHERE id=?3",
        params![data, page, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn soft_delete(db: &Connection, id: &str) -> Result<(), String> {
    if card(db, id)?.status != "draft" {
        return Err("Importierte Anki-Karten bitte in Anki bearbeiten".into());
    }
    db.execute("UPDATE cards SET status='deleted' WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mark_imported(db: &Connection, id: &str, note_id: i64) -> Result<(), String> {
    db.execute(
        "UPDATE cards SET status='imported', anki_note_id=?1 WHERE id=?2 AND status='draft'",
        params![note_id, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete local module records transactionally; Anki is intentionally untouched.
/// Return PDF paths for cleanup after the successful database transaction.
pub fn delete_module(db: &mut Connection, id: &str) -> Result<Vec<String>, String> {
    let transaction = db.transaction().map_err(|e| e.to_string())?;
    let found: i64 = transaction
        .query_row("SELECT COUNT(*) FROM modules WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    if found == 0 {
        return Err("Modul nicht gefunden".into());
    }
    let paths = {
        let mut stmt = transaction
            .prepare("SELECT local_path FROM documents WHERE module_id=?1")
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        iter.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    transaction
        .execute("DELETE FROM cards WHERE module_id=?1", [id])
        .map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM batches WHERE module_id=?1", [id])
        .map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM documents WHERE module_id=?1", [id])
        .map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM modules WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(paths)
}
