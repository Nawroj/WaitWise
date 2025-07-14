// app/dashboard/analytics/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react"; // Added useCallback for consistency
import Image from "next/image";
import { createClient } from "../../../lib/supabase/client";
import { useRouter } from "next/navigation"; // Import useRouter for back button
import { Button } from "../../../components/ui/button"; // Import Button component
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2, ChevronLeftCircle } from "lucide-react"; // Import ChevronLeftCircle for back button
import { toast } from "sonner";
import { motion, easeInOut } from "framer-motion";

// Animation Variants (copy from your dashboard)
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeInOut } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Type Definitions (copy relevant ones from your dashboard)
type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  address: string;
  owner_id: string;
  // ... include other shop properties if needed by analytics (e.g., subscription_status)
};

type Barber = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_working_today: boolean;
  is_on_break: boolean;
  break_end_time: string | null;
};
type AnalyticsData = {
  totalRevenue: number;
  totalCustomers: number;
  noShowRate: number;
  barberRevenueData: { name: string; revenue: number }[];
  barberClientData: { name: string; clients: number }[];
};

export default function AnalyticsPage() {
  const supabase = createClient();
  const router = useRouter(); // Initialize useRouter

  const [shop, setShop] = useState<Shop | null>(null);
  // >>> Change 1: Initialize barbers with an empty array, but it will be updated
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState("today");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserShopAndBarbers() { // Renamed for clarity
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); // Redirect to login if unauthorized
        return;
      }
      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (shopError) {
        console.error("Error fetching shop data for analytics:", shopError);
        toast.error("Failed to load shop data for analytics.");
        return;
      }
      setShop(shopData);

      // >>> Change 2: Fetch barbers data
      const { data: barbersData, error: barbersError } = await supabase
        .from("barbers")
        .select("*")
        .eq("shop_id", shopData.id) // Ensure you filter by the fetched shop ID
        .order("created_at"); // Or by name, etc.

      if (barbersError) {
        console.error("Error fetching barbers for analytics:", barbersError);
        toast.error("Failed to load staff data for analytics.");
      } else {
        setBarbers(barbersData as Barber[]);
      }
      // You might want a single loading state for everything, or handle it more granularly
      // setIsAnalyticsLoading(false); // This will be handled by the next useEffect
    }
    fetchUserShopAndBarbers();
  }, [supabase, router]); // Added router to dependencies

  // Fetches analytics data based on selected range and shop ID
  useEffect(() => {
    if (!shop?.id) { // Ensure shop ID is available
      setIsAnalyticsLoading(false); // Stop loading if no shop
      return;
    }

    const fetchAnalytics = async () => {
      setIsAnalyticsLoading(true);
      const today = new Date();
      let startDate;
      const endDate = new Date();

      switch (analyticsRange) {
        case "week":
          startDate = new Date(new Date().setDate(today.getDate() - 7));
          break;
        case "month":
          startDate = new Date(new Date().setMonth(today.getMonth() - 1));
          break;
        case "all_time":
          startDate = new Date(0); // Epoch
          break;
        case "today":
        default:
          startDate = new Date(new Date().setHours(0, 0, 0, 0)); // Start of today
          break;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "get-analytics-data",
          {
            body: {
              shop_id: shop.id,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        );

        if (error) throw error;
        setAnalyticsData(data);
      } catch (error) {
        toast.error("Failed to load analytics data.");
        console.error("Analytics error:", error);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [shop?.id, analyticsRange, supabase]);


  // Memoized color map for barbers in charts (copied from dashboard)
  const barberColorMap = useMemo(() => {
    const VIBRANT_COLORS = [
      "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    ];
    const map: { [key: string]: string } = {};
    // >>> Change 3: Ensure barbers array is populated before trying to map colors
    barbers.forEach((barber, index) => {
      map[barber.name] = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
    });
    return map;
  }, [barbers]); // This dependency is now correctly tracking the fetched 'barbers' state


  if (!shop || isAnalyticsLoading) { // Combined loading check for initial shop AND analytics data
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-primary">Loading analytics...</p>
      </div>
    );
  }

  return (
    <> {/* Use a fragment to wrap the main div and the footer */}
      <div className="container mx-auto p-4 md:p-8 bg-background text-foreground min-h-screen">
        {/* Header - Modified for back button and centering */}
        <motion.header
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="w-full relative p-4 flex items-center justify-between max-w-7xl mx-auto border-b border-border/50 bg-transparent backdrop-blur-sm z-10 sticky top-0"
        >
          <Button variant="ghost" onClick={() => router.back()} className="flex items-center text-[#ff284d]">
            <ChevronLeftCircle className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-[#ff284d] absolute left-1/2 -translate-x-1/2">Analytics</h1>
          <div className="hidden lg:block"></div> {/* Spacer for desktop */}
        </motion.header>

        <motion.div variants={fadeIn} initial="initial" animate="animate">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <h1 className="text-xl font-bold tracking-tight">Analytics for {shop.name}</h1>
            {/* Analytics Range Selector */}
            <div>
              <Select
                value={analyticsRange}
                onValueChange={setAnalyticsRange}
                disabled={isAnalyticsLoading}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all_time">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isAnalyticsLoading ? (
            <p className="text-center text-muted-foreground py-10">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              Loading analytics data...
            </p>
          ) : analyticsData ? (
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
            >
              {/* Key Metrics Cards */}
              <div className="grid grid-flow-col auto-cols-min overflow-x-auto gap-4 pb-4 mb-8 sm:grid-cols-2 lg:grid-cols-3 justify-items-stretch no-scrollbar">
                {/* Total Revenue Card */}
                <motion.div variants={fadeIn} className="flex-shrink-0 w-full max-w-[220px] min-w-[150px]">
                  <Card className="h-28 w-full bg-gradient-to-br from-blue-100 to-blue-200 text-foreground shadow-sm flex flex-col p-4">
                    <CardHeader className="p-0 mb-2 flex-grow">
                      <CardTitle className="text-sm font-semibold text-blue-800">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col justify-end items-end flex-grow px-4 pb-4">
                      <p className="text-xl sm:text-lg md:text-xl font-bold text-blue-900">
                        ${(analyticsData.totalRevenue || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
                {/* Customers Served Card */}
                <motion.div variants={fadeIn} className="flex-shrink-0 w-full max-w-[220px] min-w-[150px]">
                  <Card className="h-28 w-full bg-gradient-to-br from-green-100 to-green-200 text-foreground shadow-sm flex flex-col p-4">
                    <CardHeader className="p-0 mb-2 flex-grow">
                      <CardTitle className="text-sm font-semibold text-green-800">Served</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col justify-end items-end flex-grow px-4 pb-4">
                      <p className="text-xl sm:text-lg md:text-xl font-bold text-green-900">
                        {analyticsData.totalCustomers || 0}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
                {/* No-Show Rate Card */}
                <motion.div variants={fadeIn} className="flex-shrink-0 w-full max-w-[220px] min-w-[150px]">
                  <Card className="h-28 w-full bg-gradient-to-br from-red-100 to-red-200 text-foreground shadow-sm flex flex-col p-4">
                    <CardHeader className="p-0 mb-2 flex-grow">
                      <CardTitle className="text-sm font-semibold text-red-800">No-Show Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col justify-end items-end flex-grow px-4 pb-4">
                      <p className="text-xl sm:text-lg md:text-xl font-bold text-red-900">
                        {(analyticsData.noShowRate || 0).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
              {/* Charts for Revenue and Clients per Staff Member */}
              <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                <motion.div variants={fadeIn}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue per Staff Member</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={analyticsData.barberRevenueData || []}
                          layout="vertical"
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) => `$${value}`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={80}
                          />
                          <Tooltip
                            formatter={(value: number) =>
                              `$${Number(value).toFixed(2)}`
                            }
                          />
                          <Bar dataKey="revenue" name="Total Revenue">
                            {(analyticsData.barberRevenueData || []).map(
                              (entry: { name: string }) => (
                                <Cell
                                  key={`cell-${entry.name}`}
                                  // This is where the color from the map is applied
                                  fill={
                                    barberColorMap[entry.name] ||
                                    "#8884d8" // Fallback color
                                  }
                                />
                              ),
                            )}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={fadeIn}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Clients per Staff Member</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analyticsData.barberClientData || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            fill="#8884d8" // This fill is for the entire pie by default, but cells override it
                            paddingAngle={5}
                            dataKey="clients"
                            nameKey="name"
                            label={({ name, clients }) =>
                              `${name}: ${clients}`
                            }
                          >
                            {(analyticsData.barberClientData || []).map(
                              (entry: { name: string }) => (
                                <Cell
                                  key={`cell-${entry.name}`}
                                  // This is where the color from the map is applied
                                  fill={
                                    barberColorMap[entry.name] ||
                                    "#8884d8" // Fallback color
                                  }
                                />
                              ),
                            )}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <p className="text-center text-muted-foreground">
              No analytics data available for this period.
            </p>
          )}
        </motion.div>
      </div>

      {/* Footer - Added with WaitWise logo */}
      <footer className="mt-16 py-6 text-center text-gray-300 bg-background border-t border-border/50">
        <Image
          src="../Logo.svg" // Make sure you have this SVG file in your public/ directory
          alt="WaitWise Logo"
          width={30} // Adjust width as needed
          height={30} // Adjust height as needed
          className="mx-auto"
          priority
        />
        <p className="text-sm text-muted-foreground mt-2">&copy; {new Date().getFullYear()} WaitWise. All rights reserved.</p>
      </footer>
    </>
  );
}