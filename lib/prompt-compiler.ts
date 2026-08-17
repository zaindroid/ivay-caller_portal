/**
 * Assembles Prompt Studio's structured fields into the format Bland's own
 * documentation actually recommends for task prompts: Goal / Call Flow /
 * Background / Example Dialogue (see bland.ai/blog/prompting-guide-ai-phone-calls).
 * This compiled string is exactly what gets sent as `task` to the telephony
 * backend -- nothing else is added invisibly, so the preview in the UI is
 * the literal truth of what the agent receives.
 *
 * Fields may contain {{variable}} tokens (see lib/prompt-presets.ts) --
 * these get substituted from `variables` before assembly. A token with no
 * value stays visible in the output (`{{business_name}}`) rather than
 * silently disappearing, so an unfinished agent is obvious in the preview
 * instead of shipping a prompt with a hole in it.
 */

export type PromptFields = {
  goal: string;
  callFlow: string;
  background: string;
  guardrails: string;
  exampleDialogue: string;
};

export type PromptVariables = Record<string, string>;

function substitute(text: string, variables: PromptVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (token, key) => variables[key]?.trim() || token);
}

export function compilePrompt(fields: PromptFields, variables: PromptVariables = {}): string {
  const sub = (s: string) => substitute(s.trim(), variables);
  const sections = [
    fields.goal.trim() && `Goal:\n${sub(fields.goal)}`,
    fields.callFlow.trim() && `Call Flow:\n${sub(fields.callFlow)}`,
    fields.background.trim() && `Background:\n${sub(fields.background)}`,
    fields.guardrails.trim() && `Guidelines:\n${sub(fields.guardrails)}`,
    fields.exampleDialogue.trim() && `Example Dialogue:\n${sub(fields.exampleDialogue)}`,
  ].filter(Boolean);
  return sections.join("\n\n");
}
