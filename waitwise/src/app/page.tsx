"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MobileNav } from "@/components/ui/MobileNav";
import {
  BarChart2,
  QrCode,
  Users,
  Clock,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

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

// Define video demo data
const demoVideos = [
  {
    id: "salon_dashboard",
    title: "Salon Dashboard",
    description: "Manage queues and staff for your salon.",
    videoSrc: "/videos/salon_dashboard.mp4",
  },
  {
    id: "salon_analytics",
    title: "Salon Analytics",
    description: "Dive into your salon's daily performance metrics.",
    videoSrc: "/videos/salon_analytics.mp4",
  },
  {
    id: "salon_client_page",
    title: "Salon Booking/Queue Page",
    description: "Client's view for joining queue or booking.",
    videoSrc: "/videos/salon_client_page.mp4",
  },
  {
    id: "food_truck_dashboard",
    title: "Food Truck Dashboard",
    description: "Efficiently manage orders and staff for your food truck.",
    videoSrc: "/videos/food_truck_dashboard.mp4",
  },
  {
    id: "food_truck_order_page",
    title: "Customer's Ordering Page",
    description: "Customer's ordering experience on mobile.",
    videoSrc: "/videos/food_truck_order_page.mp4",
  },
];

interface VideoDemoCardProps {
  demo: typeof demoVideos[0];
  variants: typeof fadeIn;
}

const VideoDemoCard: React.FC<VideoDemoCardProps> = ({
  demo,
  variants,
}) => {
  // Reference to the video element for controlling playback
  const videoRef = useRef<HTMLVideoElement>(null);
  // State to manage whether the card is "clicked" (for mobile effect)
  const [isClicked, setIsClicked] = useState(false);

  // Effect to load and attempt to play the video when videoSrc changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load(); // Reload the video source
      videoRef.current.play().catch((error) => {
        // Catch and log autoplay errors (browsers often prevent autoplay without user interaction)
        console.warn(`Autoplay prevented for ${demo.title}:`, error);
      });
    }
  }, [demo.videoSrc]); // Re-run effect when video source changes

  // Handler for click events on the card
  const handleClick = () => {
    // Toggle the isClicked state. On mobile, this will apply/remove the effects.
    // On desktop, whileHover will take precedence when the mouse is over the element.
    setIsClicked(!isClicked);
  };

  // Define the animation properties for the "active" state (hovered or clicked)
  const activeAnimation = {
    scale: 1.5, // Scale up the card
    rotate: 0, // Ensure no rotation (if any initial rotation was applied)
    zIndex: 10, // Bring the card to the front
    // Custom box shadow to match the desired hover effect
    boxShadow: '0 8px 24px rgba(255,40,77,0.6)',
    transition: { duration: 0.4 }, // Smooth transition duration
  };

  // Define the animation properties for the "default" state (unhovered and unclicked)
  const defaultAnimation = {
    scale: 1, // Original scale
    rotate: 0, // No rotation
    zIndex: 1, // Default z-index
    // A subtle shadow to mimic Tailwind's 'shadow-md'
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
    transition: { duration: 0.3 }, // Smooth transition duration
  };

  return (
    // motion.div is used for Framer Motion animations
    <motion.div
      key={demo.id} // Unique key for list rendering
      className={`flex-shrink-0 w-[120px] sm:w-[140px] md:w-[160px]
        flex flex-col items-center text-center gap-2 p-3 rounded-lg border border-border bg-background
        shadow-md // Base shadow provided by Tailwind
        relative`} // Removed hover:shadow and transition-shadow as Framer Motion handles these
      variants={variants} // Framer Motion variants for parent-controlled animations
      // 'animate' prop applies the animation based on the 'isClicked' state.
      // If isClicked is true, apply activeAnimation; otherwise, apply defaultAnimation.
      animate={isClicked ? activeAnimation : defaultAnimation}
      // 'whileHover' prop applies the activeAnimation when the mouse hovers over the element.
      // This will override 'animate' when hovering on desktop.
      whileHover={activeAnimation}
      // 'onClick' handler to toggle the 'isClicked' state
      onClick={handleClick}
    >
      <div className="w-full aspect-[9/16] bg-gray-200 rounded-lg overflow-hidden relative">
        <video
          ref={videoRef} // Assign the ref to the video element
          autoPlay={false} // Set to false to prevent initial autoplay issues, useEffect handles it
          loop // Loop the video playback
          muted // Mute the video
          playsInline // Ensure video plays inline on iOS
          preload="metadata" // Preload only metadata for faster loading
          className="absolute inset-0 w-full h-full object-cover" // Cover the container
        >
          <source src={demo.videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      {/* Display the demo title and description */}
      <h4 className="font-bold text-base mt-1 text-foreground">{demo.title}</h4>
      <p className="text-muted-foreground text-xs">{demo.description}</p>
    </motion.div>
  );
};



export default function HomePage() {

  return (
    <div className="flex flex-col items-center min-h-screen text-foreground">
      {/* Header section with branding and navigation */}
      <header className="w-full relative p-4 flex items-center justify-between max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0">
        {/* Left: Logo Icon with animation */}
        <motion.div
          className="flex items-center z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src="/Logo.svg"
            alt="Logo"
            className="h-10 sm:h-9 xs:h-8 w-auto max-w-[40px] object-contain"
          />
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

      <main className="flex-grow w-full">
        {/* Hero section: Main headline and call to action */}
        <section className="w-full py-24 md:py-32 lg:py-40 bg-transparent">
          <motion.div
            className="container mx-auto px-4 text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.h2
              className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-foreground"
              variants={fadeIn}
            >
              Booking & Ordering <br /> Never Felt So Good
            </motion.h2>
            <motion.p
              className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-6"
              variants={fadeIn}
            >
              Great service starts before they arrive. Ditch the paper and give
              your customers the freedom to join the queue from anywhere.
            </motion.p>
            <motion.div className="mt-10" variants={fadeIn}>
              <Link href="/login">
                <Button
                  size="lg"
                  className="rounded-[33px] bg-[#ff284d] text-white hover:bg-[#e02245] transition-all duration-300 transform hover:scale-105 shadow-xl shadow-[#ff284d]/60 hover:shadow-[#e02245]/80"
                >
                  Create Your Shop
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* --- */}

        {/* Demo Videos Section - Now smaller and scaling on hover */}
        <section id="demos" className="w-full py-20 bg-transparent">
          <motion.div
            className="container mx-auto px-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div
              className="mx-auto max-w-3xl text-center mb-16"
              variants={fadeIn}
            >
              <h3 className="text-3xl font-bold text-foreground">
                See WaitWise in Action
              </h3>
              <p className="mt-2 text-muted-foreground">
                Explore how our platform works for different business types.
              </p>
            </motion.div>

            {/* Display all videos in a single, responsive grid */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 px-4">
  {demoVideos.length > 0 ? (
    demoVideos.map((demo) => (
      <VideoDemoCard
        key={demo.id}
        demo={demo}
        variants={fadeIn}
      />
    ))
  ) : (
    <motion.div
      variants={fadeIn}
      className="w-full text-center text-muted-foreground py-8"
    >
      No demo videos available yet.
    </motion.div>
  )}
</div>

          </motion.div>
        </section>

        {/* --- */}

        {/* "How It Works" section: Explains the process in three steps */}
        <section
  id="how-it-works"
  className="w-full py-20 bg-background border-y border-border"
>
  <motion.div
    className="container mx-auto px-4"
    initial="initial"
    whileInView="animate"
    viewport={{ once: true, amount: 0.3 }}
    variants={staggerContainer}
  >
    <motion.div
      className="mx-auto max-w-3xl text-center"
      variants={fadeIn}
    >
      <h3 className="text-3xl font-bold text-foreground">How It Works</h3>
      <p className="mt-2 text-muted-foreground">
        Get up and running in three simple steps.
      </p>
    </motion.div>

    <motion.div
      className="mx-auto mt-16 grid max-w-5xl items-start gap-10 text-left md:grid-cols-3 lg:gap-12"
      variants={staggerContainer}
    >
      {[
        {
          title: "Set Up Your Shop",
          description:
            "Create your account and add your business details, services, and staff members in minutes.",
        },
        {
          title: "Customers Join Online",
          description:
            "Customers scan a QR code or visit your public page to join the queue and see real-time wait estimates.",
        },
        {
          title: "Manage the Flow",
          description:
            "Use your live dashboard to manage the queue, update customer statuses, and keep everything running smoothly.",
        },
      ].map((step, i) => (
        <motion.div
          key={i}
          className="flex flex-col gap-4 p-6 border border-border rounded-xl bg-background shadow hover:shadow-[0_6px_20px_rgba(255,40,77,0.2)] transition-shadow"
          variants={fadeIn}
        >
          <div className="bg-[#ff284d] text-white rounded-full h-10 w-10 flex items-center justify-center font-bold text-lg shadow-lg">
            {i + 1}
          </div>
          <div>
            <h4 className="font-semibold text-lg text-foreground">{step.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  </motion.div>
</section>


        {/* --- */}

        {/* Features & Benefits section: Highlights key advantages of using WaitWise */}
        <section id="features" className="w-full py-20 bg-transparent">
  <motion.div
    className="container mx-auto px-4"
    initial="initial"
    whileInView="animate"
    viewport={{ once: true, amount: 0.3 }}
    variants={staggerContainer}
  >
    <motion.div
      className="mx-auto max-w-3xl text-center mb-16"
      variants={fadeIn}
    >
      <h3 className="text-3xl font-bold text-foreground">
        Everything You Need for a Seamless Flow
      </h3>
    </motion.div>

    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 justify-items-center">
  {[
    {
      icon: <Users className="h-8 w-8 text-[#ff284d]" />,
      title: "Live Queue Management",
      description:
        "View and manage separate queues for each barber in real-time.",
    },
    {
      icon: <QrCode className="h-8 w-8 text-[#ff284d]" />,
      title: "Custom QR Code",
      description:
        "Generate a unique QR code for your shop that customers can scan instantly.",
    },
    {
      icon: <BarChart2 className="h-8 w-8 text-[#ff284d]" />,
      title: "Daily Analytics",
      description:
        "Track key metrics like revenue and clients per barber with clear charts.",
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-[#ff284d]" />,
      title: "Reduce Walk-outs",
      description:
        "Let customers wait remotely and reduce perceived wait time.",
    },
    {
      icon: <ThumbsUp className="h-8 w-8 text-[#ff284d]" />,
      title: "Improve Customer Experience",
      description:
        "A modern, transparent queue process respects your customers' time.",
    },
    {
      icon: <Clock className="h-8 w-8 text-[#ff284d]" />,
      title: "Increase Staff Efficiency",
      description:
        "Focus on service, not managing a crowded waiting area.",
    },
  ].map((feature, i) => (
    <motion.div
      key={i}
      className="w-full max-w-[160px] md:max-w-[220px] flex flex-col items-center text-center gap-2 p-4 border border-border rounded-xl bg-background shadow-sm hover:shadow-[0_6px_20px_rgba(255,40,77,0.2)] transition-shadow"
      variants={fadeIn}
    >
      {feature.icon}
      <h4 className="font-semibold text-sm md:text-base text-foreground">
        {feature.title}
      </h4>
      <p className="text-xs text-muted-foreground">{feature.description}</p>
    </motion.div>
  ))}
</div>

  </motion.div>
</section>

      </main>

      {/* --- */}

      {/* Footer section with legal links and copyright */}
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