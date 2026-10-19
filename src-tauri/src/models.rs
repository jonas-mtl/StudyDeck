//! Shared data contracts. The frontend uses matching camelCase TypeScript types.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageText {
    pub page: i64,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    pub id: String,
    pub semester: String,
    pub name: String,
    pub profile: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub module_id: String,
    pub name: String,
    pub kind: String,
    pub page_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub module_id: String,
    pub batch_id: Option<String>,
    pub front: String,
    pub back: String,
    pub explanation: String,
    pub source_page: Option<i64>,
    pub image_page: Option<i64>,
    pub image_data: Option<String>,
    pub source_name: Option<String>,
    pub tags: Vec<String>,
    pub status: String,
    pub anki_note_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardPatch {
    pub id: String,
    pub front: String,
    pub back: String,
    pub explanation: String,
    pub source_page: Option<i64>,
    pub image_page: Option<i64>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<String>,
    pub errors: Vec<String>,
}
