import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { createCorsOptions, parseCorsOrigins } from '../src/cors-policy.js';

async function withServer<T>(run: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(cors(createCorsOptions(['https://app.example'])));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.post('/bookings', (_req, res) => res.status(201).json({ ok: true }));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ error: error.message }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  try { return await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('allows native requests without an Origin header', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('allows an explicitly configured browser origin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://app.example' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.example');
  });
});

test('rejects an unknown browser origin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://unknown.example' } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('allows any browser origin when wildcard is configured for development', async () => {
  const app = express();
  app.use(cors(createCorsOptions(['*'])));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`, { headers: { Origin: 'http://localhost:8081' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('handles allowed preflight OPTIONS requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bookings`, { method: 'OPTIONS', headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, authorization' } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.example');
    assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  });
});

test('allows missing CORS_ORIGIN in production but rejects wildcard production configuration', () => {
  assert.deepEqual(parseCorsOrigins(undefined, true), []);
  assert.throws(() => parseCorsOrigins('*', true), /must not contain \* in production/);
  assert.deepEqual(parseCorsOrigins('https://app.example', true), ['https://app.example']);
});
