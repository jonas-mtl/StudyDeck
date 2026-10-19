# KI-Prompts im StudyDeck bearbeiten

Öffne **Einstellungen (Zahnrad) → KI-Prompts**. Links kannst du die Vorlagen für Policy, Modulprofile, Karteikarten, zusätzliche Karten, Überarbeitungen, Themenabdeckung und JSON-Antwortschemata auswählen.

1. Prompt auswählen und den Text rechts ändern.
2. Auf **Änderungen speichern** klicken. Erst dann wirken deine Änderungen für **neue** KI-Anfragen.
3. **Standard wiederherstellen** verwirft die lokale Überschreibung für den gewählten Prompt.

Die Vorlagen sind **global pro Geräteinstallation**, nicht pro Modul. Sie werden in der vorhandenen `studydeck.sqlite` in `prompt_overrides` gespeichert; die Datei `src-tauri/src/services/prompts.rs` bleibt Quelle der unveränderten Standardtexte. Bereits generierte oder importierte Karten werden durch Prompt-Änderungen nicht verändert.

## Platzhalter

Bei Templates fügt StudyDeck zur Laufzeit die realen Inhalte ein. Zum Beispiel enthält der Karten-Prompt `{{slides}}` für den (bereits durch das Backend gekürzten) PDF-Seitentext, `{{profile}}` für das Modulprofil, `{{anki_questions}}` für bereits importierte Fragen und `{{task}}` für die gewählten Kartenregeln. Die Seitenbilder werden weiterhin unabhängig vom Prompt mitgeschickt.

Notwendige Platzhalter lassen sich nicht entfernen. Unbekannte Platzhalter werden beim Speichern abgewiesen. Die allgemeinen KI-Regeln `{{policy}}` werden in alle relevanten Prompts eingesetzt.

## Erweiterte JSON-Schemas

Die vier Antwort-Schemas können ebenfalls bearbeitet werden, etwa für `description`-Felder oder zusätzliche Regeln. Die erwarteten Typen, Pflichtfelder und Datenstrukturen können jedoch nicht entfernt oder geändert werden, weil die Rust-Verarbeitung sie voraussetzt. Ungültiges JSON wird beim Speichern abgewiesen.

## Rückgängig machen / Backup

Einzelne Prompts mit **Standard wiederherstellen** zurücksetzen. Die vorhandene SQLite-Datei regelmäßig sichern, um deine persönlichen Einstellungen und Module zu behalten. Die Prompt-Einstellungen werden nicht mit Git synchronisiert und nicht nach Anki übertragen.
