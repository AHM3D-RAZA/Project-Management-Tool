'use server';
/**
 * @fileOverview An AI assistant that suggests a reasonable due date for a task.
 *
 * - suggestDueDate - A function that suggests a due date for a task.
 * - SuggestDueDateInput - The input type for the suggestDueDate function.
 * - SuggestDueDateOutput - The return type for the suggestDueDate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestDueDateInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  description: z.string().optional().describe('The description of the task.'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .describe('The priority of the task, if set.'),
  currentDate: z.string().describe("Today's date in YYYY-MM-DD format, for the AI to reason relative to."),
});
export type SuggestDueDateInput = z.infer<typeof SuggestDueDateInputSchema>;

const SuggestDueDateOutputSchema = z.object({
  dueDate: z.string().describe('The suggested due date, in YYYY-MM-DD format, on or after currentDate.'),
  reasoning: z.string().describe('A brief (one sentence) explanation for the suggested due date.'),
});
export type SuggestDueDateOutput = z.infer<typeof SuggestDueDateOutputSchema>;

export async function suggestDueDate(
  input: SuggestDueDateInput
): Promise<SuggestDueDateOutput> {
  return suggestDueDateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestDueDatePrompt',
  input: {schema: SuggestDueDateInputSchema},
  output: {schema: SuggestDueDateOutputSchema},
  prompt: `You are an AI assistant that helps users set realistic due dates for project management tasks.

Given the task's title, description, and priority, and today's date, suggest a reasonable due date. Use the priority as a strong signal for urgency: 'urgent' tasks should be due very soon (within a day or two), 'high' within about a week, 'medium' within one to two weeks, and 'low' within a few weeks. Use the title and description to judge how much work the task likely involves, and adjust within that range accordingly. The suggested date must be on or after today's date.

Task Title: {{{title}}}
{{#if description}}
Task Description: {{{description}}}
{{/if}}
{{#if priority}}
Priority: {{{priority}}}
{{/if}}
Today's Date: {{{currentDate}}}

Suggest the due date and a brief reason for it.`,
});

const suggestDueDateFlow = ai.defineFlow(
  {
    name: 'suggestDueDateFlow',
    inputSchema: SuggestDueDateInputSchema,
    outputSchema: SuggestDueDateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
