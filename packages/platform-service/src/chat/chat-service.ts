import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  chatConversation,
  chatEntry,
  type ChatConversation,
  type ChatEntry,
} from '@gamecrafter/contracts';
import type { ProjectDatabases } from '../projects/project-databases';

export class ChatService {
  constructor(
    private readonly databases: ProjectDatabases,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(projectId: string) {
    return this.databases
      .get(projectId)
      .prepare(
        `SELECT 1 AS schemaVersion, conversation_id AS conversationId, project_id AS projectId,
                title, created_at AS createdAt, updated_at AS updatedAt
         FROM chat_conversations WHERE project_id = ? ORDER BY updated_at DESC`,
      )
      .all<ChatConversation>(projectId)
      .map((row) => chatConversation.assert(row));
  }

  create(projectId: string, title: string) {
    const database = this.databases.get(projectId);
    const timestamp = this.now().toISOString();
    const conversation = chatConversation.assert({
      schemaVersion: 1,
      conversationId: uuidv7(),
      projectId,
      title: title.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    database
      .prepare(
        `INSERT INTO chat_conversations
         (conversation_id, project_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(conversation.conversationId, projectId, conversation.title, timestamp, timestamp);
    return conversation;
  }

  messages(projectId: string, conversationId: string): ChatEntry[] {
    this.requireConversation(projectId, conversationId);
    return this.databases
      .get(projectId)
      .prepare(
        `SELECT message_json AS messageJson FROM chat_messages
         WHERE project_id = ? AND conversation_id = ? ORDER BY created_at, rowid`,
      )
      .all<{ messageJson: string }>(projectId, conversationId)
      .map(({ messageJson }) => chatEntry.assert(JSON.parse(messageJson)));
  }

  append(input: {
    projectId: string;
    conversationId: string;
    role: ChatEntry['role'];
    content: string;
    modelId?: string | null;
    usage?: ChatEntry['usage'];
  }): ChatEntry {
    this.requireConversation(input.projectId, input.conversationId);
    const database = this.databases.get(input.projectId);
    const entry = chatEntry.assert({
      schemaVersion: 1,
      messageId: uuidv7(),
      conversationId: input.conversationId,
      projectId: input.projectId,
      role: input.role,
      content: input.content,
      modelId: input.modelId ?? null,
      usage: input.usage ?? null,
      createdAt: this.now().toISOString(),
    });
    database
      .prepare(
        `INSERT INTO chat_messages
         (message_id, conversation_id, project_id, created_at, message_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        entry.messageId,
        entry.conversationId,
        entry.projectId,
        entry.createdAt,
        JSON.stringify(entry),
      );
    database
      .prepare('UPDATE chat_conversations SET updated_at = ? WHERE conversation_id = ?')
      .run(entry.createdAt, input.conversationId);
    return entry;
  }

  delete(projectId: string, conversationId: string): boolean {
    this.requireConversation(projectId, conversationId);
    this.databases
      .get(projectId)
      .prepare('DELETE FROM chat_conversations WHERE project_id = ? AND conversation_id = ?')
      .run(projectId, conversationId);
    return true;
  }

  private requireConversation(projectId: string, conversationId: string): void {
    const row = this.databases
      .get(projectId)
      .prepare(
        'SELECT conversation_id AS conversationId FROM chat_conversations WHERE project_id = ? AND conversation_id = ?',
      )
      .get<{ conversationId: string }>(projectId, conversationId);
    if (!row)
      throw new RpcError(
        `Chat conversation not found: ${conversationId}`,
        RpcErrorCode.InvalidParams,
      );
  }
}
