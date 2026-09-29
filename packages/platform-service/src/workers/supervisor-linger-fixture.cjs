let keepAlive;

process.once('SIGTERM', () => {
  if (keepAlive) clearInterval(keepAlive);
  process.exit(0);
});

exports.linger = async () => {
  keepAlive = setInterval(() => {}, 60_000);
  return { completed: true };
};
