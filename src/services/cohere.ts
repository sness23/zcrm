import { CohereClientV2 } from 'cohere-ai';
import dotenv from 'dotenv';

dotenv.config();

export const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY || '',
});

export const AI_MODEL = "command-a-03-2025";

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: ToolCall[];
  toolPlan?: string;
  toolCallId?: string;
}
