"use client";

import React, { useRef, useEffect } from "react";
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
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeInOut" } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Define video demo data with categories
const demoVideos = [
  {
    id: "salon_dashboard",
    category: "salon",
    title: "Salon Dashboard",
    description: "Manage queues and staff for your salon.",
    videoSrc: "/videos/salon_dashboard.mp4",
  },
  {
    id: "salon_analytics",
    category: "salon",
    title: "Salon Analytics",
    description: "Dive into your salon's daily performance metrics.",
    videoSrc: "/videos/salon_analytics.mp4",
  },
  {
    id: "salon_client_page",
    category: "salon",
    title: "Salon Booking/Queue Page",
    description: "Client's view for joining queue or booking.",
    videoSrc: "/videos/salon_client_page.mp4",
  },
  {
    id: "food_truck_dashboard",
    category: "food_truck",
    title: "Food Truck Dashboard",
    description: "Efficiently manage orders and staff for your food truck.",
    videoSrc: "/videos/food_truck_dashboard.mp4",
  },
  {
    id: "food_truck_order_page",
    category: "food_truck",
    title: "Customer's Ordering Page",
    description: "Customer's ordering experience on mobile.",
    videoSrc: "/videos/food_truck_order_page.mp4",
  },
];

// --- NEW COMPONENT FOR VIDEO DEMO CARD ---
interface VideoDemoCardProps {
  demo: typeof demoVideos[0];
  variants: typeof fadeIn;
}

const VideoDemoCard: React.FC<VideoDemoCardProps> = ({ demo, variants }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch((error) => {
        console.warn(`Autoplay prevented for ${demo.title}:`, error);
      });
    }
  }, [demo.videoSrc]);

  return (
    <motion.div
      key={demo.id}
      className="flex-shrink-0 w-full min-w-[140px] max-w-[180px]
                 flex flex-col items-center text-center gap-2 p-3 rounded-lg border border-border shadow-md
                 bg-background hover:bg-gray-50 transition-colors duration-300"
      variants={variants}
    >
      <div className="w-full aspect-[9/16] bg-gray-200 rounded-lg overflow-hidden relative">
        <video
          ref={videoRef}
          autoPlay={false}
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={demo.videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      <h4 className="font-bold text-base mt-1 text-foreground">{demo.title}</h4>
      <p className="text-muted-foreground text-xs">{demo.description}</p>
    </motion.div>
  );
};
// --- END NEW COMPONENT ---

export default function HomePage() {
  const categories: { [key: string]: typeof demoVideos } = demoVideos.reduce(
    (acc, video) => {
      if (!acc[video.category]) {
        acc[video.category] = [];
      }
      acc[video.category].push(video);
      return acc;
    },
    {} as { [key: string]: typeof demoVideos }
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-foreground">
      {/* Header section with branding and navigation */}
      <header className="w-full p-4 flex justify-between items-center max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0"> {/* Changed bg-background/80 to bg-transparent */}
        <motion.h1
          className="text-2xl font-bold text-primary"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          WaitWise
        </motion.h1>
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
              The Smart Way to Manage Your Waitlist
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary/20"
                >
                  Create Your Shop
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* --- */}

        {/* Demo Videos Section */}
        <section id="demos" className="w-full py-20 bg-transparent">
          <motion.div
            className="container mx-auto px-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div className="mx-auto max-w-3xl text-center mb-16" variants={fadeIn}>
              <h3 className="text-3xl font-bold text-foreground">See WaitWise in Action</h3>
              <p className="mt-2 text-muted-foreground">
                Explore how our platform works for different business types.
              </p>
            </motion.div>

            {/* Render each category with its own horizontally scrollable video grid */}
            {Object.keys(categories).map((categoryKey) => (
              <div key={categoryKey} className="mb-12 last:mb-0">
                <motion.h4
                  className="text-2xl font-bold text-center mb-8 capitalize text-foreground"
                  variants={fadeIn}
                >
                  {categoryKey.replace('_', ' ')} Demos
                </motion.h4>

                <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar
                                md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 justify-items-center">
                  {categories[categoryKey].length > 0 ? (
                    categories[categoryKey].map((demo) => (
                      <VideoDemoCard key={demo.id} demo={demo} variants={fadeIn} />
                    ))
                  ) : (
                    <motion.div variants={fadeIn} className="col-span-full text-center text-muted-foreground py-8">
                      No demo videos available for this category yet.
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* --- */}

        {/* "How It Works" section: Explains the process in three steps */}
        <section
          id="how-it-works"
          className="w-full py-20 bg-background/80 border-y border-border"
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
                  className="flex items-start gap-4"
                  variants={fadeIn}
                >
                  <div className="bg-primary text-primary-foreground rounded-full h-10 w-10 flex items-center justify-center font-bold flex-shrink-0 text-lg">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-foreground">
                      {step.title}
                    </h4>
                    <p className="text-muted-foreground mt-1">
                      {step.description}
                    </p>
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
            {/* Benefits cards grid - maintains mobile scroll / desktop grid */}
            <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar
                            md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 justify-items-center">
              {[
                {
                  icon: <Users className="h-10 w-10 text-primary" />,
                  title: "Live Queue Management",
                  description:
                    "View and manage separate queues for each barber in real-time.",
                },
                {
                  icon: <QrCode className="h-10 w-10 text-primary" />,
                  title: "Custom QR Code",
                  description:
                    "Generate a unique QR code for your shop that customers can scan instantly.",
                },
                {
                  icon: <BarChart2 className="h-10 w-10 text-primary" />,
                  title: "Daily Analytics",
                  description:
                    "Track key metrics like revenue and clients per barber with simple, clear charts.",
                },
                {
                  icon: <TrendingUp className="h-10 w-10 text-primary" />,
                  title: "Reduce Walk-outs",
                  description:
                    "Give customers the freedom to wait wherever they want, reducing perceived wait times.",
                },
                {
                  icon: <ThumbsUp className="h-10 w-10 text-primary" />,
                  title: "Improve Customer Experience",
                  description:
                    "A transparent, modern queuing process shows you value your customers' time.",
                },
                {
                  icon: <Clock className="h-10 w-10 text-primary" />,
                  title: "Increase Staff Efficiency",
                  description:
                    "Focus on providing great service instead of managing a crowded waiting area.",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  className="flex-shrink-0 min-w-[180px] max-w-[220px]
                             flex flex-col items-center text-center gap-2 p-4 rounded-lg border border-border shadow-sm
                             bg-background hover:bg-gray-50 transition-colors duration-300"
                  variants={fadeIn}
                >
                  {feature.icon}
                  <h4 className="font-bold text-base mt-1 text-foreground">
                    {feature.title}
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    {feature.description}
                  </p>
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