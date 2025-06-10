'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('') // Our new state for the username
  const [isSignUp, setIsSignUp] = useState(false) // To toggle between Sign In and Sign Up
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // This is how we pass the username metadata!
          username: username,
        },
      },
    })

    if (error) {
      setError(error.message)
    } else {
      // On successful sign-up, Supabase sends a confirmation email.
      alert('Sign up successful! Please check your email to confirm.')
      setIsSignUp(false) // Switch back to sign in view
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
      router.refresh() // Ensures the page re-renders with new auth state
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      {isSignUp ? (
        // SIGN UP FORM
        <form onSubmit={handleSignUp}>
          <h2>Sign Up</h2>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <button type="submit" style={{ width: '100%', padding: '10px', cursor: 'pointer' }}>Sign Up</button>
          <p style={{ textAlign: 'center' }}>
            Already have an account? <button type="button" onClick={() => setIsSignUp(false)} style={{ all: 'unset', cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>Sign In</button>
          </p>
        </form>
      ) : (
        // SIGN IN FORM
        <form onSubmit={handleSignIn}>
          <h2>Sign In</h2>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <button type="submit" style={{ width: '100%', padding: '10px', cursor: 'pointer' }}>Sign In</button>
          <p style={{ textAlign: 'center' }}>
            Don't have an account? <button type="button" onClick={() => setIsSignUp(true)} style={{ all: 'unset', cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>Sign Up</button>
          </p>
        </form>
      )}

      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
    </div>
  )
}