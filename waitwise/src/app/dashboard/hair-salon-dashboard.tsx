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
  LineChart,
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
  Store,
  Users,
  PauseCircle, // Added for break icon
  ChevronDown, // Added for collapsible
  CalendarCheck, // Added for appointment check-in icon
  XCircle, // Added for cancel appointment icon
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
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
} from "../../components/ui/collapsible";
import { format } from "date-fns"; // Import format for date display

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
  appointment_id: string | null; // Added for linking to appointments
};
type Appointment = { // NEW TYPE DEFINITION for dashboard view
  id: string;
  shop_id: string;
  client_name: string;
  client_phone: string | null;
  barber_id: string;
  barbers: { id: string; name: string } | null; // Nested barber data
  start_time: string;
  end_time: string;
  status: "booked" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  total_price: number | null;
  service_ids: string[] | null; // Array of service UUIDs
  // `services` is not directly nested from DB for array column, will map manually
  created_at: string;
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
  category: string | null;
  description: string | null;
};
type Barber = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_working_today: boolean;
  is_on_break: boolean;
  break_end_time: string | null;
};
type EditSection = "details" | "services" | "staff" | "qr";
type Invoice = {
  id: string;
  month?: string;
  amount_due: number;
  amount_paid?: number;
  currency?: string;
  status: string;
  created_at: string;
  due_date?: string;
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
  const [appointments, setAppointments] = useState<Appointment[]>([]); // NEW STATE FOR APPOINTMENTS
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeEditSection, setActiveEditSection] =
    useState<EditSection | null>(null);
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
  const [editingQueueEntry, setEditingQueueEntry] = useState<QueueEntry | null>(
    null,
  );
  const [isEditQueueEntryDialogOpen, setIsEditQueueEntryDialogOpen] =
    useState(false);
  const [editedBarberId, setEditedBarberId] = useState("");
  const [barberForBreak, setBarberForBreak] = useState<Barber | null>(null);
  const [breakDuration, setBreakDuration] = useState("15");
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);

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
  const [newServiceCategory, setNewServiceCategory] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");

  // States for staff management
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberAvatarFile, setNewBarberAvatarFile] = useState<File | null>(
    null,
  );

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [monthlyBillableEventCount, setMonthlyBillableEventCount] = useState(0);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [showAllNoShows, setShowAllNoShows] = useState(false);
  const [isSmsPaused, setIsSmsPaused] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [isEmailPromptVisible, setIsEmailPromptVisible] = useState(false);
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null);
  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );

  // Fetches current day's queue entries and appointments for the shop
  const fetchData = useCallback( // Renamed from fetchQueueData to fetchData
    async (shopId: string) => {
      if (!shopId) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      const [{ data: queueData, error: queueError }, { data: appointmentsData, error: appointmentsError }] = await Promise.all([
        supabase
          .from("queue_entries")
          .select(
            `*, barbers ( id, name ), notification_sent_at, queue_entry_services ( services ( id, name, price ) )`,
          )
          .eq("shop_id", shopId)
          .gte("created_at", today.toISOString())
          .order("queue_position"),

        supabase
          .from("appointments")
          .select(`*, barbers ( id, name )`) // Fetch nested barber, but NOT services (handled manually)
          .eq("shop_id", shopId)
          .gte("start_time", today.toISOString()) // Only future/current appointments
          .order("start_time", { ascending: true })
      ]);

      if (queueError) {
        console.error("Error fetching queue:", queueError);
      } else {
        setQueueEntries(queueData as QueueEntry[]);
      }

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError); // Log the actual error
      } else {
        setAppointments(appointmentsData as Appointment[]);
      }
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
            .select("*, category, description")
            .eq("shop_id", shopId)
            .order("created_at"),
          supabase
            .from("barbers")
            .select("*")
            .eq("shop_id", shopId)
            .order("created_at"),
        ],
      );
      setServices(servicesData as Service[] || []);
      setBarbers((barbersData as Barber[]) || []);
    },
    [supabase],
  );

  // Initial data fetch on component mount: user, shop, queue, services, barbers, appointments
  useEffect(() => {
    async function fetchUserAndShop() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: shopData } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (shopData) {
        setShop(shopData);
        setEditedShopName(shopData.name);
        setEditedShopAddress(shopData.address);
        setEditedOpeningTime(shopData.opening_time || "09:00");
        setEditedClosingTime(shopData.closing_time || "17:00");
        fetchData(shopData.id); // Call fetchData to get queue and appointments
        fetchShopData(shopData.id);
      }
      setLoading(false);
    }
    fetchUserAndShop();
  }, [supabase, router, fetchData, fetchShopData]); // Added fetchData to dependencies

  // Effect to update logo preview when shop details edit dialog opens
  useEffect(() => {
    if (activeEditSection === "details" && shop) {
      setLogoPreviewUrl(shop.logo_url || null);
      setNewShopLogoFile(null);
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

      const { count: totalCount, error: totalError } = await supabase
        .from("billable_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop.id);

      if (totalError) {
        console.error("Error fetching total events count:", totalError);
      } else {
        setTotalEventCount(totalCount || 0);
      }

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
        console.log("Attempting to fetch failed invoice for shop:", shop.id);
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, amount_due, created_at, status, stripe_charge_id, month, amount_paid, currency, due_date",
          )
          .eq("shop_id", shop.id)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching failed invoice:", error);
        } else {
          console.log("Fetched failed invoice data:", data);
          setFailedInvoice(data);
        }
      };
      fetchFailedInvoice();
    }
  }, [shop, supabase]);

  

  // Real-time subscriptions for queue, barbers, services, AND appointments updates
  useEffect(() => {
    if (!shop) return;
    const queueChannel = supabase
      .channel(`queue_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchData(shop.id), // Call fetchData on queue changes
      )
      .subscribe();
    const appointmentsChannel = supabase // NEW: Appointments channel
      .channel(`appointments_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchData(shop.id), // Call fetchData on appointment changes
      )
      .subscribe();
    const barbersChannel = supabase
      .channel(`barbers_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "barbers",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchShopData(shop.id),
      )
      .subscribe();
    const servicesChannel = supabase
      .channel(`services_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "services",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchShopData(shop.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(appointmentsChannel); // Clean up appointments channel
      supabase.removeChannel(barbersChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, [shop, supabase, fetchData, fetchShopData]); // Added fetchData to dependencies

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

  // Memoized list of upcoming appointments (not checked-in, not cancelled/completed/no_show)
  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter(
        (appt) =>
          appt.status === "booked" && new Date(appt.start_time) >= new Date(),
      )
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [appointments]);

  // Helper function to get service names from service_ids (for appointments display)
  const getServiceNamesForAppointment = useCallback((appointment: Appointment) => {
    if (!appointment.service_ids || appointment.service_ids.length === 0) {
        return 'N/A';
    }
    const names = appointment.service_ids.map(serviceId => {
        const service = services.find(s => s.id === serviceId);
        return service ? service.name : null;
    }).filter(Boolean); // Filter out any nulls if a service ID wasn't found

    return names.length > 0 ? names.join(', ') : 'N/A';
}, [services]); // Dependency on the 'services' state


  

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

    const breakEndTime = new Date(Date.now() + parseInt(breakDuration) * 60000);

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
      setIsEmailPromptVisible(false);
    } else {
      setIsEmailPromptVisible(true);
    }
    setIsUpgrading(true);
  };

  // Handles submission of billing email
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsEmailPromptVisible(false);
  };

  // Re-queues a client from 'no_show' status
  const handleRequeue = async (entry: QueueEntry) => {
    if (!entry.barbers?.id) {
      toast.error(
        "This client has no assigned staff member and cannot be re-queued.",
      );
      return;
    }
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

    // If an appointment was linked to this queue entry and it's marked done/no_show, update appointment status too
    if (newStatus === "done" || newStatus === "no_show") {
      if (currentEntry?.appointment_id) {
        const { error: apptUpdateError } = await supabase
          .from("appointments")
          .update({ status: newStatus === "done" ? "completed" : "no_show" })
          .eq("id", currentEntry.appointment_id);
        if (apptUpdateError) {
          console.error(`Error updating linked appointment status to ${newStatus}:`, apptUpdateError);
          toast.warning("Could not update linked appointment status.");
        }
      }
    }


    if (newStatus === "in_progress" && barberId && shop) {
      try {
        const { data: nextInQueue, error: nextError } = await supabase
          .from("queue_entries")
          .select("id, notification_sent_at")
          .eq("barber_id", barberId)
          .eq("status", "waiting")
          .order("queue_position", { ascending: true })
          .limit(1)
          .single();

        if (nextError && nextError.code !== "PGRST116") {
          console.error("Error fetching next in queue for notification:", nextError);
        }

        if (nextInQueue && !nextInQueue.notification_sent_at) {
          if (!isSmsPaused) {
            console.log(`Live SMS Enabled: Found user ${nextInQueue.id} at position 1. Sending notification...`);
            const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
              "notify-customer",
              {
                body: {
                  entity_id: nextInQueue.id,
                  type: 'queue',
                },
              },
            );

            if (invokeError) {
              toast.error(`Failed to send SMS notification: ${invokeError.message}`);
              console.error("SMS notification invoke error:", invokeError);
            } else {
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

  // NEW: Handle checking in an appointment
  const handleCheckInAppointment = async (appointment: Appointment) => {
    if (!shop) return;

    // Check if the barber already has someone in progress
    // Check if the barber already has someone in progress
const barberHasInProgress = queueEntries.some(
  (entry) => entry.barbers?.id === appointment.barber_id && entry.status === "in_progress"
);

    if (barberHasInProgress) {
        toast.info(`${appointment.barbers?.name || 'This staff member'} is currently busy. Adding ${appointment.client_name} to the queue.`);
    }

    // 1. Update appointment status to 'checked_in'
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "checked_in" })
      .eq("id", appointment.id);

    if (apptUpdateError) {
      toast.error(`Failed to check in appointment: ${apptUpdateError.message}`);
      return;
    }

    // 2. Create a new queue entry linked to this appointment
    // This RPC function will handle placing them in the correct position
    const { data: newQueueEntry, error: queueEntryError } = await supabase.rpc(
      "create_queue_entry_with_services", // Reuse existing RPC
      {
        p_shop_id: shop.id,
        p_barber_id: appointment.barber_id,
        p_client_id: null, // Assuming client_id might not be strictly needed by RPC, or fetch it if crucial
        p_client_name: appointment.client_name,
        p_client_phone: appointment.client_phone,
        p_service_ids: appointment.service_ids || [], // Pass service_ids from appointment
        p_appointment_id: appointment.id, // Link to the appointment
      },
    );

    if (queueEntryError) {
      console.error("Error creating queue entry for check-in:", queueEntryError);
      toast.error("Appointment checked in, but failed to add to queue. Please add manually.");
      // Optionally revert appointment status if queue entry creation is critical
      // await supabase.from("appointments").update({ status: "booked" }).eq("id", appointment.id);
      return;
    }

    toast.success(`${appointment.client_name} checked in! Now in queue.`);
    // Optionally trigger notification to next client if barber is now free
    if (!barberHasInProgress) {
         handleUpdateStatus(newQueueEntry.id, "in_progress"); // Directly start if staff is free
    }
  };

  // NEW: Handle cancelling an appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment? This cannot be undone.")) {
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (error) {
      toast.error(`Failed to cancel appointment: ${error.message}`);
    } else {
      toast.success("Appointment cancelled successfully.");
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
      setEditedBarberId(entry.barbers.id);
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
      logoUrlToUpdate = `${data.publicUrl}?t=${new Date().getTime()}`;
    }

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
      const logoPath = shop.logo_url.split("/shop-logos/")[1].split("?")[0];
      const { error: storageError } = await supabase.storage
        .from("shop-logos")
        .remove([logoPath]);

      if (storageError) {
        if (storageError.message !== "The resource was not found") {
          throw storageError;
        }
      }

      const { data: updatedShop, error: dbError } = await supabase
        .from("shops")
        .update({ logo_url: null })
        .eq("id", shop.id)
        .select()
        .single();

      if (dbError) throw dbError;

      setShop(updatedShop);
      setLogoPreviewUrl(null);
      setActiveEditSection(null);

      toast.dismiss();
      toast.success("Logo deleted successfully!");
    } catch (error: unknown) {
      toast.dismiss();
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
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
        category: newServiceCategory || null,
        description: newServiceDescription || null,
        shop_id: shop.id,
      });
    if (!error) {
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceDuration("");
      setNewServiceCategory("");
      setNewServiceDescription("");
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

    if (shop.stripe_payment_method_id === null) {
      toast.error("No payment method found on file. Please add or update it.", {
        action: {
          label: "Update Method",
          onClick: () => {
            setIsBillingDialogOpen(true);
            setIsUpgrading(true);
          },
        },
        id: "no-payment-method",
      });
      return;
    }

    toast.loading("Retrying payment...", { id: "retry-payment-toast" });

    try {
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

        let userMessage =
          "Failed to process payment. Please try again or update your payment method.";
        let actionLabel = "Update Method";
        let actionOnClick = () => {
          setIsBillingDialogOpen(true);
          setIsUpgrading(true);
        };

        const parsedError = invokeError.message;

        if (parsedError.includes("Payment declined")) {
          userMessage = "Payment declined. Please update your payment method.";
        } else if (parsedError.includes("No payment method on file")) {
          userMessage = "No payment method found. Please add one.";
        } else if (parsedError.includes("already paid")) {
          userMessage =
            "Invoice was already paid. Your account should be active.";
          actionLabel = "Close";
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
        toast.success("Payment successful! Your account is now active.");
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
        }
        setIsBillingDialogOpen(false);
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
      const filePath = `${shop.id}/${Date.now()}.${fileExt}`;

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
                            setLogoPreviewUrl(URL.createObjectURL(file));
                          } else {
                            setNewShopLogoFile(null);
                            setLogoPreviewUrl(shop?.logo_url || null);
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
                                  <TableHead>Description</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead>Mins</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {itemsInCategory.map((s) => (
                                  <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{s.description || 'N/A'}</TableCell>
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
                    <Label htmlFor="new-service-category">Category (Optional)</Label>
                    <Input
                      id="new-service-category"
                      placeholder="e.g., Men's, Women's, Kids"
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 w-full">
                    <Label htmlFor="new-service-description">Description (Optional)</Label>
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
                                    setBarberForBreak(b);
                                    setIsBreakDialogOpen(true);
                                  } else {
                                    handleEndBreak(b.id);
                                  }
                                }}
                                disabled={!b.is_working_today}
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
                      className="object-contain"
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
                    <Button variant="ghost" size="icon" className="hover:bg-accent/50"> {/* Added hover effect */}
                     <MoreVertical className="h-5 w-5 text-muted-foreground" /> {/* Neutral color */}
                     <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]"> 
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="focus:bg-transparent"
                    >
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="sms-mode-mobile" className="cursor-pointer text-sm">Live SMS</Label>
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
                      <Link href={`/shop/${shop.id}`} target="_blank" className="flex items-center w-full">
                        <Users className="mr-2 h-4 w-4" /> Client Booking Page
                     </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => router.push("/dashboard/analytics")}>
                      <LineChart className="mr-2 h-4 w-4" /> Analytics
                    </DropdownMenuItem>
                    {/* Separate options for clarity */}
                   <DropdownMenuItem onSelect={() => setActiveEditSection("details")}>
                      <Store className="mr-2 h-4 w-4" /> Edit Shop Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection("staff")}>
                      <Users className="mr-2 h-4 w-4" /> Manage Staff
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection("services")}>
                      <ListPlus className="mr-2 h-4 w-4" /> Manage Services
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection("qr")}>
                      <QrCode className="mr-2 h-4 w-4" /> Get QR Code
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsBillingDialogOpen(true)}>
                      Billing & Subscription
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleLogout} className="text-red-500">
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
              <span className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2">
                 Queue / Appointments
                </span>

            </Link>
            {/* New Analytics Button */}
            <Link href="/dashboard/analytics">
                <span className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2 flex items-center">
                  <LineChart className="mr-2 h-4 w-4" /> Analytics
                </span>
              </Link>
              {/* Standalone QR Code button */}
              <span
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2 flex items-center"
                onClick={() => setActiveEditSection("qr")}
              >
                <QrCode className="mr-2 h-4 w-4" /> Get QR Code
              </span>
              <span
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2"
                onClick={() => setIsBillingDialogOpen(true)}
              >
                Billing
              </span>
              {/* Edit Shop Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2 flex items-center"
                  >
                    <Edit className="mr-2 h-4 w-4" /> Edit <ChevronDown className="ml-2 h-4 w-4" />
                  </span>
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
                </DropdownMenuContent>
              </DropdownMenu>
              <span
                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-3 py-2" // Destructive hover for logout
                onClick={handleLogout}
              >
                Logout
              </span>
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
                                toast.success(
                                  "Upgrade successful! Your payment method has been saved.",
                                );
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
                                setIsBillingDialogOpen(false);
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
                      if (!isUpgrading) {
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (user && user.email) {
                          setBillingEmail(user.email);
                          setIsEmailPromptVisible(false);
                        } else {
                          setIsEmailPromptVisible(true);
                          setBillingEmail("");
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
                            toast.success(
                              "Upgrade successful! Your payment method has been saved.",
                            );
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
                            setIsBillingDialogOpen(false);
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

          {/* Setup Guide or Live Queue/Appointments */}
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
                    Your live queue and appointment views will appear here once
                    you&apos;ve added your staff members.
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
                          "In the dialog, add the services you offer and the staff members on your team. Each staff member will get their own dedicated queue and be available for appointments.",
                      },
                      {
                        title: "Share Your QR Code",
                        description:
                          'Generate your shop\'s unique QR code from the "Edit Shop" panel and share it with your customers so they can join the queue or book an appointment!',
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
            // Display live queue and appointments if barbers exist
            <>
              {/* Upcoming Appointments Section */}
              <motion.div variants={fadeIn} className="mt-8">
              </motion.div>

              {/* Live Queue Section */}
              <motion.div
                initial="initial"
                animate="animate"
                variants={staggerContainer}
                className="flex overflow-x-auto gap-6 pb-4 -mb-4 mt-8 no-scrollbar" // Horizontal scrollable layout
              >
                {workingBarbers.map((barber, index) => { // This is the *correct* map
                  const barberQueue = queueEntries.filter(
                    (entry) => entry.barbers?.id === barber.id,
                  );
                  const waitingForBarber = barberQueue.filter(
                    (entry) => entry.status === "waiting",
                  );
                  const inProgressWithBarber = barberQueue.find(
                    (entry) => entry.status === "in_progress",
                  );
                  const upcomingAppointmentsForBarber = upcomingAppointments.filter(
                     (appt) => appt.barber_id === barber.id
                   );

                   // Fallback for barberColorMap to provide more specific pastel colors
                   const getColorPalette = (barberIndex: number) => { // Renamed parameter to avoid conflict
                     const palettes = [
                       { bg: 'from-blue-100 to-blue-200', text: 'text-blue-800', border: 'border-blue-300' },
                       { bg: 'from-green-100 to-green-200', text: 'text-green-800', border: 'border-green-300' },
                       { bg: 'from-purple-100 to-purple-200', text: 'text-purple-800', border: 'border-purple-300' },
                       { bg: 'from-yellow-100 to-yellow-200', text: 'text-yellow-800', border: 'border-yellow-300' },
                       { bg: 'from-pink-100 to-pink-200', text: 'text-pink-800', border: 'border-pink-300' },
                       { bg: 'from-indigo-100 to-indigo-200', text: 'text-indigo-800', border: 'border-indigo-300' },
                     ];
                     return palettes[barberIndex % palettes.length];
                   };
                   const { bg, text, border } = getColorPalette(index); // Use map 'index' to pick color

                  return (
                    <motion.div
                      key={barber.id}
                      variants={fadeIn}
                      className="min-w-[280px] md:min-w-[320px] lg:min-w-[300px] flex-shrink-0" // Ensures horizontal spacing and prevents collapsing
                    >
                      {/* Individual Barber Card */}
                      <Card className={`w-full h-full border-t-4 ${border} ${bg} text-foreground overflow-hidden`}>
                        <CardHeader className="p-4 border-b border-border/50 bg-card/60">
                          <div className="flex justify-between items-center mb-2">
                            <h2 className={`text-xl font-semibold flex items-center gap-2 ${text}`}>
                              <Avatar className="h-8 w-8 border-2 border-primary/50">
                                <AvatarImage src={barber.avatar_url || ""} alt={barber.name} />
                                <AvatarFallback className="bg-primary/20 text-primary-foreground">
                                  {barber.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              {barber.name}
                            </h2>
                            {barber.is_on_break && (
                              <Badge variant="destructive" className="flex items-center gap-1 text-sm">
                                <PauseCircle className="h-3 w-3" /> ON BREAK
                                {barber.break_end_time && (
                                  <span className="ml-1 text-xs">{format(new Date(barber.break_end_time), 'h:mm a')}</span>
                                )}
                              </Badge>
                            )}
                          </div>
                          {/* Current Client In Progress */}
                          <div className="text-sm">
                            {inProgressWithBarber ? (
                              <div className="bg-card p-3 rounded-md border border-primary/30 shadow-inner flex justify-between items-center">
                                <div>
                                  <p className="font-semibold">{inProgressWithBarber.client_name}</p>
                                  <p className="text-muted-foreground text-xs">
                                    Services:{" "}
                                    {inProgressWithBarber.queue_entry_services
                                      ?.map((item) => item.services?.name)
                                      .filter(Boolean)
                                      .join(", ") || "N/A"}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleUpdateStatus(inProgressWithBarber.id, "done")}
                                >
                                  Done
                                </Button>
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground py-3 bg-card rounded-md border border-dashed">
                                Available
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 space-y-4">
  {/* Waiting Queue */}
  <div>
    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
      <Badge variant="secondary">{waitingForBarber.length}</Badge> Waiting
    </h3>
    {waitingForBarber.length > 0 ? (
      <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2 custom-scrollbar">
        {waitingForBarber.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
            {/* Client name on the left */}
            <span>{entry.client_name}</span>

            {/* Group Start Button and Dropdown Menu on the right */}
            <div className="flex items-center gap-2"> {/* This div groups the actions */}
              {/* Start Button for Waiting Clients */}
              {!inProgressWithBarber && !barber.is_on_break && (
                <Button
                  variant="outline"
                  size="sm"
                  className="px-3 py-1 text-xs"
                  onClick={() => handleUpdateStatus(entry.id, "in_progress")}
                  disabled={
                    // Disable if barber is busy, on break, or trial limits reached
                    !!inProgressWithBarber ||
                    barber.is_on_break ||
                    shop.subscription_status === "past_due" ||
                    (totalEventCount >= 50 &&
                      (shop.subscription_status === "trial" ||
                       shop.subscription_status === null))
                  }
                >
                  Start
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenEditDialog(entry)}>
                    <Edit className="mr-2 h-4 w-4" /> Reassign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus(entry.id, "no_show")}>
                    <XCircle className="mr-2 h-4 w-4" /> Mark No-Show
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeleteFromQueue(entry.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-muted-foreground text-center py-2">No one waiting.</p>
    )}
  </div>

                          {/* Upcoming Appointments */}
                          <Separator className="bg-border/50" />
                          <div>
                            <h3 className="text-sm font-semibold mb-2">Upcoming Appointments</h3>
                            {upcomingAppointmentsForBarber.length > 0 ? (
                              <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {upcomingAppointmentsForBarber.map((appt) => (
                                  <li key={appt.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                                    <div>
                                      <p className="font-semibold">{appt.client_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(appt.start_time), 'h:mm a')} - {getServiceNamesForAppointment(appt)}
                                      </p>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleCheckInAppointment(appt)}>
                                          <CalendarCheck className="mr-2 h-4 w-4" /> Check In
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCancelAppointment(appt.id)} className="text-destructive">
                                          <XCircle className="mr-2 h-4 w-4" /> Cancel
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">No upcoming appointments.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
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
              
            </>
          )}
        </motion.div>
      </div>
      <footer className="mt-16 py-6 text-center text-gray-300 text-2xl font-bold"> {/* Changed text-2xl to text-3xl for bigger, removed text-primary */}
  <p>WaitWise</p>
</footer>
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
            setBarberForBreak(null);
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