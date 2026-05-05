import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFound } from '@/components/not-found';

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
    
    if (base && (url.startsWith('/__tsr/') || url.includes('//' + window.location.host + '/__tsr/'))) {
      if (typeof input === 'string') {
        input = `${base}${input}`;
      } else if (input instanceof Request) {
        const newUrl = url.startsWith('/__tsr/') 
          ? `${base}${url}` 
          : url.replace('/__tsr/', `${base}/__tsr/`);
        input = new Request(newUrl, input);
      }
    }
    return originalFetch(input, init);
  }) as any;
}


export function getRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    basepath: import.meta.env.BASE_URL?.replace(/\/$/, '') || '/',
  });
}
