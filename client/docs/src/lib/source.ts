import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docs } from 'collections/server';
import { docsContentRoute, docsRoute } from './shared';

const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [lucideIconsPlugin()],
});

export const llmSource = loader({
  source: docs.toFumadocsSource(),
  baseUrl: `${basePath}${docsRoute}`,
  plugins: [lucideIconsPlugin()],
});

export function getPageMarkdownUrl(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `${basePath}${docsContentRoute}/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');
  const pageUrl = basePath && page.url.startsWith(basePath) ? page.url : `${basePath}${page.url}`;

  return `# ${page.data.title} (${pageUrl})

${processed}`;
}
