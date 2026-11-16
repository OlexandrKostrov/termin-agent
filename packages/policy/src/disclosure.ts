import type { PatientProfile, TranscriptTurn } from '@termin/domain';

/** Bump when the wording changes; recorded with each call for audit. */
export const DISCLOSURE_VERSION = 1;

/**
 * The agent's first sentence (EU AI Act Art. 50: people must be told they
 * are talking to an AI). A fixed template, never LLM-generated, so it cannot
 * be paraphrased away. It names the person the call is for.
 */
export function disclosureSentence(name: PatientProfile['name']): string {
  return `Guten Tag, hier spricht ein KI-Assistent, also eine künstliche Intelligenz, im Auftrag von ${name.given} ${name.family}.`;
}

/**
 * True iff the first agent turn starts with the exact disclosure sentence.
 * Used as a hard gate in evals and as a runtime assertion.
 */
export function isDisclosureFirst(
  transcript: readonly TranscriptTurn[],
  name: PatientProfile['name'],
): boolean {
  const firstAgentTurn = transcript.find((t) => t.speaker === 'agent');
  return firstAgentTurn?.text.startsWith(disclosureSentence(name)) ?? false;
}
