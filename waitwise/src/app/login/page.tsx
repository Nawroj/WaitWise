"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Import Link for navigation
import { motion } from "framer-motion"; // Import motion for animations
import { MobileNav } from "@/components/ui/MobileNav"; // Assuming this is your mobile nav component

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Animation variants for Framer Motion (copied from PricingPage)
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeInOut" as const,
    },
  },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const validatePassword = (password: string): boolean => {
    const strongPasswordRegex = new RegExp(
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})",
    );
    return strongPasswordRegex.test(password);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Your password does not meet the requirements.");
      return;
    }

    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      alert("Sign up successful! Please check your email to confirm.");
      setIsSignUp(false);
      setEmail("");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-foreground">
      {/* Header section - Copied from PricingPage */}
      <header className="w-full p-4 flex justify-between items-center max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0">
        <Link href="/">
          <motion.h1
            className="text-2xl font-bold text-primary cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            WaitWise
          </motion.h1>
        </Link>
        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/pricing">
            <Button
              variant="ghost"
              className="hover:text-primary transition-colors"
            >
              Pricing
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="ghost"
              className="hover:text-primary transition-colors"
            >
              Owner Login
            </Button>
          </Link>
        </nav>
        {/* Mobile navigation toggle */}
        <div className="md:hidden">
          <MobileNav />
        </div>
      </header>

      <main className="flex-grow w-full py-12 md:py-20 flex items-center justify-center">
        <motion.div
          className="container mx-auto max-w-4xl px-4"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div className="flex justify-center" variants={fadeIn}>
            <Card className="w-full max-w-sm mx-4 shadow-lg border border-border bg-background text-foreground hover:bg-gray-50 transition-colors duration-300">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">
                  {isSignUp ? "Create an Account" : "Welcome Back"}
                </CardTitle>
                <CardDescription className="text-center">
                  {isSignUp
                    ? "Enter your details to get started."
                    : "Enter your credentials to access your dashboard."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={isSignUp ? handleSignUp : handleSignIn}
                  className="grid gap-4"
                >
                  {isSignUp && (
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="e.g., johnsmith"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
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

                  {isSignUp && (
                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
                  </Button>
                </form>
                <div className="mt-4 text-center text-sm">
                  {isSignUp ? "Already have an account?" : "Don't have an account?"}
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError(null);
                    }}
                    className="pl-1"
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer section - Copied from PricingPage */}
      <footer className="w-full p-8 border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-4">
            <nav className="flex justify-center gap-6">
              <Link
                href="/terms-of-service"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy-policy"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
            </nav>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} WaitWise. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}