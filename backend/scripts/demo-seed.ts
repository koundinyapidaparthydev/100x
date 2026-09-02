/**
 * Write the Code MVP demo tenant / manager / tickets to the persist file.
 * Usage: PERSIST=1 npm run demo:seed
 */
import '../src/loadEnv';
import { applyDemoSeed, DEMO_MANAGER_EMAIL, hasDemoSeed } from '../src/demoSeed';
import { loadOrCreateStore, resolveDataPath, saveStore } from '../src/persist';

if (process.env.PERSIST !== '1' && !process.env.DATA_DIR) {
  process.env.PERSIST = '1';
}

const store = loadOrCreateStore();
const meta = applyDemoSeed(store);
saveStore(store);

const file = resolveDataPath();
console.log(`[demo:seed] tenant=${meta.tenantId} manager=${DEMO_MANAGER_EMAIL}`);
console.log(`[demo:seed] tickets A=${meta.tickets.a} B=${meta.tickets.b} C=${meta.tickets.c}`);
console.log(`[demo:seed] persisted=${hasDemoSeed(store)} path=${file ?? '(memory)'}`);
