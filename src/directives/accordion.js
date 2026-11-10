// The facts an accordion's markup states (docs/spec/directives.md, `accordion`).

// A question ends in a question mark: the Latin one, the full-width one of Chinese and Japanese, and the
// Arabic one, which Persian and Urdu share.
const QUESTION = /[?？؟]$/u;

// True where there is at least one text and every one, trimmed, ends in a question mark. The site writes
// `data-kn-questions` on the accordion where it holds for the items' headings.
export function allQuestions(texts) {
  const list = [...(texts ?? [])];
  return list.length > 0 && list.every((text) => QUESTION.test(String(text ?? '').trim()));
}
