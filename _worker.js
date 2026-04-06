/**
 * _worker.js — Cloudflare Pages Functions
 * 
 * Redireciona pastas do WordPress para o servidor original
 * Mantém o restante servido pelo Pages (site estático)
 */

// Servidor WordPress original
const WP_ORIGIN = 'srv150.prodns.com.br';

// Pastas que devem ir para o WordPress
const WP_PATHS = [
  '/demo-ultragaz',
  '/teste',
  '/autonomista', 
  '/caranda',
  '/chacara-cachoeira',
  '/coronel-antonino',
  '/wp-admin',
  '/wp-login.php',
  '/wp-content',
  '/wp-includes',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Verifica se deve ir para WordPress
    const isWordPress = WP_PATHS.some(wp => 
      path === wp || 
      path.startsWith(wp + '/') ||
      path.endsWith('.php')
    );
    
    if (isWordPress) {
      // Proxy para WordPress
      const wpUrl = `https://${WP_ORIGIN}${path}${url.search}`;
      
      const response = await fetch(wpUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Host': 'gasdecozinha.com',
          'X-Forwarded-Host': 'gasdecozinha.com',
          'X-Forwarded-Proto': 'https',
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? request.body 
          : undefined,
      });
      
      // Retorna resposta do WordPress
      const newHeaders = new Headers(response.headers);
      newHeaders.delete('content-encoding'); // Evita problemas de compressão
      
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }
    
    // Serve do Pages (site estático)
    return env.ASSETS.fetch(request);
  }
};
