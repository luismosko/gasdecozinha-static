/**
 * _worker.js — Cloudflare Pages Functions
 * 
 * Redireciona pastas do WordPress para o servidor original
 * Mantém o restante servido pelo Pages (site estático)
 */

// Servidor WordPress (registro DNS 'origin' aponta para o IP do cPanel)
const WP_ORIGIN = 'origin.gasdecozinha.com';
const WP_DOMAIN = 'gasdecozinha.com';

// Pastas que devem ir para o WordPress
const WP_PATHS = [
  '/demo-ultragaz',
  '/teste',
  '/autonomista', 
  '/caranda',
  '/chacara-cachoeira',
  '/coronel-antonino',
  '/wp-admin',
  '/wp-login',
  '/wp-content',
  '/wp-includes',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // DEBUG MODE - acesse /debug-worker para ver status
    if (path === '/debug-worker') {
      const testUrl = `http://${WP_ORIGIN}/demo-ultragaz/`;
      let testResult = '';
      
      try {
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Host': WP_DOMAIN,
            'User-Agent': 'CloudflareWorker/1.0',
          },
          redirect: 'manual',
        });
        testResult = `Status: ${testResponse.status} ${testResponse.statusText}\nHeaders: ${JSON.stringify(Object.fromEntries(testResponse.headers), null, 2)}`;
      } catch (error) {
        testResult = `Error: ${error.message}`;
      }
      
      return new Response(`
Worker Debug Info
=================
WP_ORIGIN: ${WP_ORIGIN}
WP_DOMAIN: ${WP_DOMAIN}
Test URL: ${testUrl}

Test Result:
${testResult}
      `, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    
    // Verifica se deve ir para WordPress
    const isWordPress = WP_PATHS.some(wp => 
      path === wp || 
      path.startsWith(wp + '/') ||
      path.endsWith('.php')
    );
    
    if (isWordPress) {
      // Monta URL para o servidor WordPress
      const wpUrl = `http://${WP_ORIGIN}${path}${url.search}`;
      
      try {
        const response = await fetch(wpUrl, {
          method: request.method,
          headers: {
            'Host': WP_DOMAIN,
            'X-Forwarded-Host': WP_DOMAIN,
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
            'User-Agent': request.headers.get('User-Agent') || '',
            'Accept': request.headers.get('Accept') || '*/*',
            'Accept-Language': request.headers.get('Accept-Language') || '',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: request.method !== 'GET' && request.method !== 'HEAD' 
            ? request.body 
            : undefined,
          redirect: 'manual',
        });
        
        // Copia headers da resposta
        const newHeaders = new Headers(response.headers);
        newHeaders.delete('content-encoding');
        
        // Corrige redirects para manter no domínio correto
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('Location');
          if (location) {
            const newLocation = location
              .replace(`http://${WP_ORIGIN}`, `https://${WP_DOMAIN}`)
              .replace(`https://${WP_ORIGIN}`, `https://${WP_DOMAIN}`);
            newHeaders.set('Location', newLocation);
          }
        }
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (error) {
        return new Response(`Erro ao conectar com WordPress: ${error.message}`, { 
          status: 502,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    // Serve do Pages (site estático)
    return env.ASSETS.fetch(request);
  }
};
