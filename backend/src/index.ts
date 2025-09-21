import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign } from 'hono/jwt';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { URL } from 'url';

const prisma = new PrismaClient();
const app = new Hono();

const wss = new WebSocketServer({ noServer: true });
const sockets = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, request) => {
  try {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const cameraId = url.searchParams.get('cameraId');

    if (cameraId) {
      if (!sockets.has(cameraId)) {
        sockets.set(cameraId, new Set());
      }
      sockets.get(cameraId)!.add(ws);
      console.log(`WebSocket client subscribed to camera ${cameraId}`);
    } else {
       console.log("WebSocket client connected without a camera ID.");
    }

    ws.on('close', () => {
      if (cameraId) {
        sockets.get(cameraId)?.delete(ws);
        console.log(`WebSocket client unsubscribed from camera ${cameraId}`);
      } else {
        console.log("WebSocket client disconnected.");
      }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

  } catch (err) {
    console.error("Error handling WebSocket connection:", err);
    ws.close();
  }
});

app.use('/api/*', cors({
  origin: ['http://localhost', 'http://localhost:5173'],
  credentials: true,
}));

app.post('/api/register', async (c) => {
    const { username, password } = await c.req.json();
    if (!username || !password) {
        return c.json({ error: 'Username and password are required' }, 400);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const user = await prisma.user.create({
            data: { username, password: hashedPassword },
        });
        return c.json({ message: 'User created', userId: user.id }, 201);
    } catch (e) {
        return c.json({ error: 'Username already exists' }, 409);
    }
});

app.post('/api/login', async (c) => {
    const { username, password } = await c.req.json();
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }
    const payload = { id: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
    const secret = process.env.JWT_SECRET || 'a-default-secret';
    const token = await sign(payload, secret);
    return c.json({ token });
});

app.post('/api/alerts', async (c) => {
  const { cameraId, snapshotUrl } = await c.req.json();
  if (!cameraId) {
      return c.json({ error: "cameraId is required" }, 400);
  }
  try {
      const alert = await prisma.alert.create({
        data: { cameraId: parseInt(cameraId), snapshotUrl },
      });

      const cameraSockets = sockets.get(cameraId.toString());
      if (cameraSockets) {
          const message = JSON.stringify(alert);
          cameraSockets.forEach(socket => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
              }
          });
      }
      return c.json(alert, 201);
  } catch(e) {
      console.error("Error creating alert:", e);
      return c.json({ error: "Failed to create alert" }, 500);
  }
});


const authMiddleware = jwt({ secret: process.env.JWT_SECRET || 'a-default-secret' });
const protectedApi = new Hono().use('/*', authMiddleware);

protectedApi.get('/cameras', async (c) => {
    const payload = c.get('jwtPayload');
     if (!payload || !payload.id) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    const cameras = await prisma.camera.findMany({ where: { ownerId: payload.id as number }, orderBy: {name: 'asc'} });
    return c.json(cameras);
});

protectedApi.post('/cameras', async (c) => {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.id) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    const { name, location, rtspUrl } = await c.req.json();
    const camera = await prisma.camera.create({
        data: { name, location, rtspUrl, ownerId: payload.id as number },
    });
    return c.json(camera, 201);
});

protectedApi.put('/cameras/:id', async (c) => {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.id) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    const cameraId = parseInt(c.req.param('id'));
    const { name, location, rtspUrl, isEnabled } = await c.req.json();
    const camera = await prisma.camera.updateMany({
        where: { id: cameraId, ownerId: payload.id as number },
        data: { name, location, rtspUrl, isEnabled },
    });
    if (camera.count === 0) {
        return c.json({ error: 'Camera not found or access denied' }, 404);
    }
    return c.json({ message: 'Camera updated successfully' });
});

protectedApi.delete('/cameras/:id', async (c) => {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.id) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    const cameraId = parseInt(c.req.param('id'));
    const camera = await prisma.camera.deleteMany({
        where: { id: cameraId, ownerId: payload.id as number },
    });
    if (camera.count === 0) {
        return c.json({ error: 'Camera not found or access denied' }, 404);
    }
    return c.json({ message: 'Camera deleted successfully' });
});

protectedApi.post('/cameras/:id/start', async (c) => {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.id) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    const cameraId = parseInt(c.req.param('id'));
    const camera = await prisma.camera.findFirst({ where: { id: cameraId, ownerId: payload.id as number } });
    if (!camera) return c.json({ error: 'Camera not found or access denied' }, 404);

    try {
        await fetch(`http://worker:8080/start-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cameraId: camera.id.toString(), rtspUrl: camera.rtspUrl }),
        });
        return c.json({ message: 'Stream start request sent' });
    } catch (error) {
        console.error("Failed to contact worker:", error);
        return c.json({ error: 'Failed to contact worker service' }, 500);
    }
});

app.route('/api', protectedApi);

const port = 3000;
const server = serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Backend server running on http://${info.address}:${info.port}`);
});

server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
