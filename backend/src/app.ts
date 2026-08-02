/**
 * Express app factory. Tests call createApp() for a fresh store per suite;
 * src/index.ts is the production bootstrap that listens on PORT.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachAuth } from './auth';
import { createBoardConnector, type BoardConnector } from './connectors/board';
import type { OrchestratorDeps } from './orchestrator';
import { createRouter } from './routes';
import { createModelRunner, type ModelRunner } from './runners/model';
import { createSeedStore, type Store } from './store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export interface AppOptions {
  store?: Store;
  modelRunner?: ModelRunner;
  boardConnector?: BoardConnector;
}

export function createApp(options: AppOptions | Store = {}): Express {
  // Back-compat: createApp(store) used by tests.
  const opts: AppOptions =
    options && 'workItems' in (options as Store) ? { store: options as Store } : (options as AppOptions);

  const store = opts.store ?? createSeedStore();
  const modelRunner = opts.modelRunner ?? createModelRunner();
  const boardConnector = opts.boardConnector ?? createBoardConnector(store);
  const deps: OrchestratorDeps = { modelRunner, boardConnector };

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(attachAuth);

  app.use('/api/v1', createRouter(store, deps));

  const webDist = path.join(REPO_ROOT, 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
  }
  const mobileDist = path.join(REPO_ROOT, 'mobile', 'dist');
  if (fs.existsSync(mobileDist)) {
    app.use('/mobile', express.static(mobileDist));
  }

  app.use((req, res) => {
    res.status(404).json({ error: `not found: ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
    console.error('[aplifyai-backend] request error:', err.message);
    res.status(500).json({
      error:
        process.env.NODE_ENV !== 'production' && err.message
          ? err.message
          : 'internal server error',
    });
  });

  return app;
}
