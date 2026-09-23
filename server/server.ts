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

  // --- API: User Authentication (Google OAuth & Demo Profiles) ---
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }

      const body = await getJsonBody(req);
      let userId = '';
      let userName = '';
      let userEmail = '';
      let userAvatar = '';
      let userColor = '#2563eb';

      // 1. Check for Google OAuth Credential (JWT)
      if (body.credential) {
        try {
          const parts = body.credential.split('.');
          if (parts.length >= 2) {
            const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
            const googlePayload = JSON.parse(payloadJson);
            userId = googlePayload.sub || `google-${Date.now()}`;
            userName = googlePayload.name || 'Google User';
            userEmail = googlePayload.email || '';
            userAvatar = googlePayload.picture || '';
          }
        } catch (jwtErr) {
          console.error('Failed to parse Google JWT payload:', jwtErr);
        }
      }

      // 2. Check for 1-Click Demo Profile
      if (!userId && body.demoUser) {
        userId = body.demoUser.id || `demo-${body.demoUser.name.toLowerCase().replace(/\s+/g, '-')}`;
        userName = body.demoUser.name || 'Collaborator';
        userEmail = body.demoUser.email || `${userId}@colabdocs.dev`;
        userAvatar = body.demoUser.avatarUrl || '';
        userColor = body.demoUser.color || '#2563eb';
      }

      if (!userId || !userName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid authentication payload' }));
        return;
      }

      // Palette of colors for avatar initials if no avatar URL
      const colors = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626'];
      if (!userColor || userColor === '#2563eb') {
        const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        userColor = colors[hash % colors.length];
      }

      // Upsert into Neon DB users table
      const result = await sql`
        INSERT INTO users (id, name, email, avatar_url, color)
        VALUES (${userId}, ${userName}, ${userEmail}, ${userAvatar || null}, ${userColor})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            email = EXCLUDED.email,
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            color = COALESCE(users.color, EXCLUDED.color)
        RETURNING id, name, email, avatar_url, color, created_at
      `;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: result[0], token: `session-${userId}` }));
    } catch (err: any) {
      console.error('Error during authentication:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: List all documents ---
  if (pathname === '/api/documents' && req.method === 'GET') {
    try {
      if (!sql) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not configured' }));
        return;
      }

      const userId = url.searchParams.get('userId');
      let docs;
      if (userId) {
        docs = await sql`
          SELECT id, title, view_token, owner_id, owner_name, owner_email, created_at, updated_at 
          FROM documents 
          WHERE owner_id = ${userId} OR owner_id IS NULL
          ORDER BY updated_at DESC
        `;
      } else {
        docs = await sql`
          SELECT id, title, view_token, owner_id, owner_name, owner_email, created_at, updated_at 
          FROM documents 
          ORDER BY updated_at DESC
        `;
      }

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
        SELECT id, title, view_token, owner_id, owner_name, owner_email, created_at, updated_at
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
          ownerId: doc.owner_id,
          ownerName: doc.owner_name,
          ownerEmail: doc.owner_email,
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
      const { id, title, ownerId, ownerName, ownerEmail } = await getJsonBody(req);
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document ID is required' }));
        return;
      }

      const docTitle = title || 'Untitled document';
      const generatedViewToken = 'view-' + crypto.randomBytes(8).toString('hex');

      const result = await sql`
        INSERT INTO documents (id, title, view_token, owner_id, owner_name, owner_email, updated_at)
        VALUES (${id}, ${docTitle}, ${generatedViewToken}, ${ownerId || null}, ${ownerName || null}, ${ownerEmail || null}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE 
        SET title = EXCLUDED.title,
            view_token = COALESCE(documents.view_token, EXCLUDED.view_token),
            owner_id = COALESCE(documents.owner_id, EXCLUDED.owner_id),
            owner_name = COALESCE(documents.owner_name, EXCLUDED.owner_name),
            owner_email = COALESCE(documents.owner_email, EXCLUDED.owner_email),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, title, view_token, owner_id, owner_name, owner_email, created_at, updated_at
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
