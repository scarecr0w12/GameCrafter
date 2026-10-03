// Scripted responses exercise the real agent runtime; they are not model reasoning.
function fixtureCompletion(body) {
  const child = body.messages?.some(
    (message) =>
      message.role === 'user' && String(message.content).includes('Lantern scripted child'),
  );
  const parent = body.messages?.some(
    (message) =>
      message.role === 'user' && String(message.content).includes('Lantern scripted request'),
  );
  if (!child && !parent)
    return {
      role: 'assistant',
      content:
        'Documentation fixture response (no real model).\n\nFor Lantern Workshop, record the lantern collection rule in docs/DESIGN.md, discuss changes on the Discussion Board, and search the design in Knowledge. Use Agent mode for supervised implementation and review its evidence in Swarm.',
    };
  const stage = body.messages.filter(
    (message) => message.role === 'assistant' && message.tool_calls?.length,
  ).length;
  let name, args;
  const complete = {
    summary: 'Scripted tutorial fixture completed; no real model or gameplay implementation',
    artifacts: child ? [{ kind: 'file', path: 'docs/AGENT_EXAMPLE.md' }] : [],
    evidence: [{ kind: 'fixture', ref: 'lantern-scripted-provider' }],
    claims: [
      {
        kind: 'generated',
        ref: child ? 'docs/AGENT_EXAMPLE.md' : 'delegated tutorial document in child worktree',
      },
    ],
  };
  if (child) {
    name = stage === 0 ? 'fs/write-file' : 'tasks/complete';
    args =
      stage === 0
        ? {
            path: 'docs/AGENT_EXAMPLE.md',
            content:
              '# Scripted agent example\n\nSynthetic tutorial artifact. R resets the lantern fixture.\n',
          }
        : complete;
  } else if (stage === 0) {
    name = 'tasks/ask_user';
    args = { prompt: 'Tutorial fixture: confirm the reset key', options: ['R'] };
  } else if (stage === 1) {
    name = 'tasks/delegate';
    args = {
      role: 'lantern-writer',
      goal: 'Lantern scripted child: write docs/AGENT_EXAMPLE.md',
      title: 'Write synthetic tutorial artifact',
      touches: [{ resource: 'file:docs/AGENT_EXAMPLE.md', intent: 'write' }],
      isolation: 'worktree',
      contract: { required: ['generated'], validators: [] },
    };
  } else if (stage === 2) {
    name = 'tasks/await';
    const result = body.messages
      .filter((message) => message.role === 'tool')
      .map((message) => {
        try {
          return JSON.parse(message.content);
        } catch {
          return null;
        }
      })
      .find((value) => value?.output?.taskId || value?.taskId);
    args = { taskIds: [result?.output?.taskId ?? result?.taskId], timeoutMs: 60000 };
  } else {
    name = 'tasks/complete';
    args = complete;
  }
  const offered = body.tools.find(
    (tool) =>
      tool.function.name === name || tool.function.description.includes(`Platform tool: ${name}`),
  );
  if (!offered) throw new Error(`Fixture requested an unavailable tool: ${name}`);
  return {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: `fixture-${child ? 'child' : 'parent'}-${stage}`,
        type: 'function',
        function: { name: offered.function.name, arguments: JSON.stringify(args) },
      },
    ],
  };
}
module.exports = { fixtureCompletion };
