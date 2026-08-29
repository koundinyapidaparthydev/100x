/**
 * Production bootstrap: one backend on port 4000 (PORT env override).
 * Set PERSIST=1 to write store.json under ./data (or DATA_DIR).
 * Set DATABASE_URL to load/save a PostgreSQL JSONB snapshot instead.
 * Set OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY for live model runs;
 * JIRA_* for live Jira connector.
 */

import './loadEnv';
import { createApp } from './app';
import { createBoardConnector } from './connectors/board';
import { initializePersistence } from './persist';
import { createModelRunner } from './runners/model';

const port = Number(process.env.PORT ?? 4000);
const { store, persistence } = await initializePersistence();
const modelRunner = createModelRunner();
const boardConnector = createBoardConnector(store);

const app = createApp({ store, modelRunner, boardConnector });

const server = app.listen(port, () => {
  console.log(`[100x-backend] listening on http://localhost:${port} (api: /api/v1)`);
  console.log(
    `[100x-backend] model=${modelRunner.kind} board=${boardConnector.kind} persist=${persistence.kind}`,
  );
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[100x-backend] ${signal} received; draining requests and flushing persistence`);
  server.close(async (err) => {
    try {
      await persistence.close();
      if (err) throw err;
      process.exitCode = 0;
    } catch (closeError) {
      console.error(
        '[100x-backend] graceful shutdown failed:',
        closeError instanceof Error ? closeError.message : closeError,
      );
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
