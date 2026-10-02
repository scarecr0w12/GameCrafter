/** A frontend RPC proxy can reject after the renderer disconnects, despite a void interface. */
export function deliverClientNotification(deliver: () => unknown): void {
  try {
    void Promise.resolve(deliver()).catch(() => {
      // The renderer is gone. Its replacement obtains a fresh service snapshot on connection.
    });
  } catch {
    // Synchronous delivery failure has the same disconnected-client semantics.
  }
}
