import { definePlugin, PluginSdkError } from '@gamecrafter/plugin-sdk';

let greetingPrefix = 'Hello';

void definePlugin({
  tools: {
    'sample-hello/greet': {
      async handler(input, host) {
        const parameters = asRecord(input);
        const name = typeof parameters.name === 'string' ? parameters.name : 'there';
        const output: {
          greeting: string;
          readContent?: string;
          readErrorCode?: number;
          secretValue?: string;
          secretFound?: boolean;
          secretErrorCode?: number;
        } = { greeting: `${greetingPrefix}, ${name}!` };
        if (typeof parameters.readPath === 'string') {
          try {
            const result = await host.callTool('fs/read-file', { path: parameters.readPath });
            if (
              isRecord(result) &&
              isRecord(result.output) &&
              typeof result.output.content === 'string'
            ) {
              output.readContent = result.output.content;
            }
          } catch (error) {
            output.readErrorCode = error instanceof PluginSdkError ? error.code : -32603;
          }
        }
        if (typeof parameters.secretName === 'string') {
          try {
            const secret = await host.getSecret(parameters.secretName);
            output.secretFound = typeof secret === 'string';
            if (typeof secret === 'string') {
              output.secretValue = secret;
              await host.log('info', `Retrieved plugin secret: ${secret}`);
            }
          } catch (error) {
            output.secretErrorCode = error instanceof PluginSdkError ? error.code : -32603;
          }
        }
        return {
          output,
          evidence: [{ kind: 'plugin', ref: 'sample-hello/greet' }],
        };
      },
    },
  },
  onSettingsChanged(settings) {
    if (typeof settings['plugin.sample-hello.greetingPrefix'] === 'string') {
      greetingPrefix = settings['plugin.sample-hello.greetingPrefix'];
    }
  },
})
  .run()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
