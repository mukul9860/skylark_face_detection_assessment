import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const app = new Hono();

app.post('/register', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    });
    return c.json({ message: 'User created successfully', userId: user.id }, 201);
  } catch (e) {
    return c.json({ error: 'Username already exists' }, 409);
  }
});

app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  const payload = { id: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }; // 24hr expiry
  const secret = process.env.JWT_SECRET || 'a-default-secret';
  const token = await sign(payload, secret);
  return c.json({ token });
});

// Auth Middleware (To be added for protected routes)

// --- CAMERA MANAGEMENT  ---
// We would add CRUD operations here, protected by JWT middleware

// ... (GET /cameras, POST /cameras, etc.)

// --- ALERTS / EVENTS ---
// This endpoint is for the Go worker to post alerts TO
app.post('/alerts', async (c) => {
  const { cameraId, snapshotUrl } = await c.req.json();
  const alert = await prisma.alert.create({
    data: {
      cameraId: parseInt(cameraId),
      snapshotUrl: snapshotUrl,
    },
  });

  console.log(`New alert for camera ${cameraId} saved.`);
  return c.json(alert, 201);
});


const port = 3000;
console.log(`Backend server running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});