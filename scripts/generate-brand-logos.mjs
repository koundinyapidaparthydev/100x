#!/usr/bin/env node
/**
 * Regenerates web/public/brands/*.svg from recognizable brand mark sources
 * (Iconify Logos / Simple Icons / VectorLogo Zone).
 *
 * Run: node scripts/generate-brand-logos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../web/public/brands');

/** @type {Record<string, { url: string, hex?: string, label: string }>} */
const SOURCES = {
  apple: { label: 'Apple', url: 'https://api.iconify.design/logos:apple.svg' },
  asana: { label: 'Asana', url: 'https://api.iconify.design/logos:asana-icon.svg' },
  aws: { label: 'AWS', url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/amazonaws.svg', hex: 'FF9900' },
  aws_codecommit: {
    label: 'AWS CodeCommit',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/amazonaws.svg',
    hex: 'FF9900',
  },
  azure: { label: 'Microsoft Azure', url: 'https://api.iconify.design/logos:microsoft-azure.svg' },
  azure_ad: { label: 'Microsoft Entra ID', url: 'https://api.iconify.design/selfhst:microsoft-entra-id.svg' },
  azure_devops: {
    label: 'Azure DevOps',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/azuredevops.svg',
    hex: '0078D7',
  },
  azure_repos: {
    label: 'Azure Repos',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/azuredevops.svg',
    hex: '0078D7',
  },
  bitbucket: { label: 'Bitbucket', url: 'https://api.iconify.design/logos:bitbucket.svg' },
  chatgpt: { label: 'ChatGPT', url: 'https://api.iconify.design/selfhst:chatgpt.svg' },
  claude_code: { label: 'Claude Code', url: 'https://api.iconify.design/simple-icons:claudecode.svg', hex: 'D97757' },
  clickup: { label: 'ClickUp', url: 'https://api.iconify.design/simple-icons:clickup.svg', hex: '7B68EE' },
  codex: {
    label: 'OpenAI Codex',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/openai.svg',
    hex: '412991',
  },
  confluence: { label: 'Confluence', url: 'https://api.iconify.design/logos:confluence.svg' },
  cursor: { label: 'Cursor', url: 'https://api.iconify.design/simple-icons:cursor.svg', hex: '000000' },
  discord: { label: 'Discord', url: 'https://api.iconify.design/logos:discord-icon.svg' },
  gcp: { label: 'Google Cloud', url: 'https://api.iconify.design/logos:google-cloud.svg' },
  gerrit: { label: 'Gerrit', url: 'https://api.iconify.design/simple-icons:gerrit.svg', hex: '455A64' },
  gitea: { label: 'Gitea', url: 'https://api.iconify.design/simple-icons:gitea.svg', hex: '609926' },
  github: { label: 'GitHub', url: 'https://api.iconify.design/logos:github-icon.svg' },
  github_enterprise: { label: 'GitHub Enterprise', url: 'https://api.iconify.design/logos:github-icon.svg' },
  github_projects: { label: 'GitHub Projects', url: 'https://api.iconify.design/logos:github-icon.svg' },
  gitlab: { label: 'GitLab', url: 'https://api.iconify.design/logos:gitlab.svg' },
  gitlab_boards: { label: 'GitLab Boards', url: 'https://api.iconify.design/logos:gitlab.svg' },
  gitlab_self_managed: { label: 'GitLab Self-Managed', url: 'https://api.iconify.design/logos:gitlab.svg' },
  gmail: { label: 'Gmail', url: 'https://api.iconify.design/logos:google-gmail.svg' },
  google_chat: { label: 'Google Chat', url: 'https://api.iconify.design/simple-icons:googlechat.svg', hex: '00AC47' },
  google_drive: { label: 'Google Drive', url: 'https://api.iconify.design/logos:google-drive.svg' },
  google_workspace: { label: 'Google Workspace', url: 'https://api.iconify.design/logos:google-icon.svg' },
  jira: { label: 'Jira', url: 'https://api.iconify.design/logos:jira.svg' },
  linear: { label: 'Linear', url: 'https://api.iconify.design/logos:linear-icon.svg' },
  mattermost: { label: 'Mattermost', url: 'https://api.iconify.design/simple-icons:mattermost.svg', hex: '0058CC' },
  monday: { label: 'monday.com', url: 'https://api.iconify.design/logos:monday-icon.svg' },
  notion: { label: 'Notion', url: 'https://api.iconify.design/logos:notion-icon.svg' },
  nvidia: { label: 'NVIDIA', url: 'https://api.iconify.design/logos:nvidia.svg' },
  okta: { label: 'Okta', url: 'https://api.iconify.design/logos:okta.svg' },
  outlook: {
    label: 'Outlook',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/microsoftoutlook.svg',
    hex: '0078D4',
  },
  perforce: { label: 'Perforce', url: 'https://api.iconify.design/simple-icons:perforce.svg', hex: '404040' },
  planview: {
    label: 'Planview',
    // No reliable public SVG in common kits — generated locally in generateOne().
    url: 'local:planview',
  },
  rally: {
    label: 'Rally',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/broadcom.svg',
    hex: 'E31837',
  },
  ringcentral: {
    label: 'RingCentral',
    url: 'https://www.vectorlogo.zone/logos/ringcentral/ringcentral-icon.svg',
  },
  rocket_chat: {
    label: 'Rocket.Chat',
    url: 'https://api.iconify.design/simple-icons:rocketdotchat.svg',
    hex: 'F5455C',
  },
  servicenow: {
    label: 'ServiceNow',
    url: 'https://www.vectorlogo.zone/logos/servicenow/servicenow-icon.svg',
  },
  sharepoint: {
    label: 'SharePoint',
    url: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/microsoftsharepoint.svg',
    hex: '038387',
  },
  shortcut: { label: 'Shortcut', url: 'https://api.iconify.design/simple-icons:shortcut.svg', hex: '58B1E8' },
  slack: { label: 'Slack', url: 'https://api.iconify.design/logos:slack-icon.svg' },
  smartsheet: {
    label: 'Smartsheet',
    url: 'https://www.vectorlogo.zone/logos/smartsheet/smartsheet-icon.svg',
  },
  teams: { label: 'Microsoft Teams', url: 'https://api.iconify.design/logos:microsoft-teams.svg' },
  telegram: { label: 'Telegram', url: 'https://api.iconify.design/logos:telegram.svg' },
  trello: { label: 'Trello', url: 'https://api.iconify.design/logos:trello.svg' },
  webex: { label: 'Webex', url: 'https://api.iconify.design/simple-icons:webex.svg', hex: '000000' },
  whatsapp: { label: 'WhatsApp', url: 'https://api.iconify.design/logos:whatsapp-icon.svg' },
  wrike: { label: 'Wrike', url: 'https://cdn.worldvectorlogo.com/logos/wrike.svg' },
  zoom_chat: { label: 'Zoom', url: 'https://api.iconify.design/simple-icons:zoom.svg', hex: '0B5CFF' },
};

function localPlanviewSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Planview">
  <rect width="64" height="64" rx="12" fill="#fff"/>
  <g transform="translate(12 14)">
    <rect x="0" y="0" width="10" height="36" rx="2" fill="#0B5CAB"/>
    <rect x="14" y="8" width="10" height="28" rx="2" fill="#2E9BDB"/>
    <rect x="28" y="16" width="10" height="20" rx="2" fill="#6EC6F0"/>
  </g>
</svg>`;
}

async function fetchText(url) {
  if (url.startsWith('local:')) {
    if (url === 'local:planview') return localPlanviewSvg();
    throw new Error(`Unknown local source ${url}`);
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (text.length < 40 || (text.includes('404') && text.length < 200)) {
    throw new Error(`Empty/404 body for ${url}`);
  }
  // vectorlogo 404 pages are HTML ~4k
  if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
    throw new Error(`HTML response for ${url}`);
  }
  return text;
}

function extractInnerSvg(svg) {
  const viewBoxMatch =
    svg.match(/viewBox=["']([^"']+)["']/) || svg.match(/viewbox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch?.[1] ?? '0 0 24 24';

  // Strip outer <svg ...> ... </svg>
  const openEnd = svg.indexOf('>');
  const close = svg.lastIndexOf('</svg>');
  if (openEnd < 0 || close < 0) throw new Error('Invalid SVG');
  let inner = svg.slice(openEnd + 1, close).trim();

  // Drop titles / desc for compact badges
  inner = inner.replace(/<title[\s\S]*?<\/title>/gi, '').replace(/<desc[\s\S]*?<\/desc>/gi, '');

  return { viewBox, inner };
}

function colorizeMonochrome(inner, hex) {
  if (!hex) return inner;
  // Replace currentColor and bare fills that are black/default
  let out = inner.replace(/fill="currentColor"/gi, `fill="#${hex}"`);
  out = out.replace(/fill='currentColor'/gi, `fill="#${hex}"`);
  // If still no fill attributes on paths, add fill to path/g root-ish nodes without fill
  if (!/fill=/.test(out)) {
    out = out.replace(/<(path|polygon|circle|rect)(\s)/gi, `<$1 fill="#${hex}"$2`);
  }
  return out;
}

function wrapBadge({ label, viewBox, inner, bg = '#FFFFFF' }) {
  // Nested svg with preserveAspectRatio so marks stay proportional inside the badge.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}">
  <rect width="64" height="64" rx="12" fill="${bg}"/>
  <svg x="10" y="10" width="44" height="44" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
${inner}
  </svg>
</svg>
`;
}

async function generateOne(id, source) {
  const url = source.url;
  const hex = source.hex;
  if (url === 'local:planview') {
    fs.writeFileSync(path.join(OUT_DIR, `${id}.svg`), localPlanviewSvg());
    return url;
  }

  const body = await fetchText(url);
  const { viewBox, inner: rawInner } = extractInnerSvg(body);
  const inner = colorizeMonochrome(rawInner, hex);
  // Dark marks (Cursor, Apple, GitHub monochrome) get light badge; otherwise white.
  const bg = hex === '000000' ? '#F4F4F5' : '#FFFFFF';
  const out = wrapBadge({ label: source.label, viewBox, inner, bg });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.svg`), out);
  return url;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries = Object.entries(SOURCES);
  const results = [];
  for (const [id, source] of entries) {
    try {
      const from = await generateOne(id, source);
      results.push({ id, ok: true, from });
      process.stdout.write(`✓ ${id}\n`);
    } catch (e) {
      results.push({ id, ok: false, error: String(e.message || e) });
      process.stderr.write(`✗ ${id}: ${e.message || e}\n`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nDone: ${results.length - failed.length}/${results.length} logos written to ${OUT_DIR}`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.id).join(', '));
    process.exitCode = 1;
  }
}

await main();
