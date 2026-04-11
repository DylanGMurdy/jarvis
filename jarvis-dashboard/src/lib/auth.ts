import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { type User } from '@supabase/supabase-js'

export async function getServerSession() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getServerUser(): Promise<User | null> {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function createSupabaseServerClient() {
  return createServerComponentClient({ cookies })
}

export function createSupabaseRouteClient() {
  return createRouteHandlerClient({ cookies })
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}
