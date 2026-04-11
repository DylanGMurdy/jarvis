const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60;
  
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

export function getRateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}