'use server';
/**
 * @fileOverview An AI assistant that suggests and refines task descriptions.
 *
 * - generateTaskDescription - A function that generates a detailed task description based on a task title.
 * - GenerateTaskDescriptionInput - The input type for the generateTaskDescription function.
 * - GenerateTaskDescriptionOutput - The return type for the generateTaskDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTaskDescriptionInputSchema = z.object({
  taskTitle: z
    .string()
    .describe('The title of the task for which to generate a description.'),
});
export type GenerateTaskDescriptionInput = z.infer<
  typeof GenerateTaskDescriptionInputSchema
>;

const GenerateTaskDescriptionOutputSchema = z.object({
  taskDescription: z.string().describe('A detailed description for the task.'),
});
export type GenerateTaskDescriptionOutput = z.infer<
  typeof GenerateTaskDescriptionOutputSchema
>;

export async function generateTaskDescription(
  input: GenerateTaskDescriptionInput
): Promise<GenerateTaskDescriptionOutput> {
  return generateTaskDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTaskDescriptionPrompt',
  input: {schema: GenerateTaskDescriptionInputSchema},
  output: {schema: GenerateTaskDescriptionOutputSchema},
  prompt: `You are an AI assistant specialized in project management and task decomposition. Your goal is to help users quickly articulate task purposes.

Given the task title, generate a detailed and comprehensive description for the task. The description should clarify the task's objective, potential steps, and expected outcomes, making it clear what needs to be done.

Task Title: {{{taskTitle}}}`,
});

const generateTaskDescriptionFlow = ai.defineFlow(
  {
    name: 'generateTaskDescriptionFlow',
    inputSchema: GenerateTaskDescriptionInputSchema,
    outputSchema: GenerateTaskDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
