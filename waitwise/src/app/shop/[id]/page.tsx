export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server"; // Server-side Supabase client
import BookingClient from "./BookingClient"; // Client component for hair salons (queue)
import OrderPage from "./OrderPage"; // Client component for food trucks (ordering)
import { notFound } from "next/navigation"; // For handling cases where shop is not found

// --- Type Definitions (ensure these match your database schema precisely) ---



// --- ShopPage Server Component ---
interface PageProps {
  params: { id: string };
}

export default async function ShopPage({ params }: PageProps) {
  const { id: shopId } = params;
  const supabase = await createClient(); // Initialize server-side Supabase client

  console.log(`[ShopPage Server] Fetching shop with ID: ${shopId}`);

  // 1. Fetch Shop Details first to determine its type
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();

  // Handle cases where the shop is not found or there's a fetch error
  if (shopError || !shop) {
    console.error("[ShopPage Server] Error fetching shop:", shopError?.message || "Shop not found or unknown error.");
    notFound(); // Triggers Next.js's not-found page
  }

  console.log(`[ShopPage Server] Shop found: ${shop.name}, Type: ${shop.type}`);

  // 2. Conditionally fetch and render based on the determined shop type
  if (shop.type === "hair_salon") {
    console.log("[ShopPage Server] Shop is a hair_salon. Fetching services and barbers.");
    // --- Data Fetching for Hair Salons ---
    // Fetch services and barbers who are currently working
    const [
      { data: servicesData, error: servicesError }, // Changed offeringsData to servicesData, offeringsError to servicesError
      { data: barbersData, error: barbersError },   // Changed staffMembersData to barbersData, staffMembersError to barbersError
    ] = await Promise.all([
      supabase
        .from("services") // Changed from "offerings" to "services"
        .select("*")
        .eq("shop_id", shop.id)
        .order("created_at"), // Order by creation date
      supabase
        .from("barbers") // Changed from "staff_members" to "barbers"
        .select("*")
        .eq("shop_id", shop.id)
        .eq("is_working_today", true) // Only fetch staff members marked as working
        .order("created_at"),
    ]);

    if (servicesError) { // Changed offeringsError to servicesError
      console.error("[ShopPage Server] Error fetching services:", servicesError.message); // Changed offeringsError to servicesError
      notFound();
    }
    if (barbersError) { // Changed staffMembersError to barbersError
      console.error("[ShopPage Server] Error fetching barbers:", barbersError.message); // Changed staffMembersError to barbersError
      notFound();
    }

    // Log fetched data counts to see if anything is coming back
    console.log(`[ShopPage Server] Fetched ${servicesData?.length || 0} services.`); // Changed offeringsData to servicesData
    console.log(`[ShopPage Server] Fetched ${barbersData?.length || 0} barbers.`);     // Changed staffMembersData to barbersData


    // Render the BookingClient component for hair salons
    return (
      <BookingClient
        shop={shop}
        items={servicesData || []} // Changed offeringsData to servicesData
        staffMembers={barbersData || []} // Changed staffMembers to barbers
      />
    );
  } else if (shop.type === "food_truck") {
    console.log("[ShopPage Server] Shop is a food_truck. Fetching menu items.");
    // --- Data Fetching for Food Trucks ---
    // Fetch menu items that are marked as available
    const { data: menuItemsData, error: menuItemsError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("is_available", true) // Only show items currently available for ordering
      .order("category, name"); // Order by category then item name for clear display

    if (menuItemsError) {
      console.error("[ShopPage Server] Error fetching food truck menu items:", menuItemsError.message);
      notFound(); // Or display a specific error message to the user
    }

    console.log(`[ShopPage Server] Fetched ${menuItemsData?.length || 0} menu items.`);

    // Render the OrderPage component for food trucks
    return <OrderPage shop={shop} menuItems={menuItemsData || []} />;
  } else {
    // --- Fallback for Unsupported Shop Types ---
    console.warn(`[ShopPage Server] Shop type '${shop.type}' is not currently supported.`);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-xl">
          This shop type is not yet supported for public booking/ordering.
        </h1>
      </div>
    );
  }
}