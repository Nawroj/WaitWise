"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";
import { MobileNav } from "@/components/ui/MobileNav";
import { motion } from "framer-motion";

// Animation variants for Framer Motion (copied from HomePage)
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

export default function PricingPage() {
  // Define pricing tiers with their details and features
  const tiers = [
    {
      name: "Trial",
      price: "Free",
      period: "for your first 50 clients",
      description:
        "Get started with WaitWise and experience the full platform on us. No credit card required.",
      features: [
        "100 free client credits",
        "Full access to all features",
        "Unlimited Stuffs & Services",
        "QR Code for customers",
      ],
      cta: "Start for Free",
      href: "/login",
      variant: "outline" as const,
    },
    {
      name: "Pay-as-you-go",
      price: "$0.33",
      period: "per completed client",
      description:
        "Only pay for what you use. Perfect for businesses of all sizes with fluctuating client flow.",
      features: [
        "All features included",
        "Unlimited Stuffs & Services",
        "Daily Analytics",
        "QR Code for customers",
        "Pay based on your usage anytime",
      ],
      cta: "Activate Now",
      href: "/login",
      variant: "default" as const,
    },
  ];

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-foreground">
      {/* Header section with branding and navigation - Copied from HomePage */}
      <header className="w-full p-4 flex justify-between items-center max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0">
        <Link href="/"> {/* Added Link to homepage */}
          <motion.h1
            className="text-2xl font-bold text-primary cursor-pointer" // Added cursor-pointer
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

      <main className="flex-grow w-full py-12 md:py-20"> {/* Added padding for consistency */}
        <motion.div
          className="container mx-auto max-w-4xl px-4" // Adjusted padding for main content
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Page Header */}
          <motion.header className="mb-12 text-center" variants={fadeIn}>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Simple, Fair Pricing
            </h1>
            <p className="text-muted-foreground mt-4 text-lg">
              Start for free, then only pay for what you use. No subscriptions, no
              hidden fees.
            </p>
          </motion.header>

          {/* Pricing Cards Section */}
          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8" variants={staggerContainer}>
            {/* Map through tiers to render each pricing card */}
            {tiers.map((tier, index) => (
              <motion.div key={tier.name} variants={fadeIn}> {/* Added motion.div for individual card animation */}
                <Card
                  className={`flex flex-col h-full ${tier.name === "Pay-as-you-go" ? "border-primary shadow-lg" : "border border-border shadow-sm"} bg-background hover:bg-gray-50 transition-colors duration-300`} // Added styling for cards
                >
                  <CardHeader>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      {tier.period && (
                        <span className="text-muted-foreground">{tier.period}</span>
                      )}
                    </div>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="space-y-3">
                      {/* Display features for each tier */}
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start">
                          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  {/* Call to action button */}
                  <div className="p-6 pt-0">
                    <Link href={tier.href} className="w-full">
                      <Button size="lg" className="w-full" variant={tier.variant}>
                        {tier.cta}
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </main>

      {/* Footer section with legal links and copyright - Copied from HomePage */}
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