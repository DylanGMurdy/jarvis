export function validateApiSecret(request: Request): boolean {
  const secret = request.headers.get('x-jarvis-secret');
  return secret === process.env.JARVIS_API_SECRET;
}

export function validateBuildToken(request: Request): boolean {
  const token = request.headers.get('x-build-token');
  return token === process.env.JARVIS_BUILD_TOKEN;
}

export function validateSession(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;
  
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [name, value] = c.trim().split('=');
      return [name, decodeURIComponent(value)];
    })
  );
  
  return cookies.jarvis_session === process.env.JARVIS_PASSWORD;
}

export function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}