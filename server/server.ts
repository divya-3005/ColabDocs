import http from 'http';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
// @ts-ignore - y-websocket provides utils in bin/utils
import { setupWSConnection } from 'y-websocket/bin/utils';
import { initDb, sql } from './db';

const PORT = process.env.PORT || 1234;

// Helper to parse JSON request bodies
const getJsonBody = (req: http.IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
};

// 1. Create HTTP Server with CORS & Document REST API
const server = http.createServer(async (req, res) => {
  // Global CORS Headers for frontend Vite client (localhost:5173)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // --- API: List all documents ---
  if (pathname === '/api/documents' && req.method === 'GET') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }
      const docs = await sql`
        SELECT id, title, view_token, created_at, updated_at 
        FROM documents 
        ORDER BY updated_at DESC
      `;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(docs));
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Resolve Document by ID or Capability view_token ---
  if (pathname.startsWith('/api/documents/resolve/') && req.method === 'GET') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }
      const key = pathname.replace('/api/documents/resolve/', '');
      const results = await sql`
        SELECT id, title, view_token, created_at, updated_at
        FROM documents
        WHERE id = ${key} OR view_token = ${key}
        LIMIT 1
      `;

      if (results.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document not found' }));
        return;
      }

      const doc = results[0];
      if (!doc.view_token) {
        const generatedViewToken = 'view-' + crypto.randomBytes(8).toString('hex');
        await sql`UPDATE documents SET view_token = ${generatedViewToken} WHERE id = ${doc.id}`;
        doc.view_token = generatedViewToken;
      }
      const isViewerToken = doc.view_token === key;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          docId: doc.id,
          title: doc.title,
          viewToken: doc.view_token,
          role: isViewerToken ? 'viewer' : 'editor',
        })
      );
    } catch (err: any) {
      console.error('Error resolving document capability:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Create or Upsert a document ---
  if (pathname === '/api/documents' && req.method === 'POST') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }
      const { id, title } = await getJsonBody(req);
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document ID is required' }));
        return;
      }

      const docTitle = title || 'Untitled document';
      const generatedViewToken = 'view-' + crypto.randomBytes(8).toString('hex');

      const result = await sql`
        INSERT INTO documents (id, title, view_token, updated_at)
        VALUES (${id}, ${docTitle}, ${generatedViewToken}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE 
        SET title = EXCLUDED.title,
            view_token = COALESCE(documents.view_token, EXCLUDED.view_token),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, title, view_token, created_at, updated_at
      `;

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result[0]));
    } catch (err: any) {
      console.error('Error creating document:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Update document title ---
  if (pathname.startsWith('/api/documents/') && (req.method === 'PUT' || req.method === 'PATCH')) {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }
      const id = pathname.replace('/api/documents/', '');
      const { title } = await getJsonBody(req);

      const result = await sql`
        UPDATE documents 
        SET title = ${title || 'Untitled document'}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING id, title, view_token, created_at, updated_at
      `;

      if (result.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result[0]));
    } catch (err: any) {
      console.error('Error updating document:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Delete document ---
  if (pathname.startsWith('/api/documents/') && req.method === 'DELETE') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }
      const id = pathname.replace('/api/documents/', '');
      await sql`DELETE FROM documents WHERE id = ${id}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: id }));
    } catch (err: any) {
      console.error('Error deleting document:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Fallback health check
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ColabDocs Collaboration & Database Server is running!\n');
});

// 2. Attach WebSocketServer for real-time CRDT sync
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

// 3. Initialize DB and listen
server.listen(PORT, async () => {
  console.log(`🚀 ColabDocs server is running on port ${PORT}`);
  await initDb();
});
