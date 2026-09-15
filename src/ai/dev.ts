import { config } from 'dotenv';
config();

import '@/ai/flows/ai-task-attribute-suggestion.ts';
import '@/ai/flows/ai-task-description-generation.ts';
import '@/ai/flows/ai-subtask-suggestion.ts';
import '@/ai/flows/ai-due-date-suggestion.ts';