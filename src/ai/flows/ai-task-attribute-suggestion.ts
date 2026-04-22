'use server';
/**
 * @fileOverview An AI assistant that suggests task attributes (priority and tags) based on the task's title and description.
 *
 * - suggestTaskAttributes - A function that handles the task attribute suggestion process.
 * - SuggestTaskAttributesInput - The input type for the suggestTaskAttributes function.
 * - SuggestTaskAttributesOutput - The return type for the suggestTaskAttributes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskAttributesInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  description: z.string().optional().describe('The description of the task.'),
});
export type SuggestTaskAttributesInput = z.infer<typeof SuggestTaskAttributesInputSchema>;

const SuggestTaskAttributesOutputSchema = z.object({
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .describe('Suggested priority level for the task.'),
  tags: z
    .array(z.string())
    .describe(
      'Suggested relevant tags for the task, based on the title and description. Can be an empty array if no tags are suggested.'
    ),
});
export type SuggestTaskAttributesOutput = z.infer<typeof SuggestTaskAttributesOutputSchema>;

export async function suggestTaskAttributes(
  input: SuggestTaskAttributesInput
): Promise<SuggestTaskAttributesOutput> {
  return suggestTaskAttributesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskAttributesPrompt',
  input: {schema: SuggestTaskAttributesInputSchema},
  output: {schema: SuggestTaskAttributesOutputSchema},
  prompt: `You are an AI assistant that helps users categorize and prioritize tasks. Your goal is to suggest a priority level and relevant tags for a given task based on its title and description.

Priority levels can be 'low', 'medium', 'high', or 'urgent'.
Tags should be comma-separated relevant keywords. If no tags are appropriate, return an empty array.

Task Title: {{{title}}}
{{#if description}}
Task Description: {{{description}}}
{{/if}}

Suggest the best priority and tags for this task.`,
});

const suggestTaskAttributesFlow = ai.defineFlow(
  {
    name: 'suggestTaskAttributesFlow',
    inputSchema: SuggestTaskAttributesInputSchema,
    outputSchema: SuggestTaskAttributesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
