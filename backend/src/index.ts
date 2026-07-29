/**
 * Production bootstrap: one backend on port 4000 (PORT env override).
 */

import { createApp } from './app';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`[offshorehelper-backend] listening on http://localhost:${port} (api: /api/v1)`);
});
