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
  const [isSignUp, setIsSignUp] = useState(false) // State to toggle between sign-in and sign-up forms
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Validates password strength using a regular expression
  const validatePassword = (password: string): boolean => {
    const strongPasswordRegex = new RegExp(
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})"
    );
    return strongPasswordRegex.test(password);
  }

  // Handles user sign-up process
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
        data: { username }, // Pass username as part of user metadata
      },
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Sign up successful! Please check your email to confirm.')
      // Reset form fields and switch to sign-in view
      setIsSignUp(false)
      setEmail('')
      setUsername('')
      setPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  // Handles user sign-in process
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard') // Redirect to dashboard on successful sign-in
      router.refresh() // Refresh page to ensure session is updated
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
            {/* Username input for sign-up form */}
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
            {/* Email input for both forms */}
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
            {/* Password input for both forms */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {/* Password requirements displayed only for sign-up */}
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
            </div>

            {/* Confirm Password input only for sign-up */}
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

            {/* Display error message if any */}
            {error && <p className="text-sm text-red-500">{error}</p>}
            
            {/* Submit button with loading state */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
          {/* Toggle between Sign Up and Sign In views */}
          <div className="mt-4 text-center text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <Button 
              variant="link" 
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null) // Clear any previous errors when switching forms
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