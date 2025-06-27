"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MobileNav } from "@/components/ui/MobileNav";
import { BarChart2, QrCode, Users, Clock, ThumbsUp, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

// Animation variants for Framer Motion
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeInOut" },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground">
      {/* --- HEADER --- */}
      <header className="w-full p-4 flex justify-between items-center max-w-7xl mx-auto border-b border-border/50">
        <motion.h1 
          className="text-2xl font-bold text-primary"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          WaitWise
        </motion.h1>
        {/* --- MODIFIED NAV --- */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/pricing"><Button variant="ghost" className="hover:text-primary transition-colors">Pricing</Button></Link>
          <Link href="/login"><Button variant="ghost" className="hover:text-primary transition-colors">Owner Login</Button></Link>
          <Link href="/shops"><Button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105">Join a Queue</Button></Link>
        </nav>
        <div className="md:hidden"><MobileNav /></div>
      </header>

      <main className="flex-grow w-full">
        {/* --- HERO SECTION --- */}
        <section className="w-full py-24 md:py-32 lg:py-40">
          <motion.div 
            className="container mx-auto px-4 text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl"
              variants={fadeIn}
            >
              The Smart Way to Manage Your Waitlist
            </motion.h2>
            <motion.p 
              className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-6"
              variants={fadeIn}
            >
              Great service starts before they arrive. Ditch the paper and give your customers the freedom to join the queue from anywhere.
            </motion.p>
            <motion.div 
              className="mt-10"
              variants={fadeIn}
            >
              <Link href="/login">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary/20">
                  Create Your Shop
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="w-full py-20 bg-card border-y border-border">
          <motion.div 
            className="container mx-auto px-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div className="mx-auto max-w-3xl text-center" variants={fadeIn}>
              <h3 className="text-3xl font-bold">How It Works</h3>
              <p className="mt-2 text-muted-foreground">
                Get up and running in three simple steps.
              </p>
            </motion.div>
            <motion.div 
              className="mx-auto mt-16 grid max-w-5xl items-start gap-10 text-left md:grid-cols-3 lg:gap-12"
              variants={staggerContainer}
            >
              {[
                { title: "Set Up Your Shop", description: "Create your account and add your business details, services, and staff members in minutes." },
                { title: "Customers Join Online", description: "Customers scan a QR code or visit your public page to join the queue and see real-time wait estimates." },
                { title: "Manage the Flow", description: "Use your live dashboard to manage the queue, update customer statuses, and keep everything running smoothly." }
              ].map((step, i) => (
                <motion.div key={i} className="flex items-start gap-4" variants={fadeIn}>
                  <div className="bg-primary text-primary-foreground rounded-full h-10 w-10 flex items-center justify-center font-bold flex-shrink-0 text-lg">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xl">{step.title}</h4>
                    <p className="text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* --- FEATURES & BENEFITS SECTION --- */}
        <section id="features" className="w-full py-20">
          <motion.div 
            className="container mx-auto px-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div className="mx-auto max-w-3xl text-center mb-16" variants={fadeIn}>
              <h3 className="text-3xl font-bold">Everything You Need for a Seamless Flow</h3>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: <Users className="h-10 w-10 text-primary" />, title: "Live Queue Management", description: "View and manage separate queues for each barber in real-time." },
                { icon: <QrCode className="h-10 w-10 text-primary" />, title: "Custom QR Code", description: "Generate a unique QR code for your shop that customers can scan instantly." },
                { icon: <BarChart2 className="h-10 w-10 text-primary" />, title: "Daily Analytics", description: "Track key metrics like revenue and clients per barber with simple, clear charts." },
                { icon: <TrendingUp className="h-10 w-10 text-primary" />, title: "Reduce Walk-outs", description: "Give customers the freedom to wait wherever they want, reducing perceived wait times." },
                { icon: <ThumbsUp className="h-10 w-10 text-primary" />, title: "Improve Customer Experience", description: "A transparent, modern queuing process shows you value your customers' time." },
                { icon: <Clock className="h-10 w-10 text-primary" />, title: "Increase Staff Efficiency", description: "Focus on providing great service instead of managing a crowded waiting area." }
              ].map((feature, i) => (
                <motion.div key={i} className="flex flex-col items-center text-center gap-4 p-6 rounded-lg border border-transparent hover:border-border transition-all hover:-translate-y-1" variants={fadeIn}>
                  {feature.icon}
                  <h4 className="font-bold text-xl mt-2">{feature.title}</h4>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="w-full p-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-4">
            <nav className="flex justify-center gap-6">
              <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
            </nav>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} WaitWise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}