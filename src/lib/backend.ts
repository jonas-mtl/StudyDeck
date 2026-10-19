/** All native operations are funneled through this typed adapter. */
import { invoke } from "@tauri-apps/api/core";
import type {
  Card,
  AiSettings,
  AiModel,
  CardPatch,
  ConnectionStatus,
  PromptEntry,
  Coverage,
  ImportResult,
  AiLoginState,
  DocumentVisuals,
  VisualPage,
  PageText,
  StudyDocument,
  StudyModule,
} from "../types/domain";
const call = <T>(command: string, args: Record<string, unknown> = {}) =>
  invoke<T>(command, args);
export const backend = {
  status: () => call<ConnectionStatus>("connection_status"),
  aiSettings: () => call<AiSettings>("get_ai_settings"),
  aiModels: () => call<AiModel[]>("list_ai_models"),
  saveAiSettings: (maxPagesPerRequest: number, modelId: string | null) =>
    call<AiSettings>("save_ai_settings", { maxPagesPerRequest, modelId }),
  prompts: () => call<PromptEntry[]>("list_prompts"),
  savePrompt: (id: string, value: string) => call<PromptEntry>("save_prompt", { id, value }),
  resetPrompt: (id: string) => call<PromptEntry>("reset_prompt", { id }),
  aiLoginState: () => call<AiLoginState>("ai_login_state"),
  beginAiLogin: () => call<void>("begin_ai_login"),
  submitAiCode: (code: string) => call<void>("submit_ai_auth_code", { code }),
  logoutAi: () => call<void>("logout_ai"),
  modules: () => call<StudyModule[]>("list_modules"),
  createModule: (name: string, semester: string) =>
    call<StudyModule>("create_module", { name, semester }),
  deleteModule: (moduleId: string) => call<void>("delete_module", { moduleId }),
  documents: (moduleId: string) =>
    call<StudyDocument[]>("list_documents", { moduleId }),
  saveDocument: (
    moduleId: string,
    name: string,
    kind: "lecture" | "exam",
    pages: PageText[],
    pdfBase64: string,
  ) =>
    call<StudyDocument>("save_document", {
      moduleId,
      name,
      kind,
      pages,
      pdfBase64,
    }),
  documentPdf: (documentId: string) =>
    call<string>("get_document_pdf", { documentId }),
  generateProfile: (moduleId: string, visualDocuments: DocumentVisuals[]) =>
    call<StudyModule>("generate_profile", { moduleId, visualDocuments }),
  audit: (moduleId: string, visualDocuments: DocumentVisuals[]) =>
    call<Coverage>("audit_coverage", { moduleId, visualDocuments }),
  cards: (moduleId: string) => call<Card[]>("list_cards", { moduleId }),
  generate: (
    moduleId: string,
    documentId: string,
    fromPage: number,
    toPage: number,
    hints: string,
    visuals: VisualPage[],
  ) =>
    call<Card[]>("generate_cards", {
      moduleId,
      documentId,
      fromPage,
      toPage,
      hints,
      visuals,
    }),
  extra: (
    moduleId: string,
    documentId: string,
    fromPage: number,
    toPage: number,
    instruction: string,
    visuals: VisualPage[],
  ) =>
    call<Card[]>("generate_extra_card", {
      moduleId,
      documentId,
      fromPage,
      toPage,
      instruction,
      visuals,
    }),
  rewrite: (cardId: string, instruction: string) =>
    call<Pick<Card, "front" | "back" | "explanation">>("rewrite_card", {
      cardId,
      instruction,
    }),
  addManual: (
    moduleId: string,
    front: string,
    back: string,
    explanation: string,
  ) => call<Card>("add_manual_card", { moduleId, front, back, explanation }),
  updateCard: (patch: CardPatch) => call<Card>("update_card", { patch }),
  deleteCard: (cardId: string) => call<void>("delete_card", { cardId }),
  attachImage: (cardId: string, imageData: string, page: number) =>
    call<Card>("attach_card_image", { cardId, imageData, page }),
  importCards: (moduleId: string, cardIds: string[]) =>
    call<ImportResult>("import_cards", { moduleId, cardIds }),
};
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
