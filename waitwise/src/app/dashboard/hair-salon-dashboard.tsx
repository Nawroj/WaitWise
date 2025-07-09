// app/dashboard/page.tsx

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../../components/ui/button";
import { CreateShopForm } from "../../components/ui/CreateShopForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Separator } from "../../components/ui/separator";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import {
  Trash2,
  Edit,
  RefreshCw,
  QrCode,
  CreditCard,
  Wand2,
  ListPlus,
  UserPlus,
  MoreVertical,
  Loader2,
  Settings,
  Store,
  Users,
  PauseCircle, // Added for break icon
  ChevronDown, // Added for collapsible
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
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
import QRCode from "qrcode";
import { toast } from "sonner";
import { Switch } from "../../components/ui/switch";
import { motion, easeInOut } from "framer-motion";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StripePaymentForm } from "../../components/ui/StripePaymentForm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible"; // Added Collapsible

// Animation Variants
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

const cardHover = {
  hover: {
    scale: 1.01,
    boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.1)",
    transition: { duration: 0.2 },
  },
};

// Type definitions
type QueueEntry = {
  id: string;
  client_name: string;
  queue_position: number;
  status: "waiting" | "in_progress" | "done" | "no_show";
  created_at: string;
  barbers: { id: string; name: string } | null;
  queue_entry_services:
    | { services: { id: string; name: string; price: number } | null }[]
    | null;
  notification_sent_at: string | null;
};
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
};
type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string | null; // ADDED
  description: string | null; // ADDED
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
type EditSection = "details" | "services" | "staff" | "qr";
type Invoice = {
  id: string;
  month?: string; // Made optional
  amount_due: number;
  amount_paid?: number; // Made optional
  currency?: string; // Made optional
  status: string;
  created_at: string;
  due_date?: string; // Made optional
  stripe_invoice_id?: string | null;
  stripe_charge_id?: string | null;
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // State variables for shop data and UI elements
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeEditSection, setActiveEditSection] =
    useState<EditSection | null>(null); // Controls which edit dialog is open
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false); // Controls billing dialog visibility
  const [editingQueueEntry, setEditingQueueEntry] = useState<QueueEntry | null>(
    null,
  ); // Queue entry being edited
  const [isEditQueueEntryDialogOpen, setIsEditQueueEntryDialogOpen] =
    useState(false); // Controls queue entry edit dialog
  const [editedBarberId, setEditedBarberId] = useState(""); // Correctly define editedBarberId here
  const [barberForBreak, setBarberForBreak] = useState<Barber | null>(null); // Barber for whom break is being set
  const [breakDuration, setBreakDuration] = useState("15"); // Duration for barber break
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false); // Controls barber break dialog

  // States for shop details editing
  const [editedShopName, setEditedShopName] = useState("");
  const [editedShopAddress, setEditedShopAddress] = useState("");
  const [editedOpeningTime, setEditedOpeningTime] = useState("");
  const [editedClosingTime, setEditedClosingTime] = useState("");
  const [newShopLogoFile, setNewShopLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  // States for services management
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState(""); // ADDED
  const [newServiceDescription, setNewServiceDescription] = useState(""); // ADDED

  // States for staff management
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberAvatarFile, setNewBarberAvatarFile] = useState<File | null>(
    null,
  );

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null); // Holds the generated QR code Data URL
  const [totalEventCount, setTotalEventCount] = useState(0); // Total billable events for trial
  const [monthlyBillableEventCount, setMonthlyBillableEventCount] = useState(0); // Billable events for active subscription
  const [showAllCompleted, setShowAllCompleted] = useState(false); // Toggle to show all completed queue entries
  const [showAllNoShows, setShowAllNoShows] = useState(false); // Toggle to show all no-show queue entries
  const [isSmsPaused, setIsSmsPaused] = useState(true); // Toggle for SMS notifications
  const [isUpgrading, setIsUpgrading] = useState(false); // State for upgrade flow in billing dialog
  const [billingEmail, setBillingEmail] = useState(""); // Email for billing
  const [isEmailPromptVisible, setIsEmailPromptVisible] = useState(false); // Prompt for email if not found
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null); // Details of a failed invoice
  const [analyticsRange, setAnalyticsRange] = useState("today"); // Time range for analytics data
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null,
  ); // Fetched analytics data
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true); // Loading state for analytics
  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );

  // Fetches current day's queue entries for the shop
  const fetchQueueData = useCallback(
    async (shopId: string) => {
      if (!shopId) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      const { data, error } = await supabase
        .from("queue_entries")
        .select(
          `*, barbers ( id, name ), notification_sent_at, queue_entry_services ( services ( id, name, price ) )`,
        )
        .eq("shop_id", shopId)
        .gte("created_at", today.toISOString()) // Filter for today's entries
        .order("queue_position");

      if (error) {
        console.error("Error fetching queue:", error);
        return;
      }
      setQueueEntries(data as QueueEntry[]);
    },
    [supabase],
  );

  const generateQRCode = useCallback(async () => {
    if (!shop) return;
    const url = `${window.location.origin}/shop/${shop.id}`;
    try {
      const options = {
        errorCorrectionLevel: "H" as const,
        type: "image/png" as const,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      };
      const dataUrl = await QRCode.toDataURL(url, options);
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code", err);
      toast.error("Could not generate QR code. Please try again.");
    }
  }, [shop]);

  // Fetches shop's services and barbers
  const fetchShopData = useCallback(
    async (shopId: string) => {
      if (!shopId) return;
      const [{ data: servicesData }, { data: barbersData }] = await Promise.all(
        [
          supabase
            .from("services")
            .select("*, category, description") // MODIFIED: Select new fields
            .eq("shop_id", shopId)
            .order("created_at"),
          supabase
            .from("barbers")
            .select("*")
            .eq("shop_id", shopId)
            .order("created_at"),
        ],
      );
      setServices(servicesData as Service[] || []); // Cast to Service[]
      setBarbers((barbersData as Barber[]) || []);
    },
    [supabase],
  );

  // Initial data fetch on component mount: user, shop, queue, services, barbers
  useEffect(() => {
    async function fetchUserAndShop() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login"); // Redirect to login if no user session
        return;
      }
      const { data: shopData } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (shopData) {
        setShop(shopData);
        // Initialize editable shop details with fetched data
        setEditedShopName(shopData.name);
        setEditedShopAddress(shopData.address);
        setEditedOpeningTime(shopData.opening_time || "09:00");
        setEditedClosingTime(shopData.closing_time || "17:00");
        fetchQueueData(shopData.id);
        fetchShopData(shopData.id);
      }
      setLoading(false);
    }
    fetchUserAndShop();
  }, [supabase, router, fetchQueueData, fetchShopData]);

  // Effect to update logo preview when shop details edit dialog opens
  useEffect(() => {
    if (activeEditSection === "details" && shop) {
      setLogoPreviewUrl(shop.logo_url || null);
      setNewShopLogoFile(null); // Reset file input
    }
  }, [activeEditSection, shop]);

  // Fetches usage counts (billable events) for the current shop
  useEffect(() => {
    if (!shop) return;
    const fetchUsageCounts = async () => {
      const today = new Date();
      const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ).toISOString();

      // Fetch total events
      const { count: totalCount, error: totalError } = await supabase
        .from("billable_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop.id);

      if (totalError) {
        console.error("Error fetching total events count:", totalError);
      } else {
        setTotalEventCount(totalCount || 0);
      }

      // Fetch monthly billable events
      const { count: monthlyCount, error: monthlyError } = await supabase
        .from("billable_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("is_billable", true)
        .gte("created_at", firstDayOfMonth);

      if (monthlyError) {
        console.error(
          "Error fetching monthly billable events count:",
          monthlyError,
        );
      } else {
        setMonthlyBillableEventCount(monthlyCount || 0);
      }
    };
    fetchUsageCounts();
  }, [shop, supabase]);

  // Fetches the latest failed invoice if subscription status is 'past_due'
  useEffect(() => {
    if (shop?.subscription_status === "past_due") {
      const fetchFailedInvoice = async () => {
        console.log("Attempting to fetch failed invoice for shop:", shop.id); // Added log
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, amount_due, created_at, status, stripe_charge_id, month, amount_paid, currency, due_date",
          ) // Ensure amount_due is here and all other necessary fields are selected
          .eq("shop_id", shop.id)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching failed invoice:", error); // Log specific error
        } else {
          console.log("Fetched failed invoice data:", data); // See what data is returned
          setFailedInvoice(data);
        }
      };
      fetchFailedInvoice();
    }
  }, [shop, supabase]);

  // Fetches analytics data based on selected range
  useEffect(() => {
    if (!shop) return;
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
          startDate = new Date(0); // Epoch for all time
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
  }, [shop, analyticsRange, supabase]);

  // Real-time subscriptions for queue, barbers, and services updates
  useEffect(() => {
    if (!shop) return;
    const queueChannel = supabase
      .channel(`queue_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "queue_entries",
          filter: `shop_id=eq.${shop.id}`, // Filter for the current shop
        },
        () => fetchQueueData(shop.id),
      )
      .subscribe();
    const barbersChannel = supabase
      .channel(`barbers_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "barbers",
          filter: `shop_id=eq.${shop.id}`, // Filter for the current shop
        },
        () => fetchShopData(shop.id),
      )
      .subscribe();
    const servicesChannel = supabase
      .channel(`services_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "services",
          filter: `shop_id=eq.${shop.id}`, // Filter for the current shop
        },
        () => fetchShopData(shop.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel); // Clean up subscription on unmount
      supabase.removeChannel(barbersChannel); // Clean up subscription on unmount
      supabase.removeChannel(servicesChannel); // Clean up subscription on unmount
    };
  }, [shop, supabase, fetchQueueData, fetchShopData]); // Dependencies for useEffect

  // Auto-generate QR code when the QR section is activated if not already generated
  useEffect(() => {
    if (activeEditSection === "qr" && !qrCodeDataUrl) {
      generateQRCode();
    }
  }, [activeEditSection, qrCodeDataUrl, generateQRCode]);

  // Memoized lists for completed and no-show entries
  const fullCompletedList = useMemo(
    () =>
      queueEntries
        .filter((e) => e.status === "done")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [queueEntries],
  );
  const fullNoShowList = useMemo(
    () =>
      queueEntries
        .filter((e) => e.status === "no_show")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [queueEntries],
  );
  const visibleCompletedList = useMemo(
    () =>
      showAllCompleted ? fullCompletedList : fullCompletedList.slice(0, 5),
    [fullCompletedList, showAllCompleted],
  );
  const visibleNoShowList = useMemo(
    () => (showAllNoShows ? fullNoShowList : fullNoShowList.slice(0, 5)),
    [fullNoShowList, showAllNoShows],
  );

  // Memoized color map for barbers in charts
  const barberColorMap = useMemo(() => {
    const VIBRANT_COLORS = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
    ];
    const map: { [key: string]: string } = {};
    barbers.forEach((barber, index) => {
      map[barber.name] = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
    });
    return map;
  }, [barbers]);

  // Memoized list of barbers who are marked as working today
  const workingBarbers = useMemo(
    () => barbers.filter((b) => b.is_working_today),
    [barbers],
  );

  // Toggles a barber's 'is_working_today' status
  const handleToggleBarberWorkStatus = async (
    barberId: string,
    currentState: boolean,
  ) => {
    const { error } = await supabase
      .from("barbers")
      .update({ is_working_today: !currentState })
      .eq("id", barberId);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
    } else {
      toast.success(`Staff status updated.`);
    }
  };

  // Initiates a break for a selected barber
  const handleStartBreak = async () => {
    if (!barberForBreak || !breakDuration) return;

    const breakEndTime = new Date(Date.now() + parseInt(breakDuration) * 60000); // Calculate break end time

    const { error } = await supabase
      .from("barbers")
      .update({ is_on_break: true, break_end_time: breakEndTime.toISOString() })
      .eq("id", barberForBreak.id);

    if (error) {
      toast.error(`Failed to start break: ${error.message}`);
    } else {
      toast.success(`${barberForBreak.name} is now on a break.`);
      setIsBreakDialogOpen(false);
      setBarberForBreak(null);
    }
  };

  // Ends a break for a barber
  const handleEndBreak = async (barberId: string) => {
    const { error } = await supabase
      .from("barbers")
      .update({ is_on_break: false, break_end_time: null })
      .eq("id", barberId);

    if (error) {
      toast.error(`Failed to end break: ${error.message}`);
    } else {
      toast.success("Break ended. Welcome back!");
    }
  };

  // Handles click on the "Upgrade Now" button in billing
  const handleUpgradeClick = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.email) {
      setBillingEmail(user.email);
      setIsEmailPromptVisible(false); // Hide email prompt if email exists
    } else {
      setIsEmailPromptVisible(true); // Show email prompt if no email
    }
    setIsUpgrading(true); // Show upgrade form
  };

  // Handles submission of billing email
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsEmailPromptVisible(false); // Proceed to payment form
  };

  // Re-queues a client from 'no_show' status
  const handleRequeue = async (entry: QueueEntry) => {
    if (!entry.barbers?.id) {
      toast.error(
        "This client has no assigned staff member and cannot be re-queued.",
      );
      return;
    }
    // Find the current first position in the queue for the barber
    const { data: waitingEntries, error: fetchError } = await supabase
      .from("queue_entries")
      .select("queue_position")
      .eq("barber_id", entry.barbers.id)
      .eq("status", "waiting")
      .order("queue_position", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching waiting queue:", fetchError);
      toast.error("Could not retrieve the current queue. Please try again.");
      return;
    }
    // Set new position to be just before the current first client, or 1 if empty
    const newPosition =
      waitingEntries && waitingEntries.length > 0
        ? waitingEntries[0].queue_position - 1
        : 1;

    const { error: updateError } = await supabase
      .from("queue_entries")
      .update({ status: "waiting", queue_position: newPosition })
      .eq("id", entry.id);

    if (updateError) {
      console.error("Error re-queuing client:", updateError);
      toast.error("Failed to re-queue the client.");
    }
  };

  // Updates the status of a queue entry (e.g., 'in_progress', 'done', 'no_show')
  const handleUpdateStatus = async (
    id: string,
    newStatus: QueueEntry["status"],
  ) => {
    // Create a billable event if status is 'done'
    if (newStatus === "done" && shop) {
      const { error: billableError } = await supabase
        .from("billable_events")
        .insert({ shop_id: shop.id, queue_entry_id: id });
      if (billableError) {
        console.error("Could not create billable event:", billableError);
        toast.warning(
          "Could not log this event for billing. Please contact support.",
        );
      }
    }

    const currentEntry = queueEntries.find((entry) => entry.id === id);
    const barberId = currentEntry?.barbers?.id;

    const { error: updateError } = await supabase
      .from("queue_entries")
      .update({ status: newStatus })
      .eq("id", id);

    if (updateError) {
      toast.error(`Failed to update status: ${updateError.message}`);
      return;
    }

    // Logic to notify the next customer when a client starts being served
    if (newStatus === "in_progress" && barberId && shop) { // Ensure shop is also defined for shop.id
      try {
        // Fetch the current first in queue to get their latest data including notification_sent_at
        const { data: nextInQueue, error: nextError } = await supabase
          .from("queue_entries")
          .select("id, notification_sent_at") // Ensure notification_sent_at is selected
          .eq("barber_id", barberId)
          .eq("status", "waiting")
          .order("queue_position", { ascending: true }) // Get the actual first in queue
          .limit(1)
          .single();

        if (nextError && nextError.code !== "PGRST116") { // PGRST116 means no rows found
          console.error("Error fetching next in queue for notification:", nextError);
          // Do not throw, just log. Allow status update to proceed.
        }

        // Only send if there's a next client AND notification hasn't been sent yet
        if (nextInQueue && !nextInQueue.notification_sent_at) {
          if (!isSmsPaused) { // Check if SMS sending is enabled via dashboard toggle
            console.log(`Live SMS Enabled: Found user ${nextInQueue.id} at position 1. Sending notification...`);
            const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
              "notify-customer",
              {
                body: {
                  entity_id: nextInQueue.id, // MODIFIED: Send generic entity_id (the queue entry ID)
                  type: 'queue',              // MODIFIED: Specify type as 'queue'
                },
              },
            );

            if (invokeError) {
              toast.error(`Failed to send SMS notification: ${invokeError.message}`);
              console.error("SMS notification invoke error:", invokeError);
            } else {
              // The Edge Function returns a message indicating success or skip (if phone missing/invalid)
              if (invokeData?.message?.includes("skipped")) {
                toast.info(`SMS skipped for client ${nextInQueue.id}: ${invokeData.message}`);
              } else {
                toast.success("Notification sent to the next client in the queue!");
              }
            }
          } else {
            console.log(`SMS Paused: Would have sent notification to user ${nextInQueue.id}`);
            toast.info("SMS is paused. Notification not sent.");
          }
        } else if (nextInQueue?.notification_sent_at) {
          console.log(`Notification for client ${nextInQueue.id} already sent. Skipping re-send.`);
          toast.info("Notification for this client has already been sent.");
        }
      } catch (error: unknown) {
        console.error("Unexpected error in notification logic:", error);
        let errorMessage = "An unexpected error occurred.";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(`An unexpected error occurred during notification: ${errorMessage}`);
      }
    }
  };

  // Logs out the current user
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Deletes a queue entry permanently
  const handleDeleteFromQueue = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this entry?"))
      return;
    try {
      await supabase.from("queue_entries").delete().eq("id", id).throwOnError();
    } catch (error) {
      console.error("Delete queue entry error:", error);
      toast.error("Could not delete this entry.");
    }
  };

  // Opens the dialog to edit a queue entry's assigned barber
  const handleOpenEditDialog = (entry: QueueEntry) => {
    if (entry.barbers) {
      setEditingQueueEntry(entry);
      setEditedBarberId(entry.barbers.id); // Pre-select current barber
      setIsEditQueueEntryDialogOpen(true);
    } else {
      toast.error("This entry has no staff member assigned to edit.");
    }
  };

  // Updates a queue entry's assigned barber
  const handleUpdateQueueEntry = async () => {
    if (!editingQueueEntry) return;
    const { error } = await supabase
      .from("queue_entries")
      .update({ barber_id: editedBarberId })
      .eq("id", editingQueueEntry.id);
    if (error) {
      toast.error(`Error updating staff member: ${error.message}`);
      return;
    }
    setIsEditQueueEntryDialogOpen(false);
    setEditingQueueEntry(null);
  };

  // Handles updating shop details (name, address, times, logo)
  const handleUpdateShopDetails = async () => {
    if (!shop) return;

    toast.loading("Updating shop details...");

    let logoUrlToUpdate = shop.logo_url;

    if (newShopLogoFile) {
      const file = newShopLogoFile;
      const fileExt = file.name.split(".").pop();
      const filePath = `${shop.id}/logo/logo.${fileExt}`;

      // Upload new logo or update existing one
      const { error: uploadError } = await supabase.storage
        .from("shop-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.dismiss();
        toast.error(`Logo upload failed: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage
        .from("shop-logos")
        .getPublicUrl(filePath);
      // Add a timestamp to bust browser cache for the image
      logoUrlToUpdate = `${data.publicUrl}?t=${new Date().getTime()}`;
    }

    // Update shop details in the database
    const { data: updatedShop, error } = await supabase
      .from("shops")
      .update({
        name: editedShopName,
        address: editedShopAddress,
        opening_time: editedOpeningTime,
        closing_time: editedClosingTime,
        logo_url: logoUrlToUpdate,
      })
      .eq("id", shop.id)
      .select()
      .single();

    toast.dismiss();

    if (error) {
      toast.error(`Failed to update shop details: ${error.message}`);
      return;
    }

    if (updatedShop) {
      setShop(updatedShop);
      toast.success("Shop details updated!");
      setActiveEditSection(null);
      setNewShopLogoFile(null);
      setLogoPreviewUrl(null);
    }
  };

  // Handles deleting the shop logo
  const handleDeleteLogo = async () => {
    if (!shop || !shop.logo_url) return;

    if (
      !confirm("Are you sure you want to permanently delete your shop logo?")
    ) {
      return;
    }

    toast.loading("Deleting logo...");

    try {
      // Extract the file path from the full URL to delete from storage
      const logoPath = shop.logo_url.split("/shop-logos/")[1].split("?")[0];
      const { error: storageError } = await supabase.storage
        .from("shop-logos")
        .remove([logoPath]);

      if (storageError) {
        // If the file doesn't exist in storage, we can ignore the error and still update the DB
        if (storageError.message !== "The resource was not found") {
          throw storageError;
        }
      }

      // Set the logo_url in the database to null
      const { data: updatedShop, error: dbError } = await supabase
        .from("shops")
        .update({ logo_url: null })
        .eq("id", shop.id)
        .select()
        .single();

      if (dbError) throw dbError;

      // Update the local state to reflect the change and close the dialog
      setShop(updatedShop);
      setLogoPreviewUrl(null);
      setActiveEditSection(null);

      toast.dismiss();
      toast.success("Logo deleted successfully!");
    } catch (error: unknown) {
      // 'error' is now 'unknown'
      toast.dismiss();
      let errorMessage = "An unexpected error occurred."; // Default message
      if (error instanceof Error) {
        // Type guard: check if 'error' is an instance of 'Error'
        errorMessage = error.message; // Now it's safe to access .message
      }
      toast.error(`Failed to delete logo: ${errorMessage}`);
      console.error("Delete logo error:", error);
    }
  };

  // Adds a new service to the shop
  const handleAddService = async () => {
    if (!shop || !newServiceName || !newServicePrice || !newServiceDuration)
      return;
    const { error } = await supabase
      .from("services")
      .insert({
        name: newServiceName,
        price: parseFloat(newServicePrice),
        duration_minutes: parseInt(newServiceDuration),
        category: newServiceCategory || null, // ADDED
        description: newServiceDescription || null, // ADDED
        shop_id: shop.id,
      });
    if (!error) {
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceDuration("");
      setNewServiceCategory(""); // ADDED
      setNewServiceDescription(""); // ADDED
      toast.success("Service added!");
    } else {
      toast.error("Failed to add service.");
    }
  };

  // Deletes a service
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await supabase
        .from("services")
        .delete()
        .eq("id", serviceId)
        .throwOnError();
      toast.success("Service deleted.");
    } catch (error) {
      console.error("Delete service error:", error);
      toast.error(
        "Could not delete service. It may be linked to historical queue entries.",
      );
    }
  };

  // Retries a failed payment
  const handleRetryPayment = async () => {
    if (!shop || !failedInvoice) return;

    // Initial check: if no Stripe payment method is associated with the shop
    // This is a simplified check. A more robust system would rely on webhooks
    // to keep the payment_method_id up-to-date or check Stripe directly.
    if (shop.stripe_payment_method_id === null) {
      toast.error("No payment method found on file. Please add or update it.", {
        action: {
          label: "Update Method",
          onClick: () => {
            setIsBillingDialogOpen(true);
            setIsUpgrading(true); // Open the billing dialog to the payment method section
          },
        },
        id: "no-payment-method", // Unique ID to dismiss this specific toast
      });
      return;
    }

    toast.loading("Retrying payment...", { id: "retry-payment-toast" });

    try {
      // Call the Supabase Edge Function
      const { error: invokeError } = await supabase.functions.invoke(
        "retry-payment",
        {
          body: { shop_id: shop.id },
        },
      );

      toast.dismiss("retry-payment-toast");

      if (invokeError) {
        console.error(
          "Error invoking retry-payment function:",
          invokeError.message,
        );

        // Parse specific error messages from the Edge Function
        let userMessage =
          "Failed to process payment. Please try again or update your payment method.";
        let actionLabel = "Update Method";
        let actionOnClick = () => {
          setIsBillingDialogOpen(true);
          setIsUpgrading(true);
        };

        // The Edge Function returns a JSON with an 'error' field
        const parsedError = invokeError.message; // Assuming invokeError.message holds the JSON string or relevant error

        // You might need more sophisticated parsing here if invokeError.message
        // is not always a clean string. For now, we'll check for keywords.
        if (parsedError.includes("Payment declined")) {
          userMessage = "Payment declined. Please update your payment method.";
        } else if (parsedError.includes("No payment method on file")) {
          userMessage = "No payment method found. Please add one.";
        } else if (parsedError.includes("already paid")) {
          userMessage =
            "Invoice was already paid. Your account should be active.";
          actionLabel = "Close"; // No need to update method
          actionOnClick = () => setIsBillingDialogOpen(false);
        } else if (parsedError.includes("Cannot retry payment")) {
          userMessage =
            "This invoice cannot be retried. Please check your billing settings.";
          actionLabel = "Go to Billing";
        }

        toast.error(userMessage, {
          action: {
            label: actionLabel,
            onClick: actionOnClick,
          },
        });
      } else {
        // Successful payment
        toast.success("Payment successful! Your account is now active.");
        // Refresh shop data to update subscription status and clear failed invoice
        const { data: updatedShop, error: shopRefreshError } = await supabase
          .from("shops")
          .select("*")
          .eq("id", shop.id)
          .single();
        if (shopRefreshError) {
          console.error(
            "Error refreshing shop data after successful retry:",
            shopRefreshError,
          );
          toast.error(
            "Account updated, but failed to refresh shop data in dashboard.",
          );
        } else if (updatedShop) {
          setShop(updatedShop);
          setFailedInvoice(null); // Clear failed invoice info
        }
        setIsBillingDialogOpen(false); // Close the billing dialog on success
      }
    } catch (error: unknown) {
      toast.dismiss("retry-payment-toast");
      console.error("Unexpected error during payment retry:", error);
      toast.error("An unexpected error occurred during payment retry.");
    }
  };

  // Adds a new barber (staff member)
  const handleAddBarber = async () => {
    if (!shop || !newBarberName) return;
    let avatarUrl: string | null = null;
    if (newBarberAvatarFile) {
      const file = newBarberAvatarFile;
      const fileExt = file.name.split(".").pop();
      const filePath = `${shop.id}/${Date.now()}.${fileExt}`; // Unique path for each avatar

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);
      if (uploadError) {
        toast.error("Error uploading avatar. Please try again.");
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      avatarUrl = data.publicUrl;
    }
    const { error } = await supabase
      .from("barbers")
      .insert({ name: newBarberName, avatar_url: avatarUrl, shop_id: shop.id });
    if (!error) {
      setNewBarberName("");
      setNewBarberAvatarFile(null);
      // Clear the file input visually
      const fileInput = document.getElementById(
        "new-barber-avatar",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      toast.success("Staff member added!");
    } else {
      toast.error("Failed to add staff member.");
    }
  };

  // Deletes a barber
  const handleDeleteBarber = async (barberId: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await supabase.from("barbers").delete().eq("id", barberId).throwOnError();
      toast.success("Staff member deleted.");
    } catch (error) {
      console.error("Delete barber error:", error);
      toast.error(
        "Could not delete staff member. They may be linked to historical queue entries.",
      );
    }
  };

  // Group services by category for collapsible display
  const categorizedServices = useMemo(() => {
    return services.reduce((acc, service) => {
      const category = service.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {} as Record<string, Service[]>);
  }, [services]);

  // Renders the content for different edit dialog sections
  const renderEditDialogContent = () => {
    if (!activeEditSection) return null;

    switch (activeEditSection) {
      case "details":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Edit Shop Details</DialogTitle>
              <DialogDescription>
                Update your shop&apos;s name, address, logo and opening hours.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="grid gap-4 pt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shop-name-edit">Shop Name</Label>
                    <Input
                      id="shop-name-edit"
                      value={editedShopName}
                      onChange={(e) => setEditedShopName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shop Logo</Label>
                    {/* Display current logo or placeholder */}
                    {logoPreviewUrl ? (
                      <Image
                        src={logoPreviewUrl}
                        alt="Logo Preview"
                        width={80}
                        height={80}
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {/* File input for new logo */}
                      <Input
                        id="shop-logo-edit"
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="flex-grow"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewShopLogoFile(file);
                            setLogoPreviewUrl(URL.createObjectURL(file)); // Create preview URL
                          } else {
                            setNewShopLogoFile(null);
                            setLogoPreviewUrl(shop?.logo_url || null); // Revert to existing logo if file cleared
                          }
                        }}
                      />
                      {/* Button to delete existing logo */}
                      {shop?.logo_url && (
                        <Button
                          variant="destructive"
                          type="button"
                          onClick={handleDeleteLogo}
                          title="Delete logo"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete Logo</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shop-address-edit">Shop Address</Label>
                    <Input
                      id="shop-address-edit"
                      value={editedShopAddress}
                      onChange={(e) => setEditedShopAddress(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="opening-time">Opening Time</Label>
                      <Input
                        id="opening-time"
                        type="time"
                        value={editedOpeningTime}
                        onChange={(e) => setEditedOpeningTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="closing-time">Closing Time</Label>
                      <Input
                        id="closing-time"
                        type="time"
                        value={editedClosingTime}
                        onChange={(e) => setEditedClosingTime(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleUpdateShopDetails}>Save Changes</Button>
            </DialogFooter>
          </>
        );
      case "qr":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Shop QR Code</DialogTitle>
              <DialogDescription>
                Customers can scan this code to go directly to your booking
                page.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center justify-center gap-4 pt-4">
                  {/* Display QR code or loading message */}
                  {qrCodeDataUrl ? (
                    <Image
                      src={qrCodeDataUrl}
                      alt="Shop QR Code"
                      width={192}
                      height={192}
                      className="border rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 border rounded-lg bg-muted flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Generating...
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={generateQRCode} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                    {qrCodeDataUrl && (
                      <a
                        href={qrCodeDataUrl}
                        download={`${editedShopName}-QRCode.png`}
                      >
                        <Button>Download</Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        );
      case "services":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Manage Services</DialogTitle>
              <DialogDescription>
                Add, remove, and edit the services your shop offers.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="pt-4">
                  {/* Table to display existing services */}
                  {services.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(categorizedServices).map(([category, itemsInCategory], index) => (
                        <Collapsible key={category} className="space-y-2" defaultOpen={index === 0}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-muted/80 transition-colors">
                              <h3 className="text-lg font-bold">{category}</h3>
                              <ChevronDown className="h-5 w-5 ui-open:rotate-180 transition-transform" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Description</TableHead> {/* ADDED */}
                                  <TableHead>Price</TableHead>
                                  <TableHead>Mins</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {itemsInCategory.map((s) => (
                                  <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{s.description || 'N/A'}</TableCell> {/* ADDED */}
                                    <TableCell>${s.price}</TableCell>
                                    <TableCell>{s.duration_minutes}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteService(s.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-6 border-2 border-dashed rounded-lg">
                      <ListPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">
                        No Services Added Yet
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add your first service below to make it available for
                        customers.
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 items-end pt-6">
                  {/* Form to add new service */}
                  <div className="grid gap-1.5 flex-grow min-w-[120px]">
                    <Label htmlFor="new-service-name">New Service Name</Label>
                    <Input
                      id="new-service-name"
                      placeholder="e.g., Haircut"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 flex-grow min-w-[120px]">
                    <Label htmlFor="new-service-category">Category (Optional)</Label> {/* ADDED */}
                    <Input
                      id="new-service-category"
                      placeholder="e.g., Men's, Women's, Kids"
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 w-full"> {/* Changed to full width for description */}
                    <Label htmlFor="new-service-description">Description (Optional)</Label> {/* ADDED */}
                    <Input
                      id="new-service-description"
                      placeholder="Short description of the service"
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 w-24">
                    <Label htmlFor="new-service-price">Price</Label>
                    <Input
                      id="new-service-price"
                      type="number"
                      placeholder="$"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 w-24">
                    <Label htmlFor="new-service-duration">Mins</Label>
                    <Input
                      id="new-service-duration"
                      type="number"
                      placeholder="Time"
                      value={newServiceDuration}
                      onChange={(e) => setNewServiceDuration(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddService}>Add</Button>
                </CardFooter>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        );
      case "staff":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Manage Staff</DialogTitle>
              <DialogDescription>
                Add, remove, and set which staff members are working today.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="pt-4">
                  {/* Table to display existing staff members */}
                  {barbers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead className="text-center">
                            On Break
                          </TableHead>
                          <TableHead className="text-center">
                            Working Today
                          </TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {barbers.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="flex items-center gap-4">
                              <Avatar>
                                <AvatarImage
                                  src={b.avatar_url || undefined}
                                  alt={b.name}
                                />
                                <AvatarFallback>
                                  {b.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              {b.name}
                            </TableCell>
                            <TableCell className="text-center">
                              {/* Toggle for "On Break" status */}
                              <Switch
                                checked={b.is_on_break}
                                onCheckedChange={(isChecked) => {
                                  if (isChecked) {
                                    setBarberForBreak(b); // Set barber for break dialog
                                    setIsBreakDialogOpen(true);
                                  } else {
                                    handleEndBreak(b.id);
                                  }
                                }}
                                disabled={!b.is_working_today} // Can only go on break if working
                                aria-label={`Toggle break status for ${b.name}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {/* Toggle for "Working Today" status */}
                              <Switch
                                checked={b.is_working_today}
                                onCheckedChange={() =>
                                  handleToggleBarberWorkStatus(
                                    b.id,
                                    b.is_working_today,
                                  )
                                }
                                aria-label={`Toggle work status for ${b.name}`}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {/* Button to delete staff member */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:text-destructive"
                                onClick={() => handleDeleteBarber(b.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center p-6 border-2 border-dashed rounded-lg">
                      <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">
                        No Staff Added Yet
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add your first staff member below.
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-4 items-start pt-6">
                  {/* Form to add new staff member */}
                  <div className="grid gap-1.5 w-full">
                    <Label htmlFor="new-barber-name">
                      New Staff Member Name
                    </Label>
                    <Input
                      id="new-barber-name"
                      placeholder="e.g., John Smith"
                      value={newBarberName}
                      onChange={(e) => setNewBarberName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 w-full">
                    <Label htmlFor="new-barber-avatar">Avatar</Label>
                    <Input
                      id="new-barber-avatar"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files &&
                        setNewBarberAvatarFile(e.target.files[0])
                      }
                    />
                  </div>
                  <Button onClick={handleAddBarber}>Add Staff Member</Button>
                </CardFooter>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  };

  // Display loading spinner while data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no shop is created yet, show the CreateShopForm
  if (!shop) {
    return <CreateShopForm onShopCreated={setShop} />;
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 bg-background text-foreground min-h-screen">
        {/* Dashboard Header */}
        <motion.header
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-border/50"
        >
          {/* Container for Shop Name/Logo and Usage */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {/* Shop Name/Logo and Mobile Dropdown (on the same line) */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                {shop.logo_url ? (
                  <div className="h-12 flex items-center">
                    <Image
                      src={shop.logo_url}
                      alt={`${shop.name} Logo`}
                      width={144}
                      height={36}
                      className="object-contain dark:invert"
                      priority
                    />
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {shop.name}
                  </h1>
                )}
              </div>

              {/* Mobile Navigation - MOVED HERE to be alongside name */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="focus:bg-transparent"
                    >
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="sms-mode-mobile">Live SMS</Label>
                        <Switch
                          id="sms-mode-mobile"
                          checked={!isSmsPaused}
                          onCheckedChange={(checked) => setIsSmsPaused(!checked)}
                        />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => window.open(`/shop/${shop.id}`, "_blank")}
                    >
                      Join Queue Page
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setActiveEditSection("details")}
                    >
                      Edit Shop Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setActiveEditSection("staff")}
                    >
                      Manage Staff
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setActiveEditSection("services")}
                    >
                      Manage Services
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection("qr")}>
                      Get QR Code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsBillingDialogOpen(true)}>
                      Billing & Subscription
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleLogout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Usage Display - This will now be on the line below the name and dots */}
            <div className="bg-card text-card-foreground p-3 rounded-lg border border-border mt-2 md:mt-0">
              {(() => {
                if (totalEventCount < 50) {
                  const remaining = 50 - totalEventCount;
                  return (
                    <p className="text-sm">
                      <span className="font-bold text-primary">{remaining}</span> free trial usages remaining.
                    </p>
                  );
                } else if (
                  shop.subscription_status === "trial" ||
                  shop.subscription_status === null
                ) {
                  return (
                    <p className="text-sm font-semibold text-destructive">
                      <span className="font-bold">0</span> free trial usages remaining. Please upgrade!
                    </p>
                  );
                } else {
                  return (
                    <p className="text-sm">
                      <span className="font-bold text-primary">{monthlyBillableEventCount}</span> billable clients this month.
                    </p>
                  );
                }
              })()}
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Live SMS Toggle */}
            <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent transition-colors">
              <Switch
                id="sms-mode"
                checked={!isSmsPaused}
                onCheckedChange={(checked) => setIsSmsPaused(!checked)}
              />
              <Label htmlFor="sms-mode">Live SMS</Label>
            </div>
            <Link href={`/shop/${shop.id}`} target="_blank">
              <Button
                variant="outline"
                className="hover:text-primary hover:border-primary transition-colors"
              >
                Join Queue
              </Button>
            </Link>
            <Button
              variant="outline"
              className="hover:text-primary hover:border-primary transition-colors"
              onClick={() => setIsBillingDialogOpen(true)}
            >
              Billing
            </Button>
            {/* Edit Shop Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="transition-transform hover:scale-105">
                  Edit Shop <Settings className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setActiveEditSection("details")}
                >
                  <Store className="mr-2 h-4 w-4" />
                  Shop Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setActiveEditSection("staff")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Staff
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setActiveEditSection("services")}
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  Manage Services
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveEditSection("qr")}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Get QR Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              className="hover:text-primary transition-colors"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </motion.header>

        {/* Payment Problem Alert */}
        <motion.div variants={fadeIn} initial="initial" animate="animate">
          {shop.subscription_status === "past_due" && (
            <div
              className="p-4 mb-6 text-destructive-foreground bg-destructive rounded-md"
              role="alert"
            >
              <h3 className="font-bold">Payment Problem</h3>
              <p>
                We were unable to process your last payment. Please update your
                payment method in the billing section to restore full access.
              </p>
              {/* Add a retry button here */}
              <Button
                onClick={handleRetryPayment}
                className="mt-3 bg-white text-destructive hover:bg-gray-100 border border-destructive"
              >
                Retry Payment
              </Button>
            </div>
          )}
        </motion.div>

        {/* Billing Dialog */}
        <Dialog
          open={isBillingDialogOpen}
          onOpenChange={(isOpen) => {
            // Reset states when billing dialog closes
            if (!isOpen) {
              setIsUpgrading(false);
              setIsEmailPromptVisible(false);
              setBillingEmail("");
            }

            setIsBillingDialogOpen(isOpen);
          }}
        >
          <DialogContent className="grid grid-rows-[auto_1fr_auto] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Billing & Subscription</DialogTitle>
            </DialogHeader>
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
              className="py-4 pr-6 overflow-y-auto"
            >
              {shop.subscription_status === "trial" ||
              shop.subscription_status === null ? (
                // Content for trial users
                <motion.div variants={fadeIn} className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Current Plan</p>
                      <p className="text-2xl font-bold capitalize">Trial</p>
                    </div>
                    {!isUpgrading && (
                      <Button
                        onClick={handleUpgradeClick}
                        className="transition-transform hover:scale-105"
                      >
                        <CreditCard className="mr-2 h-4 w-4" /> Upgrade Now
                      </Button>
                    )}
                  </div>
                  {isUpgrading && (
                    <motion.div variants={fadeIn} className="pt-4">
                      {isEmailPromptVisible ? (
                        // Prompt for billing email if not available
                        <form
                          onSubmit={handleEmailSubmit}
                          className="space-y-4"
                        >
                          <DialogDescription>
                            Your account doesn&apos;t have an email. Please
                            provide a billing email address to continue.
                          </DialogDescription>
                          <div className="grid gap-2">
                            <Label htmlFor="billing-email">Billing Email</Label>
                            <Input
                              id="billing-email"
                              type="email"
                              placeholder="you@example.com"
                              value={billingEmail}
                              onChange={(e) => setBillingEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full">
                            Save and Continue
                          </Button>
                        </form>
                      ) : (
                        // Square Payment Form for new subscriptions
                        <>
                          <DialogDescription className="mb-4">
                            To upgrade to our Pay-as-you-go plan, please add a
                            payment method.
                          </DialogDescription>
                          <Elements stripe={stripePromise}>
                            <StripePaymentForm
                              billingEmail={billingEmail}
                              onSuccess={async () => {
                                // Proper onSuccess implementation for trial upgrade
                                toast.success(
                                  "Upgrade successful! Your payment method has been saved.",
                                );
                                // Crucially, refetch the shop data to update subscription_status
                                const {
                                  data: updatedShop,
                                  error: shopRefreshError,
                                } = await supabase
                                  .from("shops")
                                  .select("*")
                                  .eq("id", shop.id)
                                  .single();
                                if (shopRefreshError) {
                                  console.error(
                                    "Error refreshing shop data after upgrade:",
                                    shopRefreshError,
                                  );
                                  toast.error(
                                    "Account updated, but failed to refresh shop data.",
                                  );
                                } else if (updatedShop) {
                                  setShop(updatedShop);
                                }
                                setIsBillingDialogOpen(false); // Close the dialog
                              }}
                              onFailure={(errorMsg) => {
                                toast.error(errorMsg);
                              }}
                              shopId={shop.id}
                            />
                          </Elements>
                        </>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                // Content for active/past_due subscribers
                <motion.div variants={fadeIn} className="space-y-4">
                  {shop.subscription_status === "past_due" && failedInvoice && (
                    // Display details of failed payment
                    <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
                      <p className="font-bold">Payment Failed</p>
                      <p className="text-sm">
                        Your payment of ${" "}
                        {(failedInvoice.amount_due / 100).toFixed(2)} on{" "}
                        {new Date(
                          failedInvoice.created_at,
                        ).toLocaleDateString()}{" "}
                        was declined.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Current Plan</p>
                      <p className="text-2xl font-bold capitalize">
                        {shop.subscription_status}
                      </p>
                    </div>
                    {shop.subscription_status === "active" ? (
                      <Badge variant="default" className="bg-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Past Due</Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {shop.subscription_status === "past_due"
                      ? "Please update your payment method to automatically retry the payment and restore service."
                      : "You have a payment method on file."}
                  </p>

                  <Button
                    variant="outline"
                    className="w-full hover:text-primary hover:border-primary"
                    onClick={async () => {
                      // Make this async to fetch email
                      if (!isUpgrading) {
                        // Only fetch email if opening the form
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (user && user.email) {
                          setBillingEmail(user.email);
                          setIsEmailPromptVisible(false);
                        } else {
                          setIsEmailPromptVisible(true);
                          setBillingEmail(""); // Clear if no email found
                        }
                      }
                      setIsUpgrading(!isUpgrading);
                    }}
                  >
                    {isUpgrading ? "Close Form" : "Update Payment Method"}
                  </Button>

                  {isUpgrading && (
                    <motion.div variants={fadeIn} className="pt-4">
                      <Elements stripe={stripePromise}>
                        <StripePaymentForm
                          billingEmail={billingEmail}
                          onSuccess={async () => {
                            // Proper onSuccess implementation for trial upgrade
                            toast.success(
                              "Upgrade successful! Your payment method has been saved.",
                            );
                            // Crucially, refetch the shop data to update subscription_status
                            const {
                              data: updatedShop,
                              error: shopRefreshError,
                            } = await supabase
                              .from("shops")
                              .select("*")
                              .eq("id", shop.id)
                              .single();
                            if (shopRefreshError) {
                              console.error(
                                "Error refreshing shop data after upgrade:",
                                shopRefreshError,
                              );
                              toast.error(
                                "Account updated, but failed to refresh shop data.",
                              );
                            } else if (updatedShop) {
                              setShop(updatedShop);
                            }
                            setIsBillingDialogOpen(false); // Close the dialog
                          }}
                          onFailure={(errorMsg) => {
                            toast.error(errorMsg);
                          }}
                          shopId={shop.id}
                        />
                      </Elements>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Universal Edit Dialog */}
        <Dialog
          open={!!activeEditSection}
          onOpenChange={(isOpen) => !isOpen && setActiveEditSection(null)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {renderEditDialogContent()}
          </DialogContent>
        </Dialog>

        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn}>
            <Separator className="my-8 bg-border/50" />
          </motion.div>

          {/* Setup Guide or Live Queue */}
          {loading === false && barbers.length === 0 ? (
            // Display setup guide if no barbers are added yet
            <motion.div variants={fadeIn}>
              <Card className="mt-8 bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Wand2 className="h-6 w-6" />
                    Welcome! Let&apos;s Get You Set Up.
                  </CardTitle>
                  <CardDescription>
                    Your live queue view will appear here once you&apos;ve added
                    your staff members.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <motion.div
                    initial="initial"
                    animate="animate"
                    variants={staggerContainer}
                    className="space-y-4"
                  >
                    <p className="font-semibold">Follow these simple steps:</p>
                    {[
                      {
                        title: 'Click "Edit Shop"',
                        description:
                          'Open the main settings panel by clicking the "Edit Shop" button in the top-right corner.',
                      },
                      {
                        title: "Add Services & Staff",
                        description:
                          "In the dialog, add the services you offer and the staff members on your team. Each staff member will get their own dedicated queue.",
                      },
                      {
                        title: "Share Your QR Code",
                        description:
                          'Generate your shop\'s unique QR code from the "Edit Shop" panel and share it with your customers so they can join the queue!',
                      },
                    ].map((step, i) => (
                      <motion.div
                        key={i}
                        variants={fadeIn}
                        className="flex items-start gap-4 p-4 bg-muted rounded-lg"
                      >
                        <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <h4 className="font-bold">{step.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // Display live queue and analytics if barbers exist
            <>
              {/* Live Queue Section */}
              <motion.div
                initial="initial"
                animate="animate"
                variants={staggerContainer}
                className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              >
                {workingBarbers.map((barber) => {
                  const barberQueue = queueEntries.filter(
                    (entry) => entry.barbers?.id === barber.id,
                  );
                  const waitingForBarber = barberQueue.filter(
                    (entry) => entry.status === "waiting",
                  );
                  const inProgressWithBarber = barberQueue.find(
                    (entry) => entry.status === "in_progress",
                  );
                  return (
                    <motion.div
                      key={barber.id}
                      variants={fadeIn}
                      className="space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                          <Avatar className="h-8 w-8 border-2 border-border">
                            <AvatarImage src={barber.avatar_url || ""} />
                            <AvatarFallback>
                              {barber.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {barber.name}
                        </h2>
                        {barber.is_on_break && (
                          <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <PauseCircle className="h-3 w-3" /> ON BREAK
                            </Badge>
                          </motion.div>
                        )}
                      </div>
                      <motion.div
                        variants={cardHover}
                        whileHover="hover"
                        className={`transition-all duration-300 ${inProgressWithBarber ? "border-primary shadow-primary/10 shadow-lg" : "border-border bg-card"}`}
                      >
                        {/* The Card component itself is now a child of motion.div */}
                        <Card className="h-full w-full">
                          {inProgressWithBarber ? (
                            <>
                              <CardHeader>
                                <CardTitle className="flex justify-between items-start">
                                  <span>{inProgressWithBarber.client_name}</span>
                                  <Badge className="bg-primary text-primary-foreground">
                                    In Progress
                                  </Badge>
                                </CardTitle>
                                <CardDescription>
                                  Services:{" "}
                                  {inProgressWithBarber.queue_entry_services
                                    ?.map((item) => item.services?.name)
                                    .filter(Boolean)
                                    .join(", ") || "N/A"}
                                </CardDescription>
                              </CardHeader>
                              <CardFooter className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 transition-transform hover:scale-105"
                                  onClick={() =>
                                    handleUpdateStatus(
                                      inProgressWithBarber.id,
                                      "done",
                                    )
                                  }
                                >
                                  Mark as Done
                                </Button>
                              </CardFooter>
                            </>
                          ) : (
                            <CardContent className="pt-6">
                              <p className="text-sm text-center text-muted-foreground">
                                Available
                              </p>
                            </CardContent>
                          )}
                        </Card>
                      </motion.div>
                      <Separator className="bg-border/50" />
                      <motion.div
                        initial="initial"
                        animate="animate"
                        variants={staggerContainer}
                        className="space-y-2"
                      >
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Badge variant="secondary">
                            {waitingForBarber.length}
                          </Badge>
                          Waiting
                        </h3>
                        {waitingForBarber.map((entry, index) => (
                          <motion.div key={entry.id} variants={fadeIn}>
                            <motion.div
                              variants={cardHover}
                              whileHover="hover"
                              whileTap={{ scale: 0.98 }}
                              className="bg-card border-border transition-all hover:border-border/50 hover:-translate-y-1 cursor-pointer"
                            >
                              {/* The Card component itself is now a child of motion.div */}
                              <Card className="h-full w-full">
                                <CardHeader className="p-4">
                                  <CardTitle className="text-base flex justify-between items-start">
                                    <span className="font-semibold">
                                      {index + 1}. {entry.client_name}
                                      <span className="text-muted-foreground text-xs ml-2">
                                        with {entry.barbers?.name || "N/A"}
                                      </span>
                                    </span>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 hover:text-primary transition-colors"
                                        onClick={() =>
                                          handleOpenEditDialog(entry)
                                        }
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 hover:text-destructive transition-colors"
                                        onClick={() =>
                                          handleUpdateStatus(entry.id, "no_show")
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                                        onClick={() =>
                                          handleUpdateStatus(
                                            entry.id,
                                            "in_progress",
                                          )
                                        }
                                        disabled={
                                          !!inProgressWithBarber ||
                                          barber.is_on_break ||
                                          shop.subscription_status ===
                                            "past_due" ||
                                          (totalEventCount >= 50 &&
                                            (shop.subscription_status ===
                                              "trial" ||
                                              shop.subscription_status === null))
                                        }
                                      >
                                        Start
                                      </Button>
                                    </div>
                                  </CardTitle>
                                  <CardDescription className="text-xs pt-1">
                                    {entry.queue_entry_services
                                      ?.map((item) => item.services?.name)
                                      .filter(Boolean)
                                      .join(", ") || "No services listed"}
                                  </CardDescription>
                                </CardHeader>
                              </Card>
                            </motion.div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>
              {/* Completed and No-Show Lists */}
              <motion.div
                initial="initial"
                animate="animate"
                variants={staggerContainer}
                className="mt-8 grid gap-8 grid-cols-1 lg:grid-cols-2 xl:col-span-3"
              >
                <motion.div variants={fadeIn}>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>Completed Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {visibleCompletedList.length > 0 ? (
                        <div className="space-y-4">
                          {visibleCompletedList.map((entry, index) => (
                            <motion.div
                              key={entry.id}
                              variants={fadeIn}
                              className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/20"
                            >
                              <p>
                                {index + 1}. {entry.client_name}{" "}
                                <span className="text-muted-foreground">
                                  with {entry.barbers?.name || "N/A"}
                                </span>
                              </p>
                              <Badge variant={"default"}>Done</Badge>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground">
                          No clients have been marked as done yet.
                        </p>
                      )}
                      {fullCompletedList.length > 5 && !showAllCompleted && (
                        <Button
                          variant="link"
                          className="w-full mt-4 hover:text-primary"
                          onClick={() => setShowAllCompleted(true)}
                        >
                          See all {fullCompletedList.length}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={fadeIn}>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>No-Shows</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {visibleNoShowList.length > 0 ? (
                        <div className="space-y-4">
                          {visibleNoShowList.map((entry, index) => (
                            <motion.div
                              key={entry.id}
                              variants={fadeIn}
                              className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/20"
                            >
                              <p>
                                {index + 1}. {entry.client_name}{" "}
                                <span className="text-muted-foreground">
                                  with {entry.barbers?.name || "N/A"}
                                </span>
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant={"secondary"}>No Show</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-primary"
                                  title="Re-queue Client"
                                  onClick={() => handleRequeue(entry)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-destructive"
                                  title="Delete Entry"
                                  onClick={() =>
                                    handleDeleteFromQueue(entry.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground">
                          No clients have been marked as a no-show.
                        </p>
                      )}
                      {fullNoShowList.length > 5 && !showAllNoShows && (
                        <Button
                          variant="link"
                          className="w-full mt-4 hover:text-primary"
                          onClick={() => setShowAllNoShows(true)}
                        >
                          See all {fullNoShowList.length}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
              {/* Analytics Section */}
              <motion.div variants={fadeIn} className="mt-8 xl:col-span-3">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Analytics
                  </h2>
                  {/* Analytics Range Selector */}
                  <div>
                    <Select
                      value={analyticsRange}
                      onValueChange={setAnalyticsRange}
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
                  </p>
                ) : analyticsData ? (
                  <motion.div
                    initial="initial"
                    animate="animate"
                    variants={staggerContainer}
                  >
                    {/* Key Metrics Cards */}
                    <div className="grid gap-4 md:grid-cols-3 mb-8">
                      {/* Corrected: Wrap Card with motion.div for animations */}
                      <motion.div variants={fadeIn} whileHover="hover">
                        <Card className="h-full w-full"> {/* Card is now a child */}
                          <CardHeader>
                            <CardTitle>Total Revenue</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
                              {(analyticsData.totalRevenue || 0).toFixed(2)}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                      {/* Repeat for other two analytics cards */}
                      <motion.div variants={fadeIn} whileHover="hover">
                        <Card className="h-full w-full">
                          <CardHeader>
                            <CardTitle>Customers Served</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
                              {analyticsData.totalCustomers || 0}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                      <motion.div variants={fadeIn} whileHover="hover">
                        <Card className="h-full w-full">
                          <CardHeader>
                            <CardTitle>No-Show Rate</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
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
                                        fill={
                                          barberColorMap[entry.name] ||
                                          "#8884d8"
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
                                  fill="#8884d8"
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
                                        fill={
                                          barberColorMap[entry.name] ||
                                          "#8884d8"
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
            </>
          )}
        </motion.div>
      </div>
      {/* Dialog for Editing Queue Entry */}
      <Dialog
        open={isEditQueueEntryDialogOpen}
        onOpenChange={setIsEditQueueEntryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Queue for {editingQueueEntry?.client_name}
            </DialogTitle>
            <DialogDescription>
              Change the assigned staff member for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="barber-select">Change Staff Member</Label>
              <Select value={editedBarberId} onValueChange={setEditedBarberId}>
                <SelectTrigger id="barber-select">
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateQueueEntry}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog for Setting Barber Break */}
      <Dialog
        open={isBreakDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setBarberForBreak(null); // Clear barber selection when dialog closes
          }
          setIsBreakDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a Break for {barberForBreak?.name}</DialogTitle>
            <DialogDescription>
              Select the approximate duration. This helps with wait time
              estimates but does not end the break automatically. You must
              toggle it off manually.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 grid gap-2">
            <Label htmlFor="break-duration">
              Approximate Duration (minutes)
            </Label>
            <Input
              id="break-duration"
              type="number"
              value={breakDuration}
              onChange={(e) => setBreakDuration(e.target.value)}
              min="5"
              step="5"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBreakDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleStartBreak}>Start Break</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}