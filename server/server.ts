import http from 'http';
import { WebSocketServer } from 'ws';
// @ts-ignore - y-websocket provides utils in bin/utils
import { setupWSConnection } from 'y-websocket/bin/utils';

const PORT = process.env.PORT || 1234;

// 1. Create a basic HTTP server (handy for health checks)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ColabDocs Collaboration Server is running!\n');
});

// 2. Attach WebSocketServer to the HTTP server
const wss = new WebSocketServer({ server });

// 3. Whenever a user connects, hand them over to setupWSConnection
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

// 4. Start listening on our port
server.listen(PORT, () => {
  console.log(`🚀 ColabDocs server is running on port ${PORT}`);
});

