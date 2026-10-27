async function startServer() {
  const { createServer } = await import("node:http");
  const { default: next } = await import("next");

  const port = parseInt(process.env.PORT, 10) || 3000;
  const app = next({ dev: false });
  const handle = app.getRequestHandler();

  await app.prepare();
  createServer((req, res) => {
    handle(req, res);
  }).listen(port);
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
