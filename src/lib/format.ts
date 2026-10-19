export const deckName = (semester: string, name: string) =>
  `${semester}::${name}`;
export const getSemesterOptions = () =>
  Array.from({ length: 12 }, (_, i) => `${i + 1}. Semester`);
export function normalizeQuestion(input: string): string {
  return input.toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]/gu, "");
}
export function shortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "–";
  }
}
