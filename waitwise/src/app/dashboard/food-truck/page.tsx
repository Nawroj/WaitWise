'use client'

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import Image from "next/image";
import { useMediaQuery } from "react-responsive";

import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../../components/ui/dropdown-menu";
import {
  Trash2,
  Edit,
  RefreshCw,
  CreditCard,
  Wand2,
  MoreVertical,
  Loader2,
  Settings,
  UtensilsCrossed,
  PlusCircle,
  CheckCircle2,
  XCircle,
  ChefHat,
  PackageCheck,
  History,
  Store,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { motion, easeInOut } from "framer-motion";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StripePaymentForm } from "../../../components/ui/StripePaymentForm";

// Animation Variants (consistent with other dashboards)
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

// Type definitions specific to Food Truck Dashboard
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
  enable_online_payments: boolean;
  pass_stripe_fees_to_customer: boolean;
  stripe_connect_account_id: string | null;
  is_charges_enabled: boolean;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  // Added quantity here for manualCart typing consistency
  quantity: number;
};

type Order = {
  id: string;
  client_name: string;
  client_phone: string | null;
  total_amount: number;
  status:
    | "pending"
    | "preparing"
    | "ready_for_pickup"
    | "completed"
    | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  shop_id: string;
  order_items: {
    quantity: number;
    price_at_order: number;
    notes: string | null;
    menu_items: {
      name: string;
    } | null;
  }[];
  order_ready_notified_at: string | null;
};

// Type for individual order items in history (which are just Orders)
type ClientOrderHistoryItem = Order;

// Type for invoices (for billing alert)
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

// Edit sections for Food Truck dashboard (now includes details and QR from Barber)
type EditSection = "details" | "menu" | "qr";

export default function FoodTruckDashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // State variables
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  // Order states
  const [preparingOrders, setPreparingOrders] = useState<Order[]>([]);
  const [readyForPickupOrders, setReadyForPickupOrders] = useState<Order[]>([]);
  const [clientHistory, setClientHistory] = useState<ClientOrderHistoryItem[]>([]);

  const [activeEditSection, setActiveEditSection] =
    useState<EditSection | null>(null);

  // States for usage metrics (from Barber Shop dashboard)
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [monthlyBillableEventCount, setMonthlyBillableEventCount] = useState(0);

  // States for billing dialog (from Barber Shop dashboard)
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [isEmailPromptVisible, setIsEmailPromptVisible] = useState(false);
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null);
  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );

  const [isAddOrderDialogOpen, setIsAddOrderDialogOpen] = useState(false);
  const [manualClientName, setManualClientName] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualOrderNotes, setManualOrderNotes] = useState('');
  // Using MenuItem[] for manualCart for consistency with menuItems structure
  const [manualCart, setManualCart] = useState<MenuItem[]>([]);
  const [isSubmitting] = useState(false);

  // States for shop details editing (from Barber Shop dashboard)
  const [editedShopName, setEditedShopName] = useState("");
  const [editedShopAddress, setEditedShopAddress] = useState("");
  const [editedOpeningTime, setEditedOpeningTime] = useState("");
  const [editedClosingTime, setEditedClosingTime] = useState("");
  const [newShopLogoFile, setNewShopLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [enableOnlinePayments, setEnableOnlinePayments] = useState(false);
  const [passStripeFees, setPassStripeFees] = useState(false);

  // States for menu item creation/editing (original Food Truck)
  const [newMenuItemName, setNewMenuItemName] = useState("");
  const [newMenuItemDescription, setNewMenuItemDescription] = useState("");
  const [newMenuItemPrice, setNewMenuItemPrice] = useState("");
  const [newMenuItemCategory, setNewMenuItemCategory] = useState("");
  const [newMenuItemImageFile, setNewMenuItemImageFile] = useState<File | null>(
    null,
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // State for "Show More" functionality in Client History
  const [showAllHistory, setShowAllHistory] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  const categorizedMenuItems = useMemo(() => {
    const categories: { [key: string]: MenuItem[] } = {};
    const uncategorized: MenuItem[] = [];

    menuItems.forEach((item) => {
      if (item.category) {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        categories[item.category].push(item);
      } else {
        uncategorized.push(item);
      }
    });

    // Sort categories alphabetically
    const sortedCategories = Object.keys(categories).sort().reduce(
      (obj, key) => {
        obj[key] = categories[key];
        return obj;
      },
      {} as { [key: string]: MenuItem[] }
    );

    return { sortedCategories, uncategorized };
  }, [menuItems]);

  // --- Data Fetching ---
  const fetchShopData = useCallback(
    async (userId: string) => {
      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", userId)
        .single();

      if (shopError) {
        console.error("Error fetching shop data:", shopError);
        toast.error("Failed to load shop data.");
        setLoading(false);
        return null;
      }

      if (shopData.type !== "food_truck") {
        router.replace("/dashboard"); // Redirect if not a food truck
        return null;
      }

      setShop(shopData);
      // Initialize shop details for editing
      setEditedShopName(shopData.name);
      setEditedShopAddress(shopData.address);
      setEditedOpeningTime(shopData.opening_time || "00:00"); // Default for food truck
      setEditedClosingTime(shopData.closing_time || "23:59"); // Default for food truck
      setEnableOnlinePayments(shopData.enable_online_payments ?? true); // Default to true if null/undefined
      setPassStripeFees(shopData.pass_stripe_fees_to_customer ?? false); // Default to false if null/undefined
      return shopData;
    },
    [supabase, router],
  );

  const fetchMenuItems = useCallback(
    async (shopId: string) => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at");

      if (error) {
        console.error("Error fetching menu items:", error);
        toast.error("Failed to load menu items.");
        return;
      }
      setMenuItems(data || []);
    },
    [supabase],
  );

  // MODIFIED: Fetch all orders and categorize them based on simplified flow and 2-hour history
  const fetchOrders = useCallback(
    async (shopId: string) => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
        *,
        order_ready_notified_at,
        order_items (
          quantity,
          price_at_order,
          notes,
          menu_items ( name )
        )
      `,
        )
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false }); // Order descending for history display

      if (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to load orders.");
        return;
      }

      const allOrders = (data as Order[]) || [];
      const newPreparing: Order[] = [];
      const newReadyForPickup: Order[] = [];
      const newCompletedOrCancelledRecent: Order[] = [];

      // Calculate the timestamp for 2 hours ago from now
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

      allOrders.forEach((order) => {
        // Orders initially go into 'preparing' if they are 'pending' or 'preparing'
        if (order.status === "pending" || order.status === "preparing") {
          newPreparing.push(order);
        } else if (order.status === "ready_for_pickup") {
          newReadyForPickup.push(order);
        } else if (order.status === "completed" || order.status === "cancelled") {
          const orderCreatedAt = new Date(order.created_at);

          // Compare order date with twoHoursAgo timestamp
          if (orderCreatedAt.getTime() >= twoHoursAgo.getTime()) {
            newCompletedOrCancelledRecent.push(order);
          }
        }
      });

      setPreparingOrders(newPreparing);
      setReadyForPickupOrders(newReadyForPickup);

      // For client history, directly use the filtered recent orders, already sorted descending by created_at
      setClientHistory(newCompletedOrCancelledRecent);
    },
    [supabase],
  );

  const handleOnboardStripeAccount = useCallback(async () => {
    if (!shop || !shop.email) {
      toast.error("Shop email is required to onboard with Stripe.");
      return;
    }

    toast.loading("Initiating Stripe onboarding...", { id: "onboarding-toast" });

    try {
      const response = await fetch('/api/stripe/onboard-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shop.id, owner_email: shop.email }),
      });

      const data = await response.json();
      toast.dismiss("onboarding-toast");

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Stripe onboarding link.');
      }

      // Redirect the user to Stripe's onboarding URL
      window.location.href = data.url;

    } catch (error: unknown) { // Changed 'any' to 'unknown'
      toast.dismiss("onboarding-toast");
      console.error("Stripe onboarding error:", error);
      let errorMessage = 'Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(`Failed to start onboarding: ${errorMessage}`);
    }
  }, [shop]);

  // Fetch usage counts (from Barber Shop dashboard)
  const fetchUsageCounts = useCallback(
    async (shopId: string) => {
      const today = new Date();
      const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ).toISOString();

      const { count: totalCount, error: totalError } = await supabase
        .from("billable_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shopId);

      if (totalError) {
        console.error("Error fetching total events count:", totalError);
      } else {
        setTotalEventCount(totalCount || 0);
      }

      const { count: monthlyCount, error: monthlyError } = await supabase
        .from("billable_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shopId)
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
    },
    [supabase],
  );

  // Fetches the latest failed invoice if subscription status is 'past_due' (from Barber Shop dashboard)
  useEffect(() => {
    if (shop?.subscription_status === "past_due") {
      const fetchFailedInvoice = async () => {
        const { data, error: fetchError } = await supabase // Renamed 'error' to 'fetchError' to avoid shadowing
          .from("invoices")
          .select(
            "id, amount_due, created_at, status, stripe_charge_id, month, amount_paid, currency, due_date",
          )
          .eq("shop_id", shop.id)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (fetchError) { // Use fetchError here
          console.error("Error fetching failed invoice:", fetchError);
        } else {
          setFailedInvoice(data);
        }
      };
      fetchFailedInvoice();
    }
  }, [shop, supabase]);


  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const currentShop = await fetchShopData(user.id);
      if (currentShop) {
        await fetchMenuItems(currentShop.id);
        await fetchOrders(currentShop.id);
        await fetchUsageCounts(currentShop.id);
      }
      setLoading(false);
    }
    initialFetch();
  }, [
    supabase,
    router,
    fetchShopData,
    fetchMenuItems,
    fetchOrders,
    fetchUsageCounts,
  ]);

  // Real-time subscriptions
  useEffect(() => {
    if (!shop) return;

    const menuItemsChannel = supabase
      .channel(`menu_items_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchMenuItems(shop.id),
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`orders_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchOrders(shop.id),
      )
      .subscribe();

    const billableEventsChannel = supabase
      .channel(`billable_events_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billable_events",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => fetchUsageCounts(shop.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(billableEventsChannel);
    };
  }, [shop, supabase, fetchMenuItems, fetchOrders, fetchUsageCounts]);

  // QR Code Generation
  const generateQRCode = useCallback(async () => { // Wrapped in useCallback
    if (!shop) return;
    const url = `${window.location.origin}/shop/${shop.id}`;
    try {
      const QRCodeModule = (await import('qrcode')).default; // Renamed to avoid conflict
      const options = {
        errorCorrectionLevel: "H" as const,
        type: "image/png" as const,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      };
      const dataUrl = await QRCodeModule.toDataURL(url, options); // Use renamed import
      setQrCodeDataUrl(dataUrl);
    } catch (err: unknown) { // Changed 'any' to 'unknown'
      console.error("Failed to generate QR code", err);
      let errorMessage = 'An unknown error occurred.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      toast.error(`Could not generate QR code: ${errorMessage}`);
    }
  }, [shop]); // Added shop as dependency

  // Auto-generate QR code when the QR section is activated if not already generated
  useEffect(() => {
    if (activeEditSection === "qr" && !qrCodeDataUrl) {
      generateQRCode();
    }
  }, [activeEditSection, qrCodeDataUrl, generateQRCode]);


  // --- Menu Item Management ---
  const handleNewMenuItemImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setNewMenuItemImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
      } else {
        setNewMenuItemImageFile(null);
        setImagePreviewUrl(null);
      }
    },
    [],
  );

  const handleAddMenuItem = useCallback(async () => {
    if (!shop || !newMenuItemName || !newMenuItemPrice) {
      toast.error("Please fill in name and price for the menu item.");
      return;
    }

    toast.loading("Adding menu item...");

    let imageUrl: string | null = null;
    if (newMenuItemImageFile) {
      const file = newMenuItemImageFile;
      const fileExt = file.name.split(".").pop();
      const filePath = `${shop.id}/menu_items/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(filePath, file);

      if (uploadError) {
        toast.dismiss();
        toast.error(`Image upload failed: ${uploadError.message}`);
        return;
      }
      const { data } = supabase.storage
        .from("menu-images")
        .getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    const { error } = await supabase.from("menu_items").insert({
      shop_id: shop.id,
      name: newMenuItemName,
      description: newMenuItemDescription || null,
      price: parseFloat(newMenuItemPrice),
      category: newMenuItemCategory || null,
      image_url: imageUrl,
      is_available: true,
    });

    toast.dismiss();
    if (!error) {
      setNewMenuItemName("");
      setNewMenuItemDescription("");
      setNewMenuItemPrice("");
      setNewMenuItemCategory("");
      setNewMenuItemImageFile(null);
      setImagePreviewUrl(null);
      const fileInput = document.getElementById(
        "new-menu-item-image",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      toast.success("Menu item added!");
    } else {
      toast.error(`Failed to add menu item: ${error.message}`);
    }
  }, [
    shop,
    newMenuItemName,
    newMenuItemPrice,
    newMenuItemImageFile,
    supabase,
    newMenuItemDescription,
    newMenuItemCategory,
  ]);

  const handleEditMenuItem = useCallback((item: MenuItem) => {
    setEditingMenuItem(item);
    setNewMenuItemName(item.name);
    setNewMenuItemDescription(item.description || "");
    setNewMenuItemPrice(item.price.toString());
    setNewMenuItemCategory(item.category || "");
    setImagePreviewUrl(item.image_url || null);
    setNewMenuItemImageFile(null);
    setActiveEditSection("menu");
  }, []);

  const handleUpdateMenuItem = useCallback(async () => {
  if (!editingMenuItem || !shop || !newMenuItemName || !newMenuItemPrice) {
    toast.error("Invalid menu item data.");
    return;
  }

  toast.loading("Updating menu item...");

  let imageUrlToUpdate = editingMenuItem.image_url;
  const oldImagePath = editingMenuItem.image_url
    ? editingMenuItem.image_url.split("/menu-images/")[1]?.split("?")[0]
    : null;

  try {
    if (newMenuItemImageFile) {
      const file = newMenuItemImageFile;
      const fileExt = file.name.split(".").pop();
      const newFilePath = `${shop.id}/menu_items/${editingMenuItem.id}.${fileExt}`;

      if (oldImagePath && oldImagePath !== newFilePath) {
        const { error: deleteOldError } = await supabase.storage
          .from("menu-images")
          .remove([oldImagePath]);
        if (deleteOldError && deleteOldError.message !== "The resource was not found") {
          console.warn("Could not delete old image from storage:", deleteOldError.message);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(newFilePath, file, { upsert: true });

      if (uploadError) {
        toast.dismiss();
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }
      const { data } = supabase.storage
        .from("menu-images")
        .getPublicUrl(newFilePath);
      imageUrlToUpdate = `${data.publicUrl}?t=${new Date().getTime()}`;
    } else if (oldImagePath && !imagePreviewUrl) {
      const { error: removeError } = await supabase.storage
        .from("menu-images")
        .remove([oldImagePath]);
      if (removeError && removeError.message !== "The resource was not found") {
        console.warn("Could not remove image from storage:", removeError.message);
      }
      imageUrlToUpdate = null;
    }

    // Direct execution: if .throwOnError() doesn't throw, it's a success
    await supabase
      .from("menu_items")
      .update({
        name: newMenuItemName,
        description: newMenuItemDescription || null,
        price: parseFloat(newMenuItemPrice),
        category: newMenuItemCategory || null,
        image_url: imageUrlToUpdate,
      })
      .eq("id", editingMenuItem.id)
      .throwOnError(); // This will throw on error, jumping to the catch block

    toast.dismiss();
    toast.success("Menu item updated!");
    setEditingMenuItem(null);
    setNewMenuItemName("");
    setNewMenuItemDescription("");
    setNewMenuItemPrice("");
    setNewMenuItemCategory("");
    setNewMenuItemImageFile(null);
    setImagePreviewUrl(null);
    setActiveEditSection(null);

  } catch (error: unknown) {
    toast.dismiss();
    console.error("Update menu item error:", error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    toast.error(`Failed to update menu item: ${errorMessage}`);
  }
}, [
  editingMenuItem,
  shop,
  newMenuItemName,
  newMenuItemPrice,
  newMenuItemImageFile,
  supabase,
  newMenuItemDescription,
  newMenuItemCategory,
  imagePreviewUrl,
]);

  const handleDeleteMenuItem = useCallback(
    async (itemId: string, imageUrl: string | null) => {
      if (!confirm("Are you sure you want to delete this menu item?")) return;

      toast.loading("Deleting menu item...");
      try {
        if (imageUrl) {
          const imagePath = imageUrl.split("/menu-images/")[1]?.split("?")[0];
          if (imagePath) {
            const { error: storageError } = await supabase.storage
              .from("menu-images")
              .remove([imagePath]);
            if (
              storageError &&
              storageError.message !== "The resource was not found"
            ) {
              console.warn(
                "Could not delete image from storage:",
                storageError.message,
              );
            }
          }
        }

        await supabase
          .from("menu_items")
          .delete()
          .eq("id", itemId)
          .throwOnError();
        toast.dismiss();
        toast.success("Menu item deleted.");
      } catch (error: unknown) { // Changed 'any' to 'unknown'
        toast.dismiss();
        console.error("Delete menu item error:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(`Could not delete menu item: ${errorMessage}`);
      }
    },
    [supabase],
  );

  const handleToggleMenuItemAvailability = useCallback(
    async (item: MenuItem) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", item.id);
      if (error) {
        toast.error(`Failed to update availability: ${error.message}`);
      } else {
        toast.success(`'${item.name}' availability updated.`);
      }
    },
    [supabase],
  );

  // MODIFIED: handleUpdateOrderStatus to transition orders
  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order["status"]) => {
      // Skip confirmation for 'ready_for_pickup' and 'completed'
      if (
        (newStatus !== "ready_for_pickup" && newStatus !== "completed") &&
        !confirm(`Are you sure you want to mark this order as ${newStatus}?`)
      ) {
        return;
      }

      // Check if trying to complete an order when trial limit is reached
      if (newStatus === "completed" && totalEventCount >= 50 &&
          (shop?.subscription_status === "trial" || shop?.subscription_status === null)) {
        toast.error("Trial limit reached. Please upgrade to complete more orders.");
        return; // Prevent completing the order
      }
      // Check if trying to mark as "ready_for_pickup" when trial limit is reached
      if (newStatus === "ready_for_pickup" && totalEventCount >= 50 &&
          (shop?.subscription_status === "trial" || shop?.subscription_status === null)) {
        toast.error("Trial limit reached. Please upgrade to prepare more orders.");
        return; // Prevent marking as ready for pickup
      }


      toast.loading(`Updating order status to ${newStatus}...`);

      try {
        // Logic to insert a billable event when an order is completed
        // This is only triggered if the order is allowed to be completed
        if (newStatus === "completed" && shop) {
          const { error: billableError } = await supabase
            .from("billable_events")
            .insert({
              shop_id: shop.id,
              queue_entry_id: orderId, // Using orderId as queue_entry_id for generic tracking
              status: "completed", // Status for the billable_event itself
              is_billable: true, // Mark this event as billable
            });

          if (billableError) {
            console.error("Could not create billable event:", billableError);
            toast.warning(
              "Could not log this order for billing. Please contact support.",
            );
          }
        }

        // --- NEW CODE BLOCK FOR SMS NOTIFICATION ---
        if (newStatus === "ready_for_pickup" && shop) {
          // Find the specific order from the preparingOrders state (it moves from preparing to ready)
          // We need this to check its current order_ready_notified_at status and client_phone
          const orderToNotify = preparingOrders.find(order => order.id === orderId);

          // Only attempt to send SMS if the order hasn't been notified yet
          if (orderToNotify && !orderToNotify.order_ready_notified_at) {
            // Check trial limit for SMS sending (reusing general trial limit for simplicity)
            // If SMS is a separate billable item, you'd have a more specific check here.
            if (totalEventCount >= 50 && (shop.subscription_status === "trial" || shop.subscription_status === null)) {
                toast.error("Trial limit reached. SMS notification not sent. Please upgrade.");
                // Still allow status update, just skip SMS
            } else {
                console.log(`Order ${orderId} is ready. Attempting to send SMS notification...`);
                const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
                  "notify-customer",
                  {
                    body: {
                      entity_id: orderId, // The order ID
                      type: 'order',     // Specify type as 'order' for the generic Edge Function
                    },
                  },
                );

                if (invokeError) {
                  toast.error(`Failed to send SMS notification: ${invokeError.message}`);
                  console.error("SMS invoke error:", invokeError);
                } else {
                  // The Edge Function returns a message indicating success or skip (if phone missing)
                  if (invokeData?.message?.includes("skipped")) {
                    toast.info(`SMS skipped for order ${orderId}: ${invokeData.message}`);
                  } else {
                    toast.success(`SMS notification sent for order ${orderId}!`);
                  }
                }
            }
          } else if (orderToNotify?.order_ready_notified_at) {
            toast.info(`Notification for order ${orderId} has already been sent.`);
          }
        }
        // --- END NEW CODE BLOCK ---


        // Update the order status in the 'orders' table
        // Removed 'const { error } =' here because .throwOnError() handles error propagation
        await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", orderId)
          .throwOnError(); // This will throw an error if the operation fails, which is caught below.

        toast.dismiss(); // Dismiss the loading toast

        // If execution reaches here, it means the supabase update was successful.
        toast.success(
          `Order ${orderId.substring(0, 8)}... status updated to ${newStatus}.`,
        );

        // Re-fetch orders and usage counts to update the UI across all relevant sections
        if (shop?.id) {
          fetchOrders(shop.id);
          fetchUsageCounts(shop.id); // This is important to update the usage display
        }
      } catch (error: unknown) { // This catch block handles errors thrown by .throwOnError()
        // Catch any errors thrown by .throwOnError() or other async operations
        toast.dismiss();
        console.error("Error during order status update or billable event creation:", error);
        let errorMessage = 'An unexpected error occurred.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(`Failed to update order: ${errorMessage}`);
      }
    },
    // Dependencies for useCallback:
    [supabase, shop, fetchOrders, fetchUsageCounts, totalEventCount, preparingOrders],
);

// Helper for phone validation (reuse from customer page)
const isValidAustralianPhone = useCallback((phone: string) => /^(04|\(04\)|\+614|02|03|07|08)\d{8}$/.test(phone.replace(/\s/g, '')), []);


// NEW: Handle adding a manual order from the dashboard
const handleAddManualOrder = useCallback(async (e: React.FormEvent) => {
  e.preventDefault(); // Prevent default form submission

  if (manualCart.length === 0 || !manualClientName) {
    toast.error('Please add items and fill in the customer name for the manual order.');
    return;
  }
  if (manualClientPhone && !isValidAustralianPhone(manualClientPhone)) {
    toast.error('Please enter a valid 10-digit Australian phone number for the customer, or leave it blank.');
    return;
  }
  if (!shop) { // Ensure shop data is loaded
    toast.error('Shop data not loaded. Cannot add manual order.');
    return;
  }

  toast.loading("Adding manual order...", { id: "manual-order-toast" });

  try {
    const totalAmount = manualCart.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);

    // 1. Insert into 'orders' table
    const { data: newOrder, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        shop_id: shop.id, // Use current shop ID
        client_name: manualClientName,
        client_phone: manualClientPhone || null,
        total_amount: totalAmount,
        surcharge_amount: 0, // No surcharge for manual orders
        status: 'preparing', // Mark as completed immediately for manual cash orders
        is_paid: true, // Mark as paid immediately
        notes: manualOrderNotes || null,
      })
      .select('id') // Select the new order's ID
      .single();

    if (orderInsertError || !newOrder) {
      console.error("Supabase Manual Order Insert Error:", orderInsertError);
      throw new Error('Failed to create manual order record.');
    }

    // 2. Insert into 'order_items' table
    const orderItemsToInsert = manualCart.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price_at_order: item.price,
      notes: item.description || null, // Reusing description as item notes, adjust if needed
    }));

    const { error: itemsInsertError } = await supabase.from('order_items').insert(orderItemsToInsert);

    if (itemsInsertError) {
      console.error("Supabase Manual Order Items Insert Error:", itemsInsertError);
      // OPTIONAL: Rollback the main order if order_items insertion fails
      await supabase.from('orders').delete().eq('id', newOrder.id);
      throw new Error('Manual order placed but failed to save items. Please contact support.');
    }

    // 3. Trigger billable event (if applicable)
    // This is important for usage tracking
    const { error: billableError } = await supabase
      .from("billable_events")
      .insert({
        shop_id: shop.id,
        queue_entry_id: newOrder.id, // Using orderId as queue_entry_id for generic tracking
        status: "completed", // Status for the billable_event itself
        is_billable: true, // Mark as billable
      });
    if (billableError) {
      console.warn("Could not create billable event for manual order:", billableError);
      toast.warning("Manual order added, but could not log for billing. Contact support.");
    }

    toast.dismiss("manual-order-toast");
    toast.success(`Manual Order ${newOrder.id.substring(0, 8)}... added successfully!`);

    // Reset dialog states and close
    setManualClientName('');
    setManualClientPhone('');
    setManualOrderNotes('');
    setManualCart([]);
    setIsAddOrderDialogOpen(false);

    // Refresh dashboard data to show new order in history
    fetchOrders(shop.id);
    fetchUsageCounts(shop.id);

  } catch (error: unknown) { // Changed 'any' to 'unknown'
    toast.dismiss("manual-order-toast");
    console.error("Error adding manual order:", error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    toast.error(`Failed to add manual order: ${errorMessage}`);
  }
}, [manualCart, manualClientName, manualClientPhone, manualOrderNotes, shop, supabase, fetchOrders, fetchUsageCounts, isValidAustralianPhone]);

  // Handle Update Shop Details (from Barber Shop dashboard)
  const handleUpdateShopDetails = useCallback(async () => { // Wrapped in useCallback
    if (!shop) return;

    toast.loading("Updating shop details...");

    let logoUrlToUpdate = shop.logo_url;

    if (newShopLogoFile) {
      const file = newShopLogoFile;
      const fileExt = file.name.split(".").pop();
      // Ensure path matches RLS policy used in Food Truck context
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
    } else if (logoPreviewUrl === null && shop.logo_url) { // Scenario: existing logo was removed
      // If logoPreviewUrl is explicitly null AND there was an old logo
      // This means the user cleared the logo. Delete from storage if it exists.
      const logoPath = shop.logo_url.split("/shop-logos/")[1]?.split("?")[0];
      if (logoPath) {
        const { error: removeError } = await supabase.storage
          .from("shop-logos")
          .remove([logoPath]);
        if (removeError && removeError.message !== "The resource was not found") {
          console.warn("Could not remove old logo from storage:", removeError.message);
          // Don't block the main update, just warn
        }
      }
      logoUrlToUpdate = null; // Ensure DB entry is null

    }


    const { data: updatedShop, error } = await supabase
      .from("shops")
      .update({
        name: editedShopName,
        address: editedShopAddress,
        opening_time: editedOpeningTime,
        closing_time: editedClosingTime,
        logo_url: logoUrlToUpdate,
        enable_online_payments: enableOnlinePayments,
        pass_stripe_fees_to_customer: passStripeFees,
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
      setNewShopLogoFile(null); // Clear file input state
      setLogoPreviewUrl(updatedShop.logo_url); // Ensure preview matches new state
    }
  }, [
    shop, editedShopName, editedShopAddress, editedOpeningTime, editedClosingTime,
    newShopLogoFile, logoPreviewUrl, enableOnlinePayments, passStripeFees, supabase
  ]); // Added dependencies

  // Handles deleting the shop logo (from Barber Shop dashboard)
  const handleDeleteLogo = useCallback(async () => { // Wrapped in useCallback
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

      if (storageError && storageError.message !== "The resource was not found") {
        throw storageError;
      }

      const { data: updatedShop, error: dbError } = await supabase
        .from("shops")
        .update({ logo_url: null })
        .eq("id", shop.id)
        .select()
        .single();

      if (dbError) throw dbError;

      setShop(updatedShop);
      setLogoPreviewUrl(null); // Clear preview instantly
      setNewShopLogoFile(null); // Clear file input state
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
  }, [shop, supabase]); // Added dependencies


  // Handles click on the "Upgrade Now" button in billing (from Barber Shop dashboard)
  const handleUpgradeClick = useCallback(async () => {
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
  }, [supabase]);

  // Handles submission of billing email (from Barber Shop dashboard)
  const handleEmailSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!billingEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsEmailPromptVisible(false); // Proceed to payment form
  }, [billingEmail]);

  // Retries a failed payment (from Barber Shop dashboard)
  const handleRetryPayment = useCallback(async () => {
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
          setFailedInvoice(null);
        }
        setIsBillingDialogOpen(false);
      }
    } catch (error: unknown) { // Changed 'any' to 'unknown'
      toast.dismiss("retry-payment-toast");
      console.error("Unexpected error during payment retry:", error);
      let errorMessage = 'An unexpected error occurred during payment retry.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    }
  }, [shop, failedInvoice, supabase]);


  // Renders the content for different edit dialog sections
  const renderEditDialogContent = useCallback(() => {
    if (!activeEditSection) return null;

    switch (activeEditSection) {
      case "details":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Edit Food Truck Details</DialogTitle>
              <DialogDescription>
                Manage your food truck&apos;s general information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4 border-t pt-4">
              <h3 className="font-semibold">Payment Options</h3>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-online-payments"
                  checked={enableOnlinePayments}
                  onCheckedChange={setEnableOnlinePayments}
                />
                <Label htmlFor="enable-online-payments">Enable Online Payments (Stripe Checkout)</Label>
              </div>
              {enableOnlinePayments && ( // Only show if online payments are enabled
                <div className="flex items-center space-x-2">
                  <Switch
                    id="pass-stripe-fees"
                    checked={passStripeFees}
                    onCheckedChange={setPassStripeFees}
                  />
                  <Label htmlFor="pass-stripe-fees">Pass Stripe Fees to Customer as Surcharge</Label>
                </div>
              )}
            </div>
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
      case "menu": // Original Food Truck Menu Edit
        return (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingMenuItem ? "Edit Menu Item" : "Add New Menu Item"}
              </DialogTitle>
              <DialogDescription>
                {editingMenuItem
                  ? "Modify details of this menu item."
                  : "Add a new item to your food truck menu."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="grid gap-4 pt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="menu-item-name">Name</Label>
                    <Input
                      id="menu-item-name"
                      value={newMenuItemName}
                      onChange={(e) => setNewMenuItemName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="menu-item-description">Description</Label>
                    <Input
                      id="menu-item-description"
                      placeholder="Optional description"
                      value={newMenuItemDescription}
                      onChange={(e) =>
                        setNewMenuItemDescription(e.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="menu-item-price">Price</Label>
                      <Input
                        id="menu-item-price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newMenuItemPrice}
                        onChange={(e) => setNewMenuItemPrice(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="menu-item-category">Category</Label>
                      <Input
                        id="menu-item-category"
                        placeholder="e.g., Mains, Drinks"
                        value={newMenuItemCategory}
                        onChange={(e) => setNewMenuItemCategory(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Image</Label>
                    {imagePreviewUrl && (
                      <div className="mb-2">
                        <Image
                          src={imagePreviewUrl}
                          alt="Image Preview"
                          width={100}
                          height={100}
                          className="rounded-md object-cover"
                        />
                      </div>
                    )}
                    <Input
                      id="new-menu-item-image"
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleNewMenuItemImageChange}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingMenuItem(null)}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={
                  editingMenuItem ? handleUpdateMenuItem : handleAddMenuItem
                }
              >
                {editingMenuItem ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </>
        );
      case "qr": // Original Food Truck QR Code (now with Barber's general QR gen logic)
        return (
          <>
            <DialogHeader>
              <DialogTitle>Food Truck QR Code</DialogTitle>
              <DialogDescription>
                Customers can scan this code to go directly to your ordering
                page.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center justify-center gap-4 pt-4">
                  {qrCodeDataUrl ? (
                    <Image
                      src={qrCodeDataUrl}
                      alt="Food Truck QR Code"
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
                        download={`${shop?.name || "FoodTruck"}-QRCode.png`}
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
      default:
        return null;
    }
  }, [
    activeEditSection,
    editingMenuItem,
    newMenuItemName,
    newMenuItemPrice,
    newMenuItemDescription,
    newMenuItemCategory,
    imagePreviewUrl,
    handleNewMenuItemImageChange,
    handleUpdateMenuItem,
    handleAddMenuItem,
    qrCodeDataUrl,
    generateQRCode,
    shop, // Added shop as a dependency for shop details edit (logo_url, name)
    editedShopName, editedShopAddress, editedOpeningTime, editedClosingTime,
    logoPreviewUrl, handleDeleteLogo, handleUpdateShopDetails,
    enableOnlinePayments, passStripeFees, // Added these for shop details form
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If this is a new user and they don't have a shop yet, direct them to create one
  // This is a placeholder, as CreateShopForm is from barber shop context.
  // In a real scenario, you'd have a food_truck specific CreateShopForm or flow.
  // For now, if no shop, show a simple message or redirect.
  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground mb-4">
          You don&apos;t have a food truck shop set up yet.
        </p>
        <Button onClick={() => router.push("/create-shop-food-truck")}>
          Create Your Food Truck Shop
        </Button>
      </div>
    );
  }

  // Helper component to render an order card (reused for different sections)
  const OrderCard = ({ order, actions }: { order: Order; actions: React.ReactNode }) => (
    <Card className="border-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          Order #{order.id.substring(0, 8)}...
          <Badge variant="secondary" className="capitalize">
            {order.status.replace(/_/g, " ")}
          </Badge>
        </CardTitle>
        <CardDescription>
          Customer: {order.client_name}
          {order.client_phone && ( // Only show phone if it exists
            <span className="block text-sm">
              Phone: {order.client_phone}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-muted-foreground text-sm mb-2">
          Total: ${order.total_amount.toFixed(2)}
        </p>
        {order.notes && (
          <p className="text-sm text-muted-foreground mb-2 italic">
            Notes: {order.notes}
          </p>
        )}

        {/* This Accordion is for Order Items within the card itself */}
        <Accordion
          type="single"
          collapsible
          defaultValue={order.status === "ready_for_pickup" ? undefined : "order-items"}
          className="w-full"
        >
          <AccordionItem value="order-items">
            <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
              View Items ({order.order_items.length})
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-0">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {order.order_items.map((oi, idx) => (
                  <li key={idx}>
                    {oi.quantity}x{" "}
                    <span className="font-medium text-foreground">
                      {oi.menu_items?.name || "Unknown Item"}
                    </span>{" "}
                    (${(oi.quantity * oi.price_at_order).toFixed(2)})
                    {oi.notes && (
                      <span className="block italic pl-4">
                        - Notes: {oi.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-col gap-2 mt-4">
          {actions}
        </div>
      </CardContent>
    </Card>
  );

  // Helper component to render a client history card for mobile
  const ClientHistoryCard = ({ order }: { order: ClientOrderHistoryItem }) => (
    <Card className="border-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          Order #{order.id.substring(0, 8)}...
          <Badge variant="secondary" className="capitalize">
            {order.status.replace(/_/g, " ")}
          </Badge>
        </CardTitle>
        <CardDescription>
          Client: {order.client_name}
          <span className="block text-sm">
            Time: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-muted-foreground text-sm mb-2">
          Total: ${order.total_amount.toFixed(2)}
        </p>
        {order.notes && (
          <p className="text-sm text-muted-foreground mb-2 italic">
            Notes: {order.notes}
          </p>
        )}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="history-items">
            <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
              View Items ({order.order_items.length})
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-0">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {order.order_items.map((oi, idx) => (
                  <li key={idx}>
                    {oi.quantity}x{" "}
                    <span className="font-medium text-foreground">
                      {oi.menu_items?.name || "Unknown Item"}
                    </span>{" "}
                    (${(oi.quantity * oi.price_at_order).toFixed(2)})
                    {oi.notes && (
                      <span className="block italic pl-4">
                        - Notes: {oi.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );

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
                      onSelect={() => window.open(`/shop/${shop.id}`, "_blank")}
                    >
                      Order Page
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setActiveEditSection("details")}
                    >
                      Edit Shop Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsAddOrderDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Order
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection("qr")}>
                      Get QR Code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsBillingDialogOpen(true)}>
                      Billing & Subscription
                    </DropdownMenuItem>
                    {/* NEW: Onboarding link in mobile settings */}
                    {!shop.is_charges_enabled && (
                        <DropdownMenuItem onSelect={handleOnboardStripeAccount}>
                          <CreditCard className="mr-2 h-4 w-4" /> Setup Payments
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => {
                        supabase.auth.signOut();
                        router.push("/");
                      }}
                    >
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
                      <span className="font-bold text-primary">{monthlyBillableEventCount}</span> billable orders this month.
                    </p>
                  );
                }
              })()}
            </div>
          </div>

          {/* Desktop Navigation (remains unchanged) */}
          <div className="hidden md:flex items-center gap-2">
            <Link href={`/shop/${shop.id}`} target="_blank">
              <Button
                variant="outline"
                className="hover:text-primary hover:border-primary transition-colors"
              >
                Order Page
              </Button>
            </Link>
            <Button onClick={() => setIsAddOrderDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Order
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="transition-transform hover:scale-105">
                  Settings <Settings className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setActiveEditSection("details")}
                >
                  Shop Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveEditSection("qr")}>
                  Get QR Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsBillingDialogOpen(true)}>
                  Billing & Subscription
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              className="hover:text-primary transition-colors"
              onClick={() => {
                supabase.auth.signOut();
                router.push("/");
              }}
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
              <Button
                onClick={handleRetryPayment}
                className="mt-3 bg-white text-destructive hover:bg-gray-100 border border-destructive"
              >
                Retry Payment
              </Button>
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeIn} initial="initial" animate="animate">
          {(!shop.stripe_connect_account_id) && (
              <Card className="mb-6 p-6 text-center bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <CardTitle className="text-yellow-800 dark:text-yellow-300 flex items-center justify-center gap-2">
                      <CreditCard className="h-6 w-6" /> Setup Payments Required!
                  </CardTitle>
                  <CardDescription className="mt-2 text-yellow-700 dark:text-yellow-400">
                      Before you can receive online payments for customer orders, you need to connect and verify your Stripe account.
                  </CardDescription>
                  <Button
                      onClick={handleOnboardStripeAccount}
                      className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                      Go to Stripe Onboarding
                  </Button>
              </Card>
          )}
      </motion.div>

        {/* Universal Edit Dialog */}
        <Dialog
          open={!!activeEditSection}
          onOpenChange={(isOpen) => !isOpen && setActiveEditSection(null)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {renderEditDialogContent()}
          </DialogContent>
        </Dialog>

        {/* NEW: Add Order Dialog */}
      <Dialog open={isAddOrderDialogOpen} onOpenChange={setIsAddOrderDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Add Manual Order</DialogTitle>
            <DialogDescription>
              Record an order taken directly at the food truck (e.g., cash payment).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddManualOrder}>
            <div className="grid gap-4 py-4">
              {/* Customer Details */}
              <div className="grid gap-2">
                  <Label htmlFor="manual-client-name">Customer Name</Label>
                  <Input id="manual-client-name" placeholder="e.g., Jane Doe" value={manualClientName} onChange={e => setManualClientName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="manual-client-phone">Customer Phone (Optional)</Label>
                  <Input
                      id="manual-client-phone"
                      type="tel"
                      placeholder="e.g., 0412 345 678"
                      value={manualClientPhone}
                      onChange={e => setManualClientPhone(e.target.value)}
                  />
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 italic">
                      <Info className="h-3 w-3 inline-block" />
                      Phone number is used for SMS notifications when the order is ready.
                  </p>
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="manual-order-notes">Special Requests/Notes (Optional)</Label>
                  <Input id="manual-order-notes" placeholder="e.g., extra sauce" value={manualOrderNotes} onChange={e => setManualOrderNotes(e.target.value)} />
              </div>

              <Separator className="my-4" />

              {/* Manual Order Cart */}
              <h3 className="text-lg font-semibold flex items-center gap-2">
                  Order Items <Badge variant="secondary">${manualCart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</Badge>
              </h3>
              <div className="max-h-40 overflow-y-auto pr-2 border-b pb-2">
                  {manualCart.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No items added to this order.</p>
                  ) : (
                      manualCart.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm mb-1">
                              <span>{item.quantity}x {item.name}</span>
                              <span>${(item.quantity * item.price).toFixed(2)}</span>
                              <div>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setManualCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))}>-</Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setManualCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}>+</Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setManualCart(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4"/></Button>
                              </div>
                          </div>
                      ))
                  )}
              </div>

              {/* Add Item to Manual Order */}
              <div className="grid gap-2">
                  <Label htmlFor="add-manual-item">Add Menu Item</Label>
                  <Select onValueChange={(menuItemId) => {
                      const itemToAdd = menuItems.find(m => m.id === menuItemId);
                      if (itemToAdd) {
                          setManualCart(prevCart => {
                              const existing = prevCart.find(item => item.id === itemToAdd.id);
                              if (existing) {
                                  return prevCart.map(item => item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item);
                              }
                              return [...prevCart, { ...itemToAdd, quantity: 1 }];
                          });
                      }
                  }} value=""> {/* Reset select value after selection */}
                      <SelectTrigger id="add-manual-item">
                          <SelectValue placeholder="Select an item to add" />
                      </SelectTrigger>
                      <SelectContent>
                          {menuItems.map(item => (
                              <SelectItem key={item.id} value={item.id} disabled={!item.is_available}>
                                  {item.name} (${item.price.toFixed(2)}) {item.is_available ? '' : '(Sold Out)'}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddOrderDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  loading ||
                  manualCart.length === 0 ||
                  !manualClientName ||
                  (manualClientPhone !== '' && !isValidAustralianPhone(manualClientPhone)) // FIXED LINE
                }
              >
                {isSubmitting ? 'Adding...' : 'Add Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        {/* END NEW: Add Order Dialog */}

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
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div variants={fadeIn} className="space-y-4">
                  {shop.subscription_status === "past_due" && failedInvoice && (
                    <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
                      <p className="font-bold">Payment Failed</p>
                      <p className="text-sm">
                        Your payment of $
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
                              "Payment method updated successfully!",
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
                                "Error refreshing shop data after update:",
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

        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn}>
            <Separator className="my-8 bg-border/50" />
          </motion.div>

          {/* Conditional Getting Started Guide for Food Truck / OR Orders & Menu */}
          {menuItems.length === 0 ? (
            <motion.div variants={fadeIn} className="mt-8 mb-8">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Wand2 className="h-6 w-6" />
                    Welcome! Let&apos;s Get You Started.
                  </CardTitle>
                  <CardDescription>
                    Your food truck operations dashboard will come to life once
                    you add your menu items.
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
                        title: "Add Your First Menu Item",
                        description:
                          'Click the "Add New Item" button in the "Your Menu" section below to start building your delicious offerings.',
                      },
                      {
                        title: "Share Your QR Code",
                        description:
                          'Generate your food truck\'s unique QR code from the "Settings" dropdown and share it with your customers so they can easily place orders!',
                      },
                      {
                        title: "Monitor Orders",
                        description:
                          'Once customers start ordering, you\'ll see them in "Orders In Progress" and "Ready for Pickup" sections.',
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
            <>
              {/* --- ORDER SECTIONS --- */}

              {/* Orders In Progress (Preparing) Section */}
              <motion.div variants={fadeIn} className="mb-8">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChefHat className="h-6 w-6" />
                      Orders In Progress
                    </CardTitle>
                    <CardDescription>
                      These orders are currently being prepared. Mark them as &apos;Ready for Pickup&apos; when done.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {preparingOrders.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {preparingOrders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            actions={
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateOrderStatus(order.id, "ready_for_pickup")
                                  }
                                  className="w-full"
                                  disabled={
                                    totalEventCount >= 50 &&
                                    (shop.subscription_status === "trial" ||
                                      shop.subscription_status === null)
                                  }
                                >
                                  <PackageCheck className="mr-2 h-4 w-4" /> Ready for Pickup
                                </Button>
                                {totalEventCount >= 50 &&
                                  (shop.subscription_status === "trial" ||
                                    shop.subscription_status === null) && (
                                    <p className="text-sm text-destructive font-semibold text-center mt-2">
                                      Trial ended. Please upgrade to manage orders.
                                    </p>
                                  )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateOrderStatus(order.id, "cancelled")
                                  }
                                  className="w-full text-destructive hover:bg-destructive/10 border-destructive/50"
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                                </Button>
                              </>
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border-2 border-dashed rounded-lg">
                        <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">
                          No Orders in Preparation
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          New customer orders will appear here.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeIn}>
                <Separator className="my-8 bg-border/50" />
              </motion.div>

              {/* Ready for Pickup Orders Section */}
              <motion.div variants={fadeIn} className="mb-8">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PackageCheck className="h-6 w-6" />
                      Ready for Pickup
                    </CardTitle>
                    <CardDescription>
                      These orders are ready for customers to collect. Tap &apos;Completed&apos; when picked up.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {readyForPickupOrders.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {readyForPickupOrders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            actions={
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateOrderStatus(order.id, "completed")
                                  }
                                  className="w-full"
                                  disabled={
                                    totalEventCount >= 50 &&
                                    (shop.subscription_status === "trial" ||
                                      shop.subscription_status === null)
                                  }
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Completed
                                </Button>
                                {totalEventCount >= 50 &&
                                  (shop.subscription_status === "trial" ||
                                    shop.subscription_status === null) && (
                                    <p className="text-sm text-destructive font-semibold text-center mt-2">
                                      Trial ended. Please upgrade to mark as completed.
                                    </p>
                                  )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateOrderStatus(order.id, "cancelled")
                                  }
                                  className="w-full text-destructive hover:bg-destructive/10 border-destructive/50"
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                                </Button>
                              </>
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border-2 border-dashed rounded-lg">
                        <PackageCheck className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">
                          No Orders Ready for Pickup
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Orders will move here once they are prepared.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeIn}>
                <Separator className="my-8 bg-border/50" />
              </motion.div>

              {/* Client History Section */}
              <motion.div variants={fadeIn} className="mb-8">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-6 w-6" />
                      Completed Order History (Last 2 Hours)
                    </CardTitle>
                    <CardDescription>
                      A quick glance at completed or cancelled orders from the last 2 hours.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {clientHistory.length > 0 ? (
                      <>
                        {isMobile ? (
                          // Mobile View: Grid of ClientHistoryCard components
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clientHistory
                              .slice(0, showAllHistory ? clientHistory.length : 5)
                              .map((order) => (
                                <ClientHistoryCard key={order.id} order={order} />
                              ))}
                          </div>
                        ) : (
                          // Desktop View: Table
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead className="text-right">Items</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientHistory
                                .slice(0, showAllHistory ? clientHistory.length : 5)
                                .map((order) => (
                                  <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.id.substring(0, 8)}...</TableCell>
                                    <TableCell>{order.client_name}</TableCell>
                                    <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize">
                                        {order.status.replace(/_/g, " ")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                      {order.order_items.slice(0,2).map((oi) => oi.quantity + 'x ' + (oi.menu_items?.name || 'Item')).join(', ') +
                                         (order.order_items.length > 2 ? ', ...' : '')}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        )}
                        {clientHistory.length > 5 && (
                          <div className="flex justify-center mt-4">
                            <Button
                              variant="outline"
                              onClick={() => setShowAllHistory(!showAllHistory)}
                            >
                              {showAllHistory ? "Show Less" : `Show All (${clientHistory.length})`}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center p-6 border-2 border-dashed rounded-lg">
                        <History className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">
                          No Completed/Cancelled Orders in Last 2 Hours
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Recently completed or cancelled orders will appear here.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
          {/* Menu Management Section */}
          <motion.div variants={fadeIn} className="mb-8">
            <Card className="bg-card border-border">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-6 w-6" />
                  Your Menu
                </CardTitle>
                <Button
                  onClick={() => {
                    setActiveEditSection("menu");
                    setEditingMenuItem(null);
                    setNewMenuItemName("");
                    setNewMenuItemDescription("");
                    setNewMenuItemPrice("");
                    setNewMenuItemCategory("");
                    setNewMenuItemImageFile(null);
                    setImagePreviewUrl(null);
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Item
                </Button>
              </CardHeader>
              <CardContent>
                {menuItems.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(categorizedMenuItems.sortedCategories).map(([category, items]) => (
                      <AccordionItem value={category} key={category}>
                        <AccordionTrigger className="text-lg font-semibold py-4 hover:no-underline">
                          {category} ({items.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60px]">Image</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead className="w-[100px]">Price</TableHead>
                                <TableHead className="w-[100px] text-center">Available</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    {item.image_url ? (
                                      <Image
                                        src={item.image_url}
                                        alt={item.name}
                                        width={40}
                                        height={40}
                                        className="rounded-md object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{item.name}</div>
                                    {item.description && (
                                      <div className="text-sm text-muted-foreground">
                                        {item.description}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>${item.price.toFixed(2)}</TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleToggleMenuItemAvailability(item)
                                      }
                                      className={
                                        item.is_available
                                          ? "text-green-600 hover:bg-green-100"
                                          : "text-red-600 hover:bg-red-100"
                                      }
                                      title={
                                        item.is_available
                                          ? "Mark as unavailable"
                                          : "Mark as available"
                                      }
                                    >
                                      {item.is_available ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                      ) : (
                                        <XCircle className="h-5 w-5" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditMenuItem(item)}
                                      title="Edit item"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="hover:text-destructive"
                                      onClick={() =>
                                        handleDeleteMenuItem(
                                          item.id,
                                          item.image_url,
                                        )
                                      }
                                      title="Delete item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    ))}

                    {/* Uncategorized Items Section */}
                    {categorizedMenuItems.uncategorized.length > 0 && (
                      <AccordionItem value="Uncategorized" key="uncategorized">
                        <AccordionTrigger className="text-lg font-semibold py-4 hover:no-underline">
                          Uncategorized ({categorizedMenuItems.uncategorized.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60px]">Image</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead className="w-[100px]">Price</TableHead>
                                <TableHead className="w-[100px] text-center">Available</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categorizedMenuItems.uncategorized.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    {item.image_url ? (
                                      <Image
                                        src={item.image_url}
                                        alt={item.name}
                                        width={40}
                                        height={40}
                                        className="rounded-md object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{item.name}</div>
                                    {item.description && (
                                      <div className="text-sm text-muted-foreground">
                                        {item.description}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>${item.price.toFixed(2)}</TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleToggleMenuItemAvailability(item)
                                      }
                                      className={
                                        item.is_available
                                          ? "text-green-600 hover:bg-green-100"
                                          : "text-red-600 hover:bg-red-100"
                                      }
                                      title={
                                        item.is_available
                                          ? "Mark as unavailable"
                                          : "Mark as available"
                                      }
                                    >
                                      {item.is_available ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                      ) : (
                                        <XCircle className="h-5 w-5" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditMenuItem(item)}
                                      title="Edit item"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="hover:text-destructive"
                                      onClick={() =>
                                        handleDeleteMenuItem(
                                          item.id,
                                          item.image_url,
                                        )
                                      }
                                      title="Delete item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                ) : (
                  <div className="text-center p-6 border-2 border-dashed rounded-lg">
                    <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">
                      No Menu Items Added Yet
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first item to start building your food truck
                      menu!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}