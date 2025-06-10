'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
      } else {
        // If no user is found, redirect to the login page
        router.push('/login')
      }
      setLoading(false)
    }

    getUser()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/') // Redirect to homepage after logout
  }

  // Display a loading message while we check for a user
  if (loading) {
    return <div>Loading...</div>
  }

  // This content is only visible to logged-in users
  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to your StyleLink Dashboard</h1>
      <p>This is a protected area. Only logged-in users can see this.</p>
      <br />
      {user && <p>You are logged in as: <strong>{user.email}</strong></p>}
      <br />
      <button 
        onClick={handleLogout} 
        style={{ padding: '8px 16px', cursor: 'pointer' }}
      >
        Logout
      </button>
    </div>
  )
}