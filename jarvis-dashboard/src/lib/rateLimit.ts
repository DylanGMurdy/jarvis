import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60
  }
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - options.windowMs
  
  // Clean up expired entries
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  })
  
  const current = store[identifier]
  
  if (!current || current.resetTime < now) {
    store[identifier] = {
      count: 1,
      resetTime: now + options.windowMs
    }
    return {
      success: true,
      remaining: options.maxRequests - 1,
      resetTime: store[identifier].resetTime
    }
  }
  
  if (current.count >= options.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: current.resetTime
    }
  }
  
  current.count++
  
  return {
    success: true,
    remaining: options.maxRequests - current.count,
    resetTime: current.resetTime
  }
}

export function getRateLimitIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIp) {
    return realIp
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  // Fallback to a default identifier
  return 'unknown'
}

// Legacy exports used by individual route handlers
export function isRateLimited(ip: string): boolean {
  const result = rateLimit(ip, { windowMs: 60 * 1000, maxRequests: 60 })
  return !result.success
}

export function getRateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
