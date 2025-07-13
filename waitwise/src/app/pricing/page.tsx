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
    <div className="flex flex-col items-center min-h-screen text-foreground">
      {/* Header section with branding and navigation - Copied from HomePage */}
      <header className="w-full relative p-4 flex items-center justify-between max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0">
  {/* Left: Logo Icon with animation - Copied from HomePage */}
  <motion.div
    className="flex items-center z-10"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5 }}
  >
    <Link href="/"> {/* Wrap with Link to go home on logo click */}
      <img
        src="/Logo.svg"
        alt="Logo"
        className="h-10 sm:h-9 xs:h-8 w-auto max-w-[40px] object-contain"
      />
    </Link>
  </motion.div>

  {/* Center: Name Logo with full responsiveness - Copied from HomePage */}
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

      <main className="flex-grow w-full py-12 md:py-20">
  <motion.div
    className="container mx-auto max-w-4xl px-4"
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
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 gap-8"
      variants={staggerContainer}
    >
      {tiers.map((tier) => (
        <motion.div key={tier.name} variants={fadeIn}>
          <Card
            className={`flex flex-col h-full border bg-background transition-colors duration-300
              ${
                tier.name === "Pay-as-you-go"
                  ? " shadow-lg hover:shadow-[0_8px_20px_rgb(255,40,77,0.5)]"
                  : " shadow-sm hover:shadow-[0_8px_20px_rgb(255,40,77,0.4)]"
              }
              hover:bg-gray-50`}
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
              <Link href={tier.href} className="w-full block">
                <Button
                  size="lg"
                  variant={tier.variant}
                  className="w-full
                             rounded-[33px] 
                             bg-[#ff284d] 
                             text-black 
                             hover:bg-[#e02245] 
                             transition-all duration-300
                             transform hover:scale-105
                             shadow-lg shadow-[#ff284d]/50
                             hover:shadow-[0_10px_25px_rgb(255,40,77,0.7)]"
                >
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