import katex from "katex";
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
/** Preserves native Anki MathJax delimiters while rendering KaTeX in preview. */
export function MathText({ text }: { text: string }) {
  const tokens = text.split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);
  return (
    <div className="math-text">
      {tokens.map((token, i) => {
        if (token.startsWith("\\[") || token.startsWith("\\(")) {
          const display = token.startsWith("\\[");
          const latex = token.slice(2, -2);
          try {
            return (
              <span
                key={i}
                className={display ? "math-block" : "math-inline"}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(latex, {
                    displayMode: display,
                    throwOnError: false,
                    trust: false,
                    strict: "ignore",
                  }),
                }}
              />
            );
          } catch {
            return <span key={i}>{token}</span>;
          }
        }
        const segments = token.split(/(\*\*[^*]+\*\*)/g);
        const output: ReactNode[] = segments.map((segment, j) =>
          segment.startsWith("**") && segment.endsWith("**") ? (
            <strong key={j}>{segment.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{segment}</span>
          ),
        );
        return <span key={i}>{output}</span>;
      })}
    </div>
  );
}
