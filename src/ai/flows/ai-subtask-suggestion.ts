'use server';
/**
 * @fileOverview An AI assistant that breaks a task down into subtasks.
 *
 * - suggestSubtasks - A function that suggests subtask titles for a task.
 * - SuggestSubtasksInput - The input type for the suggestSubtasks function.
 * - SuggestSubtasksOutput - The return type for the suggestSubtasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSubtasksInputSchema = z.object({
  title: z.string().describe('The title of the task to break down.'),
  description: z.string().optional().describe('The description of the task.'),
});
export type SuggestSubtasksInput = z.infer<typeof SuggestSubtasksInputSchema>;

const SuggestSubtasksOutputSchema = z.object({
  subtasks: z
    .array(z.string())
    .describe('Suggested subtask titles that together break the task down into concrete, actionable steps.'),
});
export type SuggestSubtasksOutput = z.infer<typeof SuggestSubtasksOutputSchema>;

export async function suggestSubtasks(
  input: SuggestSubtasksInput
): Promise<SuggestSubtasksOutput> {
  return suggestSubtasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSubtasksPrompt',
  input: {schema: SuggestSubtasksInputSchema},
  output: {schema: SuggestSubtasksOutputSchema},
  prompt: `You are an AI assistant that helps users break a project management task down into smaller, actionable subtasks.

Given the task title (and description, if provided), suggest 3 to 6 concrete subtasks that together cover what it takes to complete the task. Each subtask title should be short (a few words to one short sentence) and describe a single actionable step, not a restatement of the whole task.

Task Title: {{{title}}}
{{#if description}}
Task Description: {{{description}}}
{{/if}}

Suggest the subtasks.`,
});

const suggestSubtasksFlow = ai.defineFlow(
  {
    name: 'suggestSubtasksFlow',
    inputSchema: SuggestSubtasksInputSchema,
    outputSchema: SuggestSubtasksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
