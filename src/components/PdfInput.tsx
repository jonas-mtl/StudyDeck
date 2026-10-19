import { useRef, useState } from "react";
import { FileUp, FileText, LoaderCircle } from "lucide-react";
import { readPdf } from "../lib/pdf";
import type { PageText } from "../types/domain";
export interface PdfSelection {
  name: string;
  pages: PageText[];
  base64: string;
}
export function PdfInput({
  label,
  onSelect,
  multiple = false,
}: {
  label: string;
  onSelect: (files: PdfSelection[]) => void;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function process(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    setError("");
    try {
      const selections: PdfSelection[] = [];
      for (const file of Array.from(files)) {
        const d = await readPdf(file);
        selections.push({ name: file.name, ...d });
      }
      setNames(selections.map((x) => x.name));
      onSelect(selections);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="pdf-holder">
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        hidden
        onChange={(e) => {
          void process(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        className="upload-field"
        type="button"
        onClick={() => ref.current?.click()}
        disabled={working}
      >
        {working ? (
          <LoaderCircle className="spin" size={22} />
        ) : names.length ? (
          <FileText size={22} />
        ) : (
          <FileUp size={22} />
        )}
        <span>
          <strong>{names.length ? names.join(" · ") : label}</strong>
          <small>
            {working
              ? "PDF wird vorbereitet …"
              : names.length
                ? "Klicken, um Dateien auszutauschen"
                : "PDF auswählen · Bilder werden später visuell analysiert"}
          </small>
        </span>
      </button>
      {error && <small className="error-text">{error}</small>}
    </div>
  );
}
