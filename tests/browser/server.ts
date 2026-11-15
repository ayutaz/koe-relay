import { createServer, preview } from 'vite';

export default async function setup() {
  // Own the server in-process so teardown also works in restricted Windows sessions.
  const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
  const dev = await createServer({ server: { host: '127.0.0.1', port: 4174, strictPort: true } });
  await dev.listen();
  return async () => {
    await dev.close();
    server.httpServer.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  };
}
