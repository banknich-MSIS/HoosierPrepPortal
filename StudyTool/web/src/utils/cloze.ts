
// Regex to identify blanks in the stored stem
export const CLOZE_REGEX = /\{\{BLANK\}\}|\[BLANK\]|___+/g;

// Format the stored question data into a single string for editing
// e.g. "The capital of France is {{BLANK}}." + ["Paris"] -> "The capital of France is [Paris]."
export function formatClozeForEditing(stem: string, answers: any): string {
  const ansArray = Array.isArray(answers) ? answers : [answers];
  let i = 0;
  
  // Check if stem actually has placeholders; if not, and we have answers, append them (fallback)
  if (!CLOZE_REGEX.test(stem) && ansArray.length > 0 && ansArray[0]) {
      // Heuristic: if no explicit blank token, maybe it was just text? 
      // Or maybe it's legacy format? 
      // If legacy "short answer" style disguised as cloze, just return stem + [answer]
      // But usually we want to find where it goes. 
      // For now, let's just return stem. The user will have to add [brackets] manually if missing.
      return stem; 
  }

  return stem.replace(CLOZE_REGEX, () => {
    const ans = ansArray[i++] || ""; // Use empty string if no answer corresponding to blank
    return `[${ans}]`;
  });
}

// Parse the edited text back into stem and answers
// e.g. "The capital of France is [Paris]." -> { stem: "The capital of France is {{BLANK}}.", answers: ["Paris"] }
export function parseClozeFromEditing(editorText: string): { stem: string; answers: string[] } {
  const answers: string[] = [];
  
  // Replace [Anything] with {{BLANK}} and capture "Anything"
  const stem = editorText.replace(/\[(.*?)\]/g, (match, p1) => {
    answers.push(p1);
    return "{{BLANK}}";
  });
  
  return { stem, answers };
}

