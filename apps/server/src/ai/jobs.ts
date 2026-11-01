import {
  AISuggestOptionsResponseSchema,
  AIAnalyzeResponseSchema,
  AISummaryResponseSchema,
  type Option,
  type Analysis,
  type Disagreement,
} from '@quorum/shared';
import type { InternalRoom } from '../auth/reconnect.js';
import type { AIProvider } from './provider.js';
import { buildSuggestOptionsPrompt, buildAnalyzePrompt, buildSummaryPrompt } from './prompts.js';
import { computeStats, findDisagreementParticipants, type OptionStats } from '../state/statistics.js';

/**
 * Suggest up to 3 new option titles using AI
 * Returns array of option titles (deduplicated and validated)
 */
export async function suggestOptions(
  provider: AIProvider,
  roomTitle: string,
  existingOptions: Option[]
): Promise<string[]> {
  const prompt = buildSuggestOptionsPrompt(roomTitle, existingOptions);
  const responseText = await provider.complete(prompt);

  // Parse and validate JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = AISuggestOptionsResponseSchema.parse(parsed);

  // Deduplicate against existing options (case-insensitive)
  const existingTitlesLower = existingOptions.map((opt) => opt.title.toLowerCase());
  const uniqueSuggestions = validated.options.filter(
    (title) => !existingTitlesLower.includes(title.toLowerCase())
  );

  return uniqueSuggestions;
}

/**
 * Analyze ratings and produce Analysis object using AI
 * Falls back to deterministic analysis if AI fails
 */
export async function analyzeRoom(
  provider: AIProvider,
  room: InternalRoom,
  stats: OptionStats[]
): Promise<Analysis> {
  const prompt = buildAnalyzePrompt(room, stats);
  const responseText = await provider.complete(prompt);

  // Parse and validate JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = AIAnalyzeResponseSchema.parse(parsed);

  // Verify compromise optionId exists
  const compromiseExists = room.options.some((opt) => opt.id === validated.compromise.optionId);
  if (!compromiseExists) {
    throw new Error('AI returned invalid compromise optionId');
  }

  // Verify disagreement optionIds exist
  for (const disagreement of validated.disagreements) {
    const optionExists = room.options.some((opt) => opt.id === disagreement.optionId);
    if (!optionExists) {
      throw new Error('AI returned invalid disagreement optionId');
    }
  }

  // Build full disagreements with participant names
  const fullDisagreements: Disagreement[] = [];
  for (const aiDisagreement of validated.disagreements) {
    const participants = findDisagreementParticipants(aiDisagreement.optionId, room);
    if (participants) {
      fullDisagreements.push({
        optionId: aiDisagreement.optionId,
        highName: participants.highName,
        lowName: participants.lowName,
        note: aiDisagreement.note,
      });
    }
  }

  // Build perOption analysis from stats
  const perOption = stats.map((stat) => ({
    optionId: stat.optionId,
    mean: stat.mean,
    spread: stat.spread,
    verdict: stat.verdict,
  }));

  return {
    perOption,
    disagreements: fullDisagreements,
    compromise: validated.compromise,
    aiUnavailable: false,
  };
}

/**
 * Write a summary of the decision using AI
 */
export async function writeSummary(
  provider: AIProvider,
  room: InternalRoom,
  stats: OptionStats[]
): Promise<string> {
  const prompt = buildSummaryPrompt(room, stats);
  const responseText = await provider.complete(prompt);

  // Parse and validate JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = AISummaryResponseSchema.parse(parsed);

  return validated.summary;
}
