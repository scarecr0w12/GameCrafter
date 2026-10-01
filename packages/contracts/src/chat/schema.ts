import { Static, Type } from '@sinclair/typebox';
import { ModelUsageSchema } from '../models/schema';
import { compile } from '../validation';

export const ChatConversationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    conversationId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ChatConversation = Static<typeof ChatConversationSchema>;
export const chatConversation = compile<ChatConversation>(ChatConversationSchema);

export const ChatEntrySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    messageId: Type.String({ format: 'uuid' }),
    conversationId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    role: Type.Union([Type.Literal('user'), Type.Literal('assistant'), Type.Literal('system')]),
    content: Type.String(),
    modelId: Type.Union([Type.String(), Type.Null()]),
    usage: Type.Union([ModelUsageSchema, Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ChatEntry = Static<typeof ChatEntrySchema>;
export const chatEntry = compile<ChatEntry>(ChatEntrySchema);
