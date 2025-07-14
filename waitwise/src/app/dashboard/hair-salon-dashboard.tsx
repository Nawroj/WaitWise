// hair-salon-dashboard.tsx (Updated)
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
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
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
  Edit, // Keep for "Edit Staff Member" within queue actions if needed, otherwise remove.
  RefreshCw,
  Wand2,
  MoreVertical,
  Loader2,
  Users,
  PauseCircle,
  CalendarCheck,
  XCircle,
  ChevronLeft,
  ChevronRight // Added for cancel appointment icon
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { toast } from "sonner";
import { Switch } from "../../components/ui/switch";
import { motion, easeInOut } from "framer-motion";
// Removed Stripe imports as billing will mostly be in settings page now
// import { Elements } from "@stripe/react-stripe-js";
// import { loadStripe } from "@stripe/stripe-js";
// import { StripePaymentForm } = "../../components/ui/StripePaymentForm";
import { format } from "date-fns"; // Import format for date display

// Animation Variants (keep these)
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


// Type definitions (Keep only those relevant to the dashboard's core functionality - queue, appointments, basic shop info)
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
type Appointment = {
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
type Service = { // Keep this as you still need to map service_ids to names for appointments
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string | null;
  description: string | null;
};
type Barber = { // Keep this for displaying barber names and working status in the queue
  id: string;
  name: string;
  avatar_url: string | null;
  is_working_today: boolean;
  is_on_break: boolean;
  break_end_time: string | null;
};
// Removed EditSection type
type Invoice = { // Keep if you still want to show the failed invoice alert on dashboard
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]); // Keep services for displaying appointment service names
  const [barbers, setBarbers] = useState<Barber[]>([]);

  // Removed activeEditSection and related states (shop details, services, staff, QR)
  // const [activeEditSection, setActiveEditSection] = useState<EditSection | null>(null);

  // Billing dialog states (can be removed if all billing goes to settings page)
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null);
  // Removed stripePromise loadStripe

  const [editingQueueEntry, setEditingQueueEntry] = useState<QueueEntry | null>(
    null,
  );
  const [isEditQueueEntryDialogOpen, setIsEditQueueEntryDialogOpen] =
    useState(false);
  const [editedBarberId, setEditedBarberId] = useState("");

  // Removed barberForBreak, breakDuration, isBreakDialogOpen as break management moves to settings staff section

  const [totalEventCount, setTotalEventCount] = useState(0);
  const [monthlyBillableEventCount, setMonthlyBillableEventCount] = useState(0);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [showAllNoShows, setShowAllNoShows] = useState(false);
  const [isSmsPaused, setIsSmsPaused] = useState(true);

  // Fetches current day's queue entries and appointments for the shop
  const fetchData = useCallback(
    async (shopId: string) => {
      if (!shopId) return;

      // Removed all date filtering. The queries will now return all entries for the shop.
      const [{ data: queueData, error: queueError }, { data: appointmentsData, error: appointmentsError }] = await Promise.all([
        supabase
          .from("queue_entries")
          .select(
            `*, barbers ( id, name ), notification_sent_at, queue_entry_services ( services ( id, name, price ) )`,
          )
          .eq("shop_id", shopId)
          .order("queue_position"), // Kept ordering

        supabase
          .from("appointments")
          .select(`*, barbers ( id, name )`)
          .eq("shop_id", shopId)
          .order("start_time", { ascending: true }) // Kept ordering
      ]);

      if (queueError) {
        console.error("Error fetching queue:", queueError);
      } else {
        setQueueEntries(queueData as QueueEntry[]);
      }

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
      } else {
        setAppointments(appointmentsData as Appointment[]);
      }
    },
    [supabase],
  );

  // Fetches shop's services and barbers (modified to only fetch what's needed for dashboard display)
  const fetchShopData = useCallback(
    async (shopId: string) => {
      if (!shopId) return;
      const [{ data: servicesData }, { data: barbersData }] = await Promise.all(
        [
          supabase
            .from("services")
            .select("id, name, price") // Only fetch ID, Name, Price for appointment mapping
            .eq("shop_id", shopId),
          supabase
            .from("barbers")
            .select("*") // Keep all barber info for display in queue
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
        fetchData(shopData.id);
        fetchShopData(shopData.id);
      }
      setLoading(false);
    }
    fetchUserAndShop();
  }, [supabase, router, fetchData, fetchShopData]);

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

  // Fetches the latest failed invoice if subscription status is 'past_due' (if still displaying this on dashboard)
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


  // Real-time subscriptions for queue, appointments, barbers, services
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
        () => fetchData(shop.id),
      )
      .subscribe();
    const appointmentsChannel = supabase
      .channel(`appointments_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchData(shop.id),
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
        () => fetchShopData(shop.id), // Ensure fetchShopData is called here for real-time barber updates
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
        () => fetchShopData(shop.id), // Ensure fetchShopData is called here for real-time service updates
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(barbersChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, [shop, supabase, fetchData, fetchShopData]);

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

  // Handle checking in an appointment
  const handleCheckInAppointment = async (appointment: Appointment) => {
    if (!shop) return;

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
    const { data: newQueueEntry, error: queueEntryError } = await supabase.rpc(
      "create_queue_entry_with_services",
      {
        p_shop_id: shop.id,
        p_barber_id: appointment.barber_id,
        p_client_id: null,
        p_client_name: appointment.client_name,
        p_client_phone: appointment.client_phone,
        p_service_ids: appointment.service_ids || [],
        p_appointment_id: appointment.id,
      },
    );

    if (queueEntryError) {
      console.error("Error creating queue entry for check-in:", queueEntryError);
      toast.error("Appointment checked in, but failed to add to queue. Please add manually.");
      return;
    }

    toast.success(`${appointment.client_name} checked in! Now in queue.`);
    if (!barberHasInProgress) {
         handleUpdateStatus(newQueueEntry.id, "in_progress");
    }
  };

  // Handle cancelling an appointment
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

  // Retries a failed payment (if still present on dashboard)
  const handleRetryPayment = async () => {
    if (!shop || !failedInvoice) return;

    if (shop.stripe_payment_method_id === null) {
      toast.error("No payment method found on file. Please add or update it.", {
        action: {
          label: "Update Method",
          onClick: () => {
            // Redirect to settings page for billing
            router.push("/dashboard/settings");
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
        const actionOnClick = () => {
          router.push("/dashboard/settings");
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
      }
    } catch (error: unknown) {
      toast.dismiss("retry-payment-toast");
      console.error("Unexpected error during payment retry:", error);
      toast.error("An unexpected error occurred during payment retry.");
    }
  };

  // Removed renderEditDialogContent

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
                    <Button variant="ghost" size="icon" className="hover:bg-accent/50">
                     <MoreVertical className="h-5 w-5 text-muted-foreground" />
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
                    {/* Updated navigation to Settings page */}
                    <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                      <Edit className="mr-2 h-4 w-4" /> Settings
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
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
            {/* Analytics Button */}
            <Link href="/dashboard/analytics">
                <span className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2 flex items-center">
                  <LineChart className="mr-2 h-4 w-4" /> Analytics
                </span>
              </Link>
            {/* Updated navigation to Settings page */}
            <Link href="/dashboard/settings">
              <span
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-2 flex items-center"
              >
                <Edit className="mr-2 h-4 w-4" /> Settings
              </span>
            </Link>
            <span
              className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-3 py-2"
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
              <Button
                onClick={handleRetryPayment}
                className="mt-3 bg-white text-destructive hover:bg-gray-100 border border-destructive"
              >
                Retry Payment
              </Button>
            </div>
          )}
        </motion.div>


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
                        title: 'Go to "Settings"',
                        description:
                          'Click the "Settings" button in the top navigation bar.',
                      },
                      {
                        title: "Add Services & Staff",
                        description:
                          "In the Settings page, add the services you offer and the staff members on your team. Each staff member will get their own dedicated queue and be available for appointments.",
                      },
                      {
                        title: "Share Your QR Code",
                        description:
                          'Generate your shop\'s unique QR code from the "Settings" page and share it with your customers so they can join the queue or book an appointment!',
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
                className="flex overflow-x-auto gap-6 pb-4 -mb-4 mt-8 no-scrollbar"
              >
                {workingBarbers.map((barber, index) => {
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

                   const getColorPalette = (barberIndex: number) => {
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
                   const { bg, text, border } = getColorPalette(index);

                  return (
                    <motion.div
                      key={barber.id}
                      variants={fadeIn}
                      className="min-w-[280px] md:min-w-[320px] lg:min-w-[300px] flex-shrink-0"
                    >
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
                                    <span>{entry.client_name}</span>

                                    <div className="flex items-center gap-2">
                                      {!inProgressWithBarber && !barber.is_on_break && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="px-3 py-1 text-xs"
                                          onClick={() => handleUpdateStatus(entry.id, "in_progress")}
                                          disabled={
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
                className="mt-8 relative"
              >
                {/* Main scrollable container for the cards */}
                <div
                  id="daily-summary-cards"
                  className="flex overflow-x-auto gap-4 pb-4 no-scrollbar lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-8 lg:pb-0"
                >
                  {/* No-Shows Card - NOW FIRST */}
                  <motion.div variants={fadeIn} className="flex-shrink-0 w-full min-w-[280px] sm:min-w-[300px]">
                    <Card className="h-full bg-card border-border text-foreground shadow-sm">
                      <CardHeader>
                        <CardTitle>No-Shows</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {visibleNoShowList.length > 0 ? (
                          <div className="space-y-2">
                            {visibleNoShowList.map((entry, index) => (
                              <motion.div
                                key={entry.id}
                                variants={fadeIn}
                                className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/20 border border-border"
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
                          <p className="text-sm text-center text-muted-foreground py-4">
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

                  {/* Completed Today Card - NOW SECOND */}
                  <motion.div variants={fadeIn} className="flex-shrink-0 w-full min-w-[280px] sm:min-w-[300px]">
                    <Card className="h-full bg-card border-border text-foreground shadow-sm">
                      <CardHeader>
                        <CardTitle>Completed Today</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {visibleCompletedList.length > 0 ? (
                          <div className="space-y-2">
                            {visibleCompletedList.map((entry, index) => (
                              <motion.div
                                key={entry.id}
                                variants={fadeIn}
                                className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/20 border border-border"
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
                          <p className="text-sm text-center text-muted-foreground py-4">
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
                </div>

                {/* Navigation Arrows moved to the bottom, centered, and hidden on larger screens */}
                <div className="flex justify-center gap-2 mt-4 lg:hidden">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      document.getElementById('daily-summary-cards')?.scrollBy({ left: -300, behavior: 'smooth' });
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      document.getElementById('daily-summary-cards')?.scrollBy({ left: 300, behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>

            </>
          )}
        </motion.div>
      </div>
      <footer className="mt-16 py-6 text-center text-gray-300 bg-background border-t border-border/50"> {/* Removed text-3xl font-bold from footer itself as it's for text, not image */}
  {/* Replace /path/to/your/logo.svg with the actual path to your SVG logo file */}
  {/* Adjust width and height as needed. Tailwind's `w-auto h-12` is a good starting point for responsive sizing. */}
  <Image
    src="Logo.svg" // Replace with your SVG path
    alt="WaitWise Logo"
    width={30} // Example width in pixels. Adjust as necessary.
    height={15} // Example height in pixels. Adjust as necessary.
    className="mx-auto" // Centers the image horizontally
    priority // Optional: if this logo should load quickly on initial page load
  />
  <p className="text-sm text-muted-foreground mt-2">&copy; {new Date().getFullYear()} WaitWise. All rights reserved.</p> {/* Added copyright text, adjusted styling */}
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
      {/* Removed Dialog for Setting Barber Break (now in settings page) */}
    </>
  );

}