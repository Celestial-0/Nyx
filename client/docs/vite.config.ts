import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Enumerate all .mdx/.md files under content/ to derive static prerender paths.
// This is required so TanStack Start bakes server function results into static
// JSON files for every doc route — otherwise client-side navigation hits
// /_serverFn/* which GitHub Pages serves as HTML (404 fallback), breaking the app.
function getDocPages(dir: string, prefix = ''): Array<{ path: string }> {
  const pages: Array<{ path: string }> = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return pages;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      pages.push(...getDocPages(full, `${prefix}/${entry}`));
    } else if (/\.(mdx|md)$/.test(entry)) {
      const slug = entry.replace(/\.(mdx|md)$/, '');
      // index.mdx → root of that directory segment
      const pagePath = slug === 'index' ? (prefix || '/') : `${prefix}/${slug}`;
      pages.push({ path: pagePath });
    }
  }
  return pages;
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const contentDir = resolve(__dirname, 'content');
const docPages = getDocPages(contentDir);

export default defineConfig({
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/',
  server: {
    port: 3000,
  },
  plugins: [
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          enabled: true,
          crawlLinks: true,
        },
      },

      pages: [
        { path: '/' },
        { path: '/api/search' },
        { path: 'llms-full.txt' },
        { path: 'llms.txt' },
        // Prerender every doc page so staticFunctionMiddleware pre-bakes server
        // function responses as static JSON files (fetched instead of hitting the server).
        ...docPages,
      ],
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
});
