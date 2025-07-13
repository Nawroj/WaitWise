"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion"; // Import motion for animations
// Removed Link and MobileNav imports as header is removed

// Define the Shop type to be consistent with DashboardPage.tsx
type Shop = {
  id: string;
  name: string;
  address: string;
  owner_id: string;
  email: string | null;
  subscription_status: "trial" | "active" | "past_due" | null;
  stripe_customer_id: string | null;
  opening_time: string | null;
  closing_time: string | null;
  logo_url: string | null;
  stripe_payment_method_id: string | null;
  account_balance?: number;
  type: "hair_salon" | "food_truck";
};

interface CreateShopFormProps {
  onShopCreated: (newShop: Shop) => void;
}

// Animation variants for Framer Motion (still useful for the form card)
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

export function CreateShopForm({ onShopCreated }: CreateShopFormProps) {
  const supabase = createClient();
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("17:00");
  const [shopType, setShopType] = useState<Shop["type"]>("hair_salon");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Could not find user. Please log in again.");
      }

      const userEmail = user.email;

      if (!userEmail) {
        throw new Error(
          "Could not retrieve user email. Please ensure your account has an email address.",
        );
      }

      const { data: newShop, error: insertError } = await supabase
        .from("shops")
        .insert({
          name: shopName,
          address: shopAddress,
          opening_time: openingTime,
          closing_time: closingTime,
          owner_id: user.id,
          email: userEmail,
          subscription_status: "trial",
          logo_url: null,
          stripe_customer_id: null,
          stripe_payment_method_id: null,
          account_balance: 0,
          type: shopType,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (newShop) {
        onShopCreated(newShop as Shop);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
      console.error("Error creating shop:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Removed the flex-col and text-foreground from here, keeping minimal styling
    <div className="flex items-center justify-center min-h-screen bg-background">
      {/* Header is removed */}

      <main className="flex-grow w-full flex items-center justify-center">
        {/* Removed py- from section and background gradient */}
        <section className="w-full min-h-full flex items-center justify-center">
          <motion.div
            className="container mx-auto px-4 flex flex-col items-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            {/* Logo Heading for the form */}
            <motion.div
              className="w-[50vw] sm:w-[40vw] md:w-[30vw] max-w-[250px] mb-4 md:mb-6"
              variants={fadeIn}
            >
              <img
                src="/logo-name.svg" // Using the name logo here
                alt="WaitWise"
                className="w-full h-auto object-contain"
              />
            </motion.div>

            <motion.p
              className="mx-auto max-w-[600px] text-muted-foreground md:text-lg text-center mb-8 md:mb-10"
              variants={fadeIn}
            >
              Let&apos;s get your business set up. Fill in the details below to
              create your shop and start managing your queues and orders.
            </motion.p>

            {/* Shop Creation Card */}
            <motion.div variants={fadeIn} className="w-full max-w-lg">
              <Card className="p-6 sm:p-8 shadow-xl border border-border bg-background text-foreground hover:shadow-2xl transition-shadow duration-300 ease-in-out">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-2xl font-bold text-center">
                    Create Your Shop
                  </CardTitle>
                  <CardDescription className="text-center mt-2">
                    Provide the basic information for your business.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <form onSubmit={handleCreateShop} className="grid gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="shop-name" className="text-sm font-medium">Shop Name</Label>
                      <Input
                        id="shop-name"
                        placeholder="e.g., The Style Studio"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        required
                        className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="shop-address" className="text-sm font-medium">Shop Address</Label>
                      <Input
                        id="shop-address"
                        placeholder="e.g., 123 Main St, Sydney, NSW"
                        value={shopAddress}
                        onChange={(e) => setShopAddress(e.target.value)}
                        required
                        className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    {/* Shop Type Selector */}
                    <div className="grid gap-2">
                      <Label htmlFor="shop-type" className="text-sm font-medium">Shop Type</Label>
                      <Select
                        value={shopType}
                        onValueChange={(value: Shop["type"]) => setShopType(value)}
                      >
                        <SelectTrigger id="shop-type" className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all">
                          <SelectValue placeholder="Select a shop type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hair_salon">Salon</SelectItem>
                          <SelectItem value="food_truck">Food Truck</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* End Shop Type Selector */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="opening-time" className="text-sm font-medium">Opening Time</Label>
                        <Input
                          id="opening-time"
                          type="time"
                          value={openingTime}
                          onChange={(e) => setOpeningTime(e.target.value)}
                          required
                          className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="closing-time" className="text-sm font-medium">Closing Time</Label>
                        <Input
                          id="closing-time"
                          type="time"
                          value={closingTime}
                          onChange={(e) => setClosingTime(e.target.value)}
                          required
                          className="px-4 py-2 rounded-md border border-input focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    </div>

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
                      size="lg"
                      className="w-full rounded-[33px] bg-[#ff284d] text-white hover:bg-[#e02245] transition-all duration-300 transform hover:scale-105 shadow-md shadow-[#ff284d]/40 hover:shadow-[#e02245]/60"
                      disabled={loading}
                    >
                      {loading ? "Creating Shop..." : "Create Shop"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer is removed */}
    </div>
  );
}