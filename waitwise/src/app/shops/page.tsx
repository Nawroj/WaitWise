"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

// Define a detailed type for a shop including opening and closing times
type Shop = {
  id: string;
  name: string;
  address: string;
  opening_time: string | null;
  closing_time: string | null;
};

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shops data from Supabase on component mount
  useEffect(() => {
    const fetchShops = async () => {
      const supabase = createClient();
      // Select all necessary shop details, including opening and closing times
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, address, opening_time, closing_time")
        .order("name");

      if (error) {
        console.error("Error fetching shops:", error);
        setError("Could not fetch shops. Please try again later.");
      } else {
        setShops(data as Shop[]);
      }
      setLoading(false);
    };

    fetchShops();
  }, []);

  // Memoize filtered shops based on search query
  const filteredShops = useMemo(() => {
    if (!searchQuery) {
      return shops;
    }
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.address.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, shops]);

  // Helper function to determine if a shop is currently open
  const isShopOpen = (shop: Shop): boolean => {
    if (!shop.opening_time || !shop.closing_time) {
      return false; // Shop is considered closed if times are not specified
    }
    const now = new Date();

    // Parse opening and closing times
    const openingTimeParts = shop.opening_time.split(":");
    const closingTimeParts = shop.closing_time.split(":");

    // Create Date objects for opening and closing times on the current day
    const openingDate = new Date();
    openingDate.setHours(
      parseInt(openingTimeParts[0]),
      parseInt(openingTimeParts[1]),
      0,
    );

    const closingDate = new Date();
    closingDate.setHours(
      parseInt(closingTimeParts[0]),
      parseInt(closingTimeParts[1]),
      0,
    );

    // Check if current time falls within opening and closing hours
    return now >= openingDate && now <= closingDate;
  };

  // Display loading message while fetching data
  if (loading) {
    return (
      <p className="p-8 text-center text-muted-foreground">Loading shops...</p>
    );
  }

  // Display error message if data fetching fails
  if (error) {
    return <p className="p-8 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Page Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Find a Shop</h1>
        <p className="text-muted-foreground mt-2">
          Select a shop below to join their queue.
        </p>
      </header>

      {/* Search Input */}
      <div className="mb-8 max-w-md mx-auto">
        <Input
          type="text"
          placeholder="Search by shop name or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Display filtered shops or a message if no shops are found */}
      {filteredShops.length > 0 ? (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop) => {
            const isOpen = isShopOpen(shop);
            return (
              <Card key={shop.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{shop.name}</CardTitle>
                      {/* Display Open/Closed badge based on shop's operating hours */}
                      <Badge
                        variant={isOpen ? "default" : "secondary"}
                        className={isOpen ? "bg-green-600" : ""}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </Badge>
                    </div>
                    <CardDescription>{shop.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Additional shop details can be added here */}
                  </CardContent>
                </div>
                <CardFooter>
                  <Link href={`/shop/${shop.id}`} className="w-full">
                    {/* Join Queue button is disabled if the shop is closed */}
                    <Button className="w-full" disabled={!isOpen}>
                      {isOpen ? "Join Queue" : "View Shop"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </main>
      ) : (
        <p className="text-center text-muted-foreground">
          {shops.length > 0
            ? "No shops match your search."
            : "No shops have registered yet."}
        </p>
      )}
    </div>
  );
}
