import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import {
  uuidv7,
  type ChatConversation,
  type ChatEntry,
  type Model,
  type ProjectSummary,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import { MODELS_OPEN_COMMAND_ID } from './models-view-contribution';
import { SWARM_OPEN_COMMAND_ID } from './swarm-view-contribution';
import { CommandService } from '@theia/core/lib/common/command';

@injectable()
export class ChatWidget extends ReactWidget {
  static readonly ID = 'gamecrafter.chat';

  private projects: ProjectSummary[] = [];
  private models: Model[] = [];
  private conversations: ChatConversation[] = [];
  private messages: ChatEntry[] = [];
  private projectId = '';
  private conversationId = '';
  private selectedModelId = '';
  private draft = '';
  private mode: 'chat' | 'agent' = 'chat';
  private attachEditor = false;
  private busy = false;
  private requestId?: string;
  private streamText = '';
  private error?: string;

  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents) private readonly events: ControlRoomClientEvents,
    @inject(EditorManager) private readonly editorManager: EditorManager,
    @inject(CommandService) private readonly commands: CommandService,
  ) {
    super();
    this.id = ChatWidget.ID;
    this.title.label = 'Chat';
    this.title.iconClass = 'codicon codicon-comment-discussion';
    this.title.closable = true;
    this.toDispose.push(
      this.events.modelDelta(({ requestId, delta }) => {
        if (requestId !== this.requestId) return;
        this.streamText += delta;
        this.update();
      }),
    );
    this.toDispose.push(this.events.projectChanged(() => void this.refresh()));
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const currentConversation = this.conversations.find(
      (conversation) => conversation.conversationId === this.conversationId,
    );
    const activeEditor = this.editorManager.currentEditor;
    const editorName = activeEditor?.getResourceUri()?.path.base ?? 'No editor open';
    return (
      <div className="gamecrafter-chat gamecrafter-surface">
        <aside className="gamecrafter-chat-sidebar">
          <header>
            <strong>Conversations</strong>
            <button type="button" aria-label="New chat" onClick={() => void this.newConversation()}>
              +
            </button>
            {this.conversationId && (
              <button
                type="button"
                aria-label="Delete conversation"
                disabled={this.busy}
                onClick={() => void this.deleteConversation()}
              >
                Delete
              </button>
            )}
          </header>
          <label>
            Project
            <select
              aria-label="Chat Project"
              value={this.projectId}
              onChange={(event) => {
                this.projectId = event.currentTarget.value;
                this.conversationId = '';
                this.messages = [];
                void this.refresh();
              }}
            >
              <option value="">Select Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Chat conversations">
            {this.conversations.map((conversation) => (
              <button
                className={conversation.conversationId === this.conversationId ? 'is-active' : ''}
                key={conversation.conversationId}
                type="button"
                onClick={() => void this.openConversation(conversation.conversationId)}
              >
                <span>{conversation.title}</span>
                <small>{new Date(conversation.updatedAt).toLocaleDateString()}</small>
              </button>
            ))}
          </nav>
        </aside>
        <main className="gamecrafter-chat-main">
          <header className="gamecrafter-chat-header">
            <div>
              <h1>{currentConversation?.title ?? 'New conversation'}</h1>
              <p>
                Chat answers questions; Agent mode delegates tool-using work to the Project swarm.
              </p>
            </div>
            <div className="gamecrafter-chat-model-picker">
              <label>
                Model
                <select
                  aria-label="Chat model"
                  value={this.selectedModelId}
                  onChange={(event) => {
                    this.selectedModelId = event.currentTarget.value;
                    this.update();
                  }}
                >
                  <option value="">Auto route</option>
                  {this.models.map((model) => (
                    <option key={model.modelId} value={model.modelId}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void this.commands.executeCommand(MODELS_OPEN_COMMAND_ID)}
              >
                Manage models
              </button>
            </div>
          </header>
          {this.error && (
            <p className="gamecrafter-chat-error" role="alert">
              {this.error}
            </p>
          )}
          {this.models.length === 0 && this.projectId && (
            <p className="gamecrafter-chat-empty" role="status">
              No enabled streaming chat models are available. Add an account and discover a model in
              Models &amp; Routing.
            </p>
          )}
          <section className="gamecrafter-chat-transcript" aria-label="Conversation messages">
            {!this.projectId ? (
              <div className="gamecrafter-chat-empty">
                Choose a Project to start a conversation.
              </div>
            ) : this.messages.length === 0 ? (
              <div className="gamecrafter-chat-empty">
                <h2>What are you working on?</h2>
                <p>
                  Ask about your game, code, design canon, or the tools available in this Project.
                </p>
              </div>
            ) : (
              this.messages.map((entry) => (
                <article
                  className={`gamecrafter-chat-message is-${entry.role}`}
                  key={entry.messageId}
                >
                  <header>
                    <strong>
                      {entry.role === 'user'
                        ? 'You'
                        : entry.role === 'assistant'
                          ? 'GameCrafter'
                          : 'System'}
                    </strong>
                    <time>{new Date(entry.createdAt).toLocaleTimeString()}</time>
                  </header>
                  <div className="gamecrafter-chat-message-content">{entry.content}</div>
                  {entry.modelId && (
                    <footer>
                      {entry.modelId} · {entry.usage?.inputTokens ?? 0} in /{' '}
                      {entry.usage?.outputTokens ?? 0} out
                      {entry.usage?.costUsd === null || entry.usage?.costUsd === undefined
                        ? ''
                        : ` · $${entry.usage.costUsd.toFixed(4)}`}
                    </footer>
                  )}
                </article>
              ))
            )}
            {this.busy && (
              <article className="gamecrafter-chat-message is-assistant" aria-live="polite">
                <header>
                  <strong>{this.mode === 'agent' ? 'Swarm handoff' : 'GameCrafter'}</strong>
                </header>
                <div className="gamecrafter-chat-message-content">
                  {this.streamText ||
                    (this.mode === 'agent' ? 'Creating change request…' : 'Thinking…')}
                </div>
              </article>
            )}
          </section>
          {this.messages.some((entry) => entry.role === 'user') && (
            <button
              className="gamecrafter-chat-delegate"
              type="button"
              disabled={this.busy}
              onClick={() => void this.delegateLastRequest()}
            >
              Delegate conversation to Swarm
            </button>
          )}
          <form
            className="gamecrafter-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void this.send();
            }}
          >
            <div className="gamecrafter-chat-composer-options">
              <div role="group" aria-label="Assistant mode" className="gamecrafter-chat-modes">
                <button
                  type="button"
                  aria-pressed={this.mode === 'chat'}
                  onClick={() => this.setMode('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  aria-pressed={this.mode === 'agent'}
                  onClick={() => this.setMode('agent')}
                >
                  Agent
                </button>
              </div>
              <label className="gamecrafter-chat-attach">
                <input
                  type="checkbox"
                  checked={this.attachEditor}
                  onChange={(event) => {
                    this.attachEditor = event.currentTarget.checked;
                    this.update();
                  }}
                />
                Attach editor context <small>{editorName}</small>
              </label>
            </div>
            <textarea
              aria-label="Message"
              placeholder={
                this.mode === 'agent' ? 'Describe work for the Project swarm…' : 'Ask GameCrafter…'
              }
              value={this.draft}
              disabled={!this.projectId || this.busy}
              onChange={(event) => {
                this.draft = event.currentTarget.value;
                this.update();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void this.send();
                }
              }}
            />
            <footer>
              <small>Enter to send · Shift+Enter for a new line</small>
              <button
                className="theia-button"
                type="submit"
                disabled={
                  !this.draft.trim() ||
                  !this.projectId ||
                  this.busy ||
                  (this.mode === 'chat' && this.models.length === 0)
                }
              >
                {this.mode === 'agent' ? 'Send to Swarm' : 'Send'}
              </button>
            </footer>
          </form>
        </main>
      </div>
    );
  }

  private setMode(mode: 'chat' | 'agent'): void {
    this.mode = mode;
    this.update();
  }

  private async refresh(): Promise<void> {
    try {
      this.projects = await this.service.listProjects();
      if (
        !this.projectId ||
        !this.projects.some((project) => project.projectId === this.projectId)
      ) {
        this.projectId = this.projects[0]?.projectId ?? '';
      }
      if (this.projectId) {
        const [conversations, models] = await Promise.all([
          this.service.listChatConversations(this.projectId),
          this.service.listModels(undefined, true),
        ]);
        this.conversations = conversations;
        this.models = models.filter(
          (model) => model.capabilities.chat && model.capabilities.streaming,
        );
        if (
          this.conversationId &&
          !conversations.some((entry) => entry.conversationId === this.conversationId)
        ) {
          this.conversationId = '';
          this.messages = [];
        }
        if (this.conversationId) {
          this.messages = await this.service.listChatMessages(this.projectId, this.conversationId);
        }
      } else {
        this.conversations = [];
        this.messages = [];
      }
      this.error = undefined;
    } catch (error) {
      this.error = messageOf(error);
    }
    this.update();
  }

  private newConversation(): void {
    if (!this.projectId) return;
    this.conversationId = '';
    this.messages = [];
    this.error = undefined;
    this.update();
  }

  private async openConversation(conversationId: string): Promise<void> {
    if (!this.projectId) return;
    try {
      this.conversationId = conversationId;
      this.messages = await this.service.listChatMessages(this.projectId, conversationId);
      this.error = undefined;
    } catch (error) {
      this.error = messageOf(error);
    }
    this.update();
  }

  private async deleteConversation(): Promise<void> {
    if (!this.projectId || !this.conversationId) return;
    const conversationId = this.conversationId;
    try {
      await this.service.deleteChatConversation(this.projectId, conversationId);
      this.conversations = this.conversations.filter(
        (entry) => entry.conversationId !== conversationId,
      );
      this.conversationId = '';
      this.messages = [];
      this.error = undefined;
    } catch (error) {
      this.error = messageOf(error);
    }
    this.update();
  }

  private async send(): Promise<void> {
    const raw = this.draft.trim();
    if (!raw || !this.projectId || this.busy) return;
    this.busy = true;
    this.error = undefined;
    this.streamText = '';
    this.draft = '';
    this.update();
    try {
      if (!this.conversationId) {
        const conversation = await this.service.createChatConversation(
          this.projectId,
          titleFrom(raw),
        );
        this.conversationId = conversation.conversationId;
        this.conversations = [conversation, ...this.conversations];
      }
      const prompt = this.attachEditor ? `${raw}\n\n${this.editorContext()}` : raw;
      const userMessage = await this.service.appendChatMessage({
        projectId: this.projectId,
        conversationId: this.conversationId,
        role: 'user',
        content: prompt,
      });
      this.messages = [...this.messages, userMessage];
      this.update();
      if (this.mode === 'agent') {
        const change = await this.service.requestChange({
          projectId: this.projectId,
          text: this.agentPrompt(prompt),
        });
        const response = await this.service.appendChatMessage({
          projectId: this.projectId,
          conversationId: this.conversationId,
          role: 'assistant',
          content: `Delegated to the Project swarm. Change request ${change.requestId} was created. Open Swarm to follow task progress, questions, approvals, and results.`,
        });
        this.messages = [...this.messages, response];
        await this.commands.executeCommand(SWARM_OPEN_COMMAND_ID);
      } else {
        const history = this.messages
          .filter((entry) => entry.role !== 'system')
          .map(({ role, content }) => ({ role, content }) as const);
        const requestId = uuidv7();
        this.requestId = requestId;
        const project = this.projects.find((entry) => entry.projectId === this.projectId);
        const result = await this.service.completeChat({
          projectId: this.projectId,
          requestId,
          route: {
            taskType: 'chat',
            projectId: this.projectId,
            requiredCapabilities: ['chat', 'streaming'],
            ...(this.selectedModelId ? { manualModelId: this.selectedModelId } : {}),
          },
          request: {
            messages: [
              {
                role: 'system',
                content: [
                  'You are GameCrafter, an assistant inside a game-development IDE.',
                  'Give practical, honest help and use the supplied Project context.',
                  'Chat mode cannot edit files or invoke tools. For implementation work, tell the user to switch to Agent mode, which delegates to the Project swarm and its existing access controls.',
                  `Project: ${project?.name ?? 'Unknown'}`,
                  `Description: ${project?.description ?? ''}`,
                  `Engine: ${project?.engine.family ?? 'Unknown'}`,
                  `Genres: ${project?.genres.join(', ') || 'not specified'}`,
                ].join('\n'),
              },
              ...history,
            ],
            stream: true,
          },
        });
        const assistant = await this.service.appendChatMessage({
          projectId: this.projectId,
          conversationId: this.conversationId,
          role: 'assistant',
          content: result.content || this.streamText,
          modelId: result.modelId,
          usage: result.usage,
        });
        this.messages = [...this.messages, assistant];
      }
      await this.refresh();
    } catch (error) {
      this.error = messageOf(error);
    } finally {
      this.busy = false;
      this.requestId = undefined;
      this.streamText = '';
      this.update();
    }
  }

  private async delegateLastRequest(): Promise<void> {
    const lastUser = [...this.messages].reverse().find((entry) => entry.role === 'user');
    if (!lastUser) return;
    this.draft = lastUser.content;
    this.mode = 'agent';
    await this.send();
  }

  private agentPrompt(prompt: string): string {
    const prior = this.messages.slice(0, -1).slice(-12);
    const context = prior.map((entry) => `${entry.role}: ${entry.content}`).join('\n\n');
    return context ? `Conversation context:\n${context}\n\nRequested work:\n${prompt}` : prompt;
  }

  private editorContext(): string {
    const editor = this.editorManager.currentEditor;
    if (!editor) return 'Editor context requested, but no text editor is active.';
    const uri = editor.getResourceUri()?.toString() ?? 'unknown file';
    const selection = editor.editor.selection;
    const document = editor.editor.document;
    const hasSelection =
      selection &&
      (selection.start.line !== selection.end.line ||
        selection.start.character !== selection.end.character);
    const selectedText = hasSelection ? document.getText(selection) : '';
    const text = selectedText || document.getText();
    return `Current editor: ${uri}\n${selectedText ? 'Selected text' : 'File excerpt'}:\n${text.slice(0, 20_000)}`;
  }
}

function titleFrom(text: string): string {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? 'New conversation';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
