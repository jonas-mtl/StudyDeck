export interface PageText {
  page: number;
  text: string;
}
export interface VisualPage {
  page: number;
  imageData: string;
}
export interface DocumentVisuals {
  documentId: string;
  pages: VisualPage[];
}
export interface AiLoginState {
  phase:
    | "disconnected"
    | "opening"
    | "browser"
    | "waiting"
    | "code"
    | "connected"
    | "error";
  message: string;
  url: string | null;
}
export interface ModuleProfile {
  summary: string;
  examFocus: string[];
  coreConcepts: string[];
  questionStyle: string[];
  excluded: string[];
  evidence: string[];
}
export interface StudyModule {
  id: string;
  name: string;
  semester: string;
  profile: ModuleProfile | null;
  createdAt: string;
}
export interface StudyDocument {
  id: string;
  moduleId: string;
  name: string;
  kind: "exam" | "lecture";
  pageCount: number;
  createdAt: string;
}
export interface Card {
  id: string;
  moduleId: string;
  batchId: string | null;
  front: string;
  back: string;
  explanation: string;
  sourcePage: number | null;
  imagePage: number | null;
  imageData: string | null;
  sourceName: string | null;
  tags: string[];
  status: "draft" | "imported";
  ankiNoteId: number | null;
  createdAt: string;
}
export type CardPatch = Pick<
  Card,
  "id" | "front" | "back" | "explanation" | "sourcePage" | "imagePage" | "tags"
>;
export interface ConnectionStatus {
  ankiConnected: boolean;
  ankiMessage: string;
  aiConnected: boolean;
  aiMessage: string;
}
export interface ImportResult {
  imported: string[];
  errors: string[];
}

export interface Coverage {
  overview: string;
  covered: string[];
  missing: string[];
  uncertain: string[];
}

/** Ein bearbeitbarer KI-Prompt aus der lokalen SQLite-Einstellung. */
export interface PromptEntry {
  id: string;
  title: string;
  description: string;
  group: string;
  kind: "text" | "template" | "json";
  placeholders: string[];
  defaultValue: string;
  value: string;
  customized: boolean;
}

/** Lokal gespeicherte KI-Ausführungseinstellungen. */
export interface AiSettings {
  maxPagesPerRequest: number;
  modelId: string | null;
}

export interface AiModel {
  id: string;
  name: string;
}
