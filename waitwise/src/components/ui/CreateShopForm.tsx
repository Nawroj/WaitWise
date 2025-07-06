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

// Define the Shop type to be consistent with DashboardPage.tsx
// It's crucial that this type matches the comprehensive Shop type in DashboardPage
// to avoid type mismatches when passing the new shop object.
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
  type: "hair_salon" | "food_truck"; // Updated 'barbershop' to 'hair_salon'
};

interface CreateShopFormProps {
  onShopCreated: (newShop: Shop) => void;
}

export function CreateShopForm({ onShopCreated }: CreateShopFormProps) {
  const supabase = createClient();
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("17:00");
  const [shopType, setShopType] = useState<Shop["type"]>("hair_salon"); // Updated default state
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Welcome to WaitWise!
          </CardTitle>
          <CardDescription>
            Let&apos;s get your business set up. Fill in the details below to
            create your shop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateShop} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="shop-name">Shop Name</Label>
              <Input
                id="shop-name"
                placeholder="e.g., The Style Studio"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shop-address">Shop Address</Label>
              <Input
                id="shop-address"
                placeholder="e.g., 123 Main St, Sydney, NSW"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                required
              />
            </div>
            {/* Shop Type Selector */}
            <div className="grid gap-2">
              <Label htmlFor="shop-type">Shop Type</Label>
              <Select
                value={shopType}
                onValueChange={(value: Shop["type"]) => setShopType(value)}
              >
                <SelectTrigger id="shop-type">
                  <SelectValue placeholder="Select a shop type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hair_salon">Hair Salon</SelectItem>{" "}
                  {/* Updated value and label */}
                  <SelectItem value="food_truck">Food Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* End Shop Type Selector */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="opening-time">Opening Time</Label>
                <Input
                  id="opening-time"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="closing-time">Closing Time</Label>
                <Input
                  id="closing-time"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Shop..." : "Create Shop"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
