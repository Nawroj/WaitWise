"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client"; // Adjust path as needed
import { Loader2 } from "lucide-react";
import { CreateShopForm } from "../../components/ui/CreateShopForm"; // Keep this import for new shop creation
import HairSalonDashboard from "./hair-salon-dashboard"; // Import the renamed hair salon dashboard

// Define the Shop type here as well, consistent with other files
type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  address: string;
  owner_id: string;
  email: string | null;
  subscription_status: "trial" | "active" | "past_due" | null;
  opening_time: string | null;
  closing_time: string | null;
  account_balance?: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  type: "hair_salon" | "restaurant" | "food_truck";
};

export default function DashboardRouterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // State to hold user info

  useEffect(() => {
    async function fetchUserAndShopType() {
      setLoading(true);
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.push("/login"); // Redirect to login if no user session
        return;
      }
      setUser(currentUser); // Store user info

      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .single();

      if (shopError && shopError.code !== "PGRST116") {
        // PGRST116 is "no rows found"
        console.error("Error fetching shop data:", shopError);
        // Handle other shop fetch errors, maybe display a generic error
        setLoading(false);
        return;
      }

      if (shopData) {
        setShop(shopData);
        if (shopData.type === "food_truck") {
          router.replace("/dashboard/food-truck"); // Redirect to food truck dashboard
        } else {
          // For hair_salon or restaurant, this component will render the HairSalonDashboard
          setLoading(false);
        }
      } else {
        // No shop found for the user, display the CreateShopForm
        setLoading(false);
      }
    }

    fetchUserAndShopType();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (!shop) {
    // If no shop exists for the user, display the form to create one
    return <CreateShopForm onShopCreated={setShop} />;
  }

  // If we reach here, it means shop is loaded and it's NOT a food_truck (it's hair_salon or restaurant)
  // so we render the hair salon/general dashboard
  return <HairSalonDashboard />;
}
