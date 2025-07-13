"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MobileNav } from "@/components/ui/MobileNav";

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

// Animation variants for Framer Motion
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
    // Requires at least 8 characters, one uppercase, one lowercase, one number, one special character
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
      setIsSignUp(false); // Switch to sign-in view after successful sign-up
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
      router.refresh(); // Ensure session is fresh
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen text-foreground">
      {/* Header section - Replicated Home Page's Header */}
      <header className="w-full relative p-4 flex items-center justify-between max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0">
        {/* Left: Logo Icon with animation */}
        <motion.div
          className="flex items-center z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/">
            <img
              src="/Logo.svg"
              alt="Logo"
              className="h-10 sm:h-9 xs:h-8 w-auto max-w-[40px] object-contain"
            />
          </Link>
        </motion.div>

        {/* Center: Name Logo with full responsiveness */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 z-0 w-[30vw] sm:w-[25vw] xs:w-[40vw] max-w-[180px]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src="/logo-name.svg"
            alt="WaitWise"
            className="w-full h-auto object-contain"
          />
        </motion.div>

        {/* Right: Navigation */}
        <nav className="hidden md:flex items-center gap-2 z-10">
          <Link href="/pricing">
            <Button
              variant="ghost"
              className="hover:text-primary transition-colors transition-transform duration-300 transform hover:scale-105 text-base sm:text-sm"
            >
              Pricing
            </Button>
          </Link>
          <Link href="/login">
            <Button className="bg-black text-white rounded-[33px] transition-transform duration-300 transform hover:bg-neutral-800 hover:scale-105">
              Login
            </Button>
          </Link>
        </nav>

        {/* Mobile navigation toggle */}
        <div className="md:hidden z-10">
          <MobileNav />
        </div>
      </header>

      {/* Main content - Replicating Home Page's Hero Section styling and placing the form */}
      <main className="flex-grow w-full flex items-center justify-center">
        <section className="w-full min-h-full py-16 sm:py-20 md:py-24 lg:py-32 flex items-center justify-center ">
          <motion.div
            className="container mx-auto px-4 flex flex-col items-center" // Center content vertically
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            {/* Optional Intro Text - Uncomment if you want a title/subtitle above the form */}
            <motion.h2
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground text-center mb-4 md:mb-6"
              variants={fadeIn}
            >
              {isSignUp ? "Join WaitWise Today" : "Access Your Shop Dashboard"}
            </motion.h2>
            <motion.p
              className="mx-auto max-w-[600px] text-muted-foreground md:text-lg text-center mb-8 md:mb-10"
              variants={fadeIn}
            >
              {isSignUp
                ? "Create your account to start managing queues and orders seamlessly."
                : "Sign in to manage your shop's operations and see your analytics."}
            </motion.p>

            {/* Login/Signup Card */}
            <motion.div variants={fadeIn} className="w-full max-w-sm">
              <Card className="p-6 sm:p-8 shadow-xl border border-border bg-background text-foreground hover:shadow-2xl transition-shadow duration-300 ease-in-out">
                <CardHeader className="p-0 mb-6"> {/* Adjusted padding */}
                  <CardTitle className="text-2xl font-bold text-center">
                    {isSignUp ? "Sign Up" : "Sign In"}
                  </CardTitle>
                  <CardDescription className="text-center mt-2">
                    {isSignUp
                      ? "Enter your details to get started."
                      : "Enter your credentials to access your dashboard."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0"> {/* Adjusted padding */}
                  <form
                    onSubmit={isSignUp ? handleSignUp : handleSignIn}
                    className="grid gap-5" // Increased gap
                  >
                    {isSignUp && (
                      <div className="grid gap-2">
                        <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="e.g., yourshopname"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                      {isSignUp && (
                        <motion.div
                          className="text-xs text-muted-foreground mt-2 space-y-1 bg-secondary/30 p-3 rounded-md border border-dashed border-border"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <p className="font-semibold text-foreground">Password must contain:</p>
                          <ul className="list-disc list-inside pl-2">
                            <li>At least 8 characters</li>
                            <li>One uppercase & one lowercase letter</li>
                            <li>One number (0-9)</li>
                            <li>One special character (e.g., !@#$%&)</li>
                          </ul>
                        </motion.div>
                      )}
                    </div>

                    {isSignUp && (
                      <div className="grid gap-2">
                        <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    )}

                    {error && (
                      <motion.p
                        className="text-sm text-red-500 bg-red-50 p-2 rounded-md border border-red-200 text-center"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {error}
                      </motion.p>
                    )}

                    <Button
                      type="submit"
                      size="lg" // Use large button size
                      className="w-full rounded-[33px] bg-[#ff284d] text-white hover:bg-[#e02245] transition-all duration-300 transform hover:scale-105 shadow-md shadow-[#ff284d]/40 hover:shadow-[#e02245]/60" // Custom primary color and shadow
                      disabled={loading}
                    >
                      {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
                    </Button>
                  </form>
                  <div className="mt-6 text-center text-sm">
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    <Button
                      variant="link"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null); // Clear error on switch
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                        setUsername("");
                      }}
                      className="pl-1 text-primary hover:text-primary-dark transition-colors font-medium" // Adjusted link style
                    >
                      {isSignUp ? "Sign In" : "Sign Up"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer section - Copied from Home Page */}
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