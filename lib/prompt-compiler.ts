/**
 * Assembles Prompt Studio's structured fields into the format Bland's own
 * documentation actually recommends for task prompts: Goal / Call Flow /
 * Background / Example Dialogue (see bland.ai/blog/prompting-guide-ai-phone-calls).
 * This compiled string is exactly what gets sent as `task` to the telephony
 * backend -- nothing else is added invisibly, so the preview in the UI is
 * the literal truth of what the agent receives.
 */

export type PromptFields = {
  goal: string;
  callFlow: string;
  background: string;
  guardrails: string;
  exampleDialogue: string;
};

export function compilePrompt(fields: PromptFields): string {
  const sections = [
    fields.goal.trim() && `Goal:\n${fields.goal.trim()}`,
    fields.callFlow.trim() && `Call Flow:\n${fields.callFlow.trim()}`,
    fields.background.trim() && `Background:\n${fields.background.trim()}`,
    fields.guardrails.trim() && `Guidelines:\n${fields.guardrails.trim()}`,
    fields.exampleDialogue.trim() && `Example Dialogue:\n${fields.exampleDialogue.trim()}`,
  ].filter(Boolean);
  return sections.join("\n\n");
}
