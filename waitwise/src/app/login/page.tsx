'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const validatePassword = (password: string): boolean => {
    const strongPasswordRegex = new RegExp(
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})"
    );
    return strongPasswordRegex.test(password);
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (!validatePassword(password)) {
      setError("Your password does not meet the requirements.")
      return
    }
    
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Sign up successful! Please check your email to confirm.')
      setIsSignUp(false)
      setEmail('')
      setUsername('')
      setPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <Card className="w-full max-w-sm mx-4 shadow-lg border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Enter your details to get started.' : 'Enter your credentials to access your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="grid gap-4">
            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g., johnsmith"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {/* --- NEW: Password requirements list --- */}
              {isSignUp && (
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <p className="font-semibold">Password must contain:</p>
                  <ul className="list-disc list-inside pl-2">
                    <li>At least 8 characters</li>
                    <li>One uppercase & one lowercase letter</li>
                    <li>One number (0-9)</li>
                    <li>One special character (e.g., !@#$%&)</li>
                  </ul>
                </div>
              )}
              {/* --- End of requirements list --- */}
            </div>

            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <Button 
              variant="link" 
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
              }} 
              className="pl-1"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
