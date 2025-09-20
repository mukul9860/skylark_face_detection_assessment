import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import { upgradeWebSocket } from 'hono/ws';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const app = new Hono();

// WebSocket connections store
// In a real production app, you'd use Redis or another shared store
const sockets = new Map<string, Set<any>>(); // Key: cameraId, Value: Set of WebSocket clients

// --- MIDDLEWARE ---
// Add CORS middleware to allow requests from our frontend
app.use('*', cors({
  origin: 'http://localhost', // The port your frontend runs on
  credentials: true,
}));

// JWT Middleware for protecting routes
const authMiddleware = jwt({
  secret: process.env.JWT_SECRET || 'a-default-secret',
});

// --- AUTHENTICATION ROUTES ---
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

// --- PROTECTED ROUTES ---
// Group for all routes that require authentication
const protectedApi = app.use('/api/*', authMiddleware);

// --- CAMERA MANAGEMENT (CRUD) ---
protectedApi.get('/api/cameras', async (c) => {
    const payload = c.get('jwtPayload');
    const cameras = await prisma.camera.findMany({
        where: { ownerId: payload.id },
        orderBy: { name: 'asc' },
    });
    return c.json(cameras);
});

protectedApi.post('/api/cameras', async (c) => {
    const payload = c.get('jwtPayload');
    const { name, location, rtspUrl } = await c.req.json();
    const camera = await prisma.camera.create({
        data: { name, location, rtspUrl, ownerId: payload.id },
    });
    return c.json(camera, 201);
});

// Start/Stop Camera Processing by calling the worker
protectedApi.post('/api/cameras/:id/start', async (c) => {
    const payload = c.get('jwtPayload');
    const cameraId = parseInt(c.req.param('id'));
    const camera = await prisma.camera.findFirst({ where: { id: cameraId, ownerId: payload.id } });
    if (!camera) return c.json({ error: 'Camera not found or access denied' }, 404);
    
    // Send request to the Go worker
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

// ... Implement Update, Delete, and Stop endpoints similarly ...

// --- ALERT MANAGEMENT ---
// Endpoint for the WORKER to post alerts to
app.post('/api/alerts', async (c) => {
  const { cameraId, snapshotUrl } = await c.req.json();
  const alert = await prisma.alert.create({
    data: { cameraId: parseInt(cameraId), snapshotUrl },
  });

  // Notify subscribed frontend clients via WebSocket
  const cameraSockets = sockets.get(cameraId.toString());
  if (cameraSockets) {
      cameraSockets.forEach(ws => {
          ws.send(JSON.stringify(alert));
      });
  }

  return c.json(alert, 201);
});

// Endpoint for the FRONTEND to fetch historical alerts
protectedApi.get('/api/alerts/camera/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const cameraId = parseInt(c.req.param('id'));
    // Ensure user owns this camera before fetching alerts
    const camera = await prisma.camera.findFirst({ where: { id: cameraId, ownerId: payload.id } });
    if (!camera) return c.json({ error: 'Camera not found or access denied' }, 404);

    const alerts = await prisma.alert.findMany({
        where: { cameraId: cameraId },
        orderBy: { timestamp: 'desc' },
        take: 20, // Example of pagination
    });
    return c.json(alerts);
});


// --- REAL-TIME WEBSOCKET ---
app.get('/ws', upgradeWebSocket(c => {
    return {
        onMessage: (evt, ws) => {
            try {
                const data = JSON.parse(evt.data as string);
                // Client subscribes to a camera feed
                if (data.type === 'subscribe' && data.cameraId) {
                    const cameraId = data.cameraId.toString();
                    if (!sockets.has(cameraId)) {
                        sockets.set(cameraId, new Set());
                    }
                    sockets.get(cameraId)!.add(ws);
                    console.log(`Client subscribed to camera ${cameraId}`);
                }
            } catch (e) {
                console.error("WS message error:", e);
            }
        },
        onClose: (evt, ws) => {
            // Remove client from all subscriptions
            sockets.forEach((socketSet, cameraId) => {
                if (socketSet.has(ws)) {
                    socketSet.delete(ws);
                    console.log(`Client unsubscribed from camera ${cameraId}`);
                }
            });
        },
    };
}));


const port = 3000;
console.log(`Backend server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});