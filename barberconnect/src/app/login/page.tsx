'use client' // This is a client-side component

import { useState, useEffect } from 'react' // <-- Import useState
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  
  // We will use state to hold the redirect URL
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  // This useEffect hook will only run ONCE in the browser after the page loads
  useEffect(() => {
    // Set the redirect URL using the browser's location object
    setRedirectUrl(`${window.location.origin}/auth/callback`)
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  // Show a loading message while we wait for the redirect URL to be set
  if (!redirectUrl) {
    return <div>Loading...</div>
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '320px' }}>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={['google']}
          // Use the state variable for the redirect URL
          redirectTo={redirectUrl}
        />
      </div>
    </div>
  )
}