import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { attachRealtime } from './src/lib/realtime/server';
import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from './src/lib/realtime/events';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }
  handle(req, res, parse(req.url || '/', true));
});

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  path: SOCKET_PATH,
  transports: ['websocket', 'polling'],
  pingInterval: 20_000,
  pingTimeout: 25_000,
});

attachRealtime(io);

httpServer.listen(port, hostname, () => {
  console.log(`▲ Agnos intake ready on http://${hostname}:${port} (${dev ? 'development' : 'production'})`);
  console.log(`  socket.io mounted at ${SOCKET_PATH}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    io.close();
    httpServer.close(() => process.exit(0));
  });
}
