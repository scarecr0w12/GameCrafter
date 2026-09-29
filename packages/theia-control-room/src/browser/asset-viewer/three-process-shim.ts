const browserGlobal = globalThis as unknown as {
  process?: { emitWarning?: (...args: unknown[]) => void };
};
browserGlobal.process ??= {};
browserGlobal.process.emitWarning ??= () => undefined;
