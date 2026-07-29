/**
 * Express app factory. Tests call createApp() for a fresh store per suite;
 * src/index.ts is the production bootstrap that listens on PORT.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './routes';
import { createSeedStore, type Store } from './store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src → backend → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function createApp(store: Store = createSeedStore()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1', createRouter(store));

  // Serve built clients only if their dist folders exist (graceful in dev/CI).
  const webDist = path.join(REPO_ROOT, 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
  }
  const mobileDist = path.join(REPO_ROOT, 'mobile', 'dist');
  if (fs.existsSync(mobileDist)) {
    app.use('/mobile', express.static(mobileDist));
  }

  // JSON 404 for anything unmatched (API contract: errors are {error} bodies).
  app.use((req, res) => {
    res.status(404).json({ error: `not found: ${req.method} ${req.path}` });
  });

  // Error middleware — no stack traces or internals leak to clients.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
