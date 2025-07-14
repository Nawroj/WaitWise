// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import {
  Trash2,
  RefreshCw,
  QrCode,
  CreditCard,
  ListPlus,
  UserPlus,
  Store,
  Users,
  ChevronDown,
  ChevronLeftCircle,
  Info, Loader2,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Switch } from "../../../components/ui/switch";
import { motion, easeInOut } from "framer-motion";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StripePaymentForm } from "../../../components/ui/StripePaymentForm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";

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

type SettingSection = "shop_details" | "services" | "staff" | "qr_code" | "billing";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  // State variables for shop data and UI elements
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedSetting, setSelectedSetting] = useState<SettingSection>("shop_details");

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
  const [barberForBreak, setBarberForBreak] = useState<Barber | null>(null);
  const [breakDuration, setBreakDuration] = useState("15");
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Billing states
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [isEmailPromptVisible, setIsEmailPromptVisible] = useState(false);
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null);
  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  );

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

  // Initial data fetch on component mount: user, shop, services, barbers
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
        setLogoPreviewUrl(shopData.logo_url || null);
        fetchShopData(shopData.id);
      }
      setLoading(false);
    }
    fetchUserAndShop();
  }, [supabase, router, fetchShopData]);

  // Effect to generate QR code when the QR section is actively selected
  useEffect(() => {
    if (selectedSetting === "qr_code" && !qrCodeDataUrl) {
      generateQRCode();
    }
  }, [selectedSetting, qrCodeDataUrl, generateQRCode]);

  // Fetches the latest failed invoice if subscription status is 'past_due'
  useEffect(() => {
    if (shop?.subscription_status === "past_due") {
      const fetchFailedInvoice = async () => {
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
          setFailedInvoice(data);
        }
      };
      fetchFailedInvoice();
    }
  }, [shop, supabase]);

  // Real-time subscriptions for barbers and services updates
  useEffect(() => {
    if (!shop) return;

    const barbersChannel = supabase
      .channel(`barbers_for_${shop.id}_settings`)
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
      .channel(`services_for_${shop.id}_settings`)
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
      supabase.removeChannel(barbersChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, [shop, supabase, fetchShopData]);

  // Handles updating shop details
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
      setNewShopLogoFile(null);
      setLogoPreviewUrl(updatedShop.logo_url || null);
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

  // Retries a failed payment
  const handleRetryPayment = async () => {
    if (!shop || !failedInvoice) return;

    if (shop.stripe_payment_method_id === null) {
      toast.error("No payment method found on file. Please add or update it.", {
        action: {
          label: "Update Method",
          onClick: () => {
            setSelectedSetting("billing");
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
          setSelectedSetting("billing");
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
          actionOnClick = () => {};
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
        setIsUpgrading(false);
      }
    } catch (error: unknown) {
      toast.dismiss("retry-payment-toast");
      console.error("Unexpected error during payment retry:", error);
      toast.error("An unexpected error occurred during payment retry.");
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

  // Conditional render function for main content
  const renderSettingsContent = () => {
    if (!shop) return null;

    switch (selectedSetting) {
      case "shop_details":
        return (
          <motion.div variants={fadeIn}>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 " /> Shop Details
                </CardTitle>
                <CardDescription>
                  Update your shop&apos;s name, address, logo, and opening hours.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
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
              <CardFooter>
                <Button onClick={handleUpdateShopDetails} className="w-full">Save Changes</Button>
              </CardFooter>
            </Card>
          </motion.div>
        );
      case "services":
        return (
          <motion.div variants={fadeIn}>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListPlus className="h-5 w-5" /> Manage Services
                </CardTitle>
                <CardDescription>
                  Add, remove, and edit the services your shop offers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {services.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(categorizedServices).map(([category, itemsInCategory], index) => (
                      <Collapsible key={category} className="space-y-2" defaultOpen={index === 0}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-muted/80 transition-colors rounded-md">
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
                <Button onClick={handleAddService}>Add Service</Button>
              </CardFooter>
            </Card>
          </motion.div>
        );
      case "staff":
        return (
          <motion.div variants={fadeIn}>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Manage Staff
                </CardTitle>
                <CardDescription>
                  Add, remove, and set which staff members are working today.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {barbers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead className="text-center">On Break</TableHead>
                        <TableHead className="text-center">Working Today</TableHead>
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
          </motion.div>
        );
      case "qr_code":
        return (
          <motion.div variants={fadeIn}>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" /> Shop QR Code
                </CardTitle>
                <CardDescription>
                  Customers can scan this code to go directly to your booking
                  page.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-4">
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
                      download={`${shop.name}-QRCode.png`}
                    >
                      <Button>Download</Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      case "billing":
        return (
          <motion.div variants={fadeIn}>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 " /> Billing & Subscription
                </CardTitle>
                <CardDescription>
                  Manage your subscription and payment methods.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {shop.subscription_status === "past_due" && failedInvoice && (
                  <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
                    <p className="font-bold">Payment Failed</p>
                    <p className="text-sm">
                      Your payment of ${" "}
                      {(failedInvoice.amount_due / 100).toFixed(2)} on{" "}
                      {/* Using the standard `format` from date-fns would be better here for consistency */}
                      {new Date(
                        failedInvoice.created_at,
                      ).toLocaleDateString()}{" "}
                      was declined.
                    </p>
                    <Button
                      onClick={handleRetryPayment}
                      className="mt-3 bg-white text-destructive hover:bg-gray-100 border border-destructive"
                    >
                      Retry Payment
                    </Button>
                  </div>
                )}

                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Current Plan</p>
                    <p className="text-2xl font-bold capitalize">
                      {shop.subscription_status === "trial" || shop.subscription_status === null ? "Trial" : shop.subscription_status}
                    </p>
                  </div>
                  {shop.subscription_status === "active" ? (
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                  ) : shop.subscription_status === "past_due" ? (
                    <Badge variant="destructive">Past Due</Badge>
                  ) : (
                    <Badge variant="secondary">Trial</Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {shop.subscription_status === "past_due"
                    ? "Please update your payment method to automatically retry the payment and restore service."
                    : "You have a payment method on file."}
                </p>

                {/* The "Upgrade Now" button and conditional form */}
                {/* This is the change made to use handleUpgradeClick */}
                <Button
                  variant="outline"
                  className="w-full hover:text-primary hover:border-primary"
                  onClick={handleUpgradeClick}
                >
                  {isUpgrading ? "Close Payment Form" : "Update Payment Method / Upgrade"}
                </Button>

                {isUpgrading && (
                  <motion.div variants={fadeIn} className="pt-4">
                    {isEmailPromptVisible ? (
                      <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Please provide a billing email address to continue.
                        </p>
                        <div className="grid gap-2">
                          <Label htmlFor="billing-email-form">Billing Email</Label>
                          <Input
                            id="billing-email-form"
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
                            setIsUpgrading(false);
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
              </CardContent>
            </Card>
          </motion.div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">No Shop Found</h2>
        <p className="text-muted-foreground mb-6">Please create your shop first from the dashboard.</p>
        <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-background text-foreground min-h-screen">
      <motion.header
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="flex items-center justify-between gap-4 mb-6 pb-6 border-b border-border/50"
      >
        <Button variant="ghost" onClick={() => router.back()} className="flex items-center">
  <ChevronLeftCircle className="h-5 w-5" />
</Button>
<h1 className="text-3xl font-bold tracking-tight absolute left-1/2 -translate-x-1/2">Settings</h1>        <div className="hidden lg:block"></div> {/* Spacer for desktop */}
      </motion.header>

      {/* Mobile Navigation Buttons (visible only on small screens) */}
      <motion.div
  initial="initial"
  animate="animate"
  variants={staggerContainer}
  className="lg:hidden flex overflow-x-auto gap-2 pb-4 -mb-4 no-scrollbar border-b border-border/50 mb-6" // Horizontal scrollable tabs
>
  {/* Shop Details Button */}
  <Button
    variant={selectedSetting === "shop_details" ? "default" : "outline"}
    className={`flex-shrink-0 rounded-full transition-all duration-200 ease-in-out ${
      selectedSetting === "shop_details"
        ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
        : "text-[#ff284d] shadow-sm hover:shadow-md hover:bg-muted/50 border-[#ff284d]" // Added border-[#ff284d] for outline color
    }`}
    onClick={() => setSelectedSetting("shop_details")}
  >
    <Info className="mr-2 h-4 w-4" /> Details
  </Button>

  {/* Services Button */}
  <Button
    variant={selectedSetting === "services" ? "default" : "outline"}
    className={`flex-shrink-0 rounded-full transition-all duration-200 ease-in-out ${
      selectedSetting === "services"
        ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
        : "text-[#ff284d] shadow-sm hover:shadow-md hover:bg-muted/50 border-[#ff284d]" // Added border-[#ff284d]
    }`}
    onClick={() => setSelectedSetting("services")}
  >
    <ListPlus className="mr-2 h-4 w-4" /> Services
  </Button>

  {/* Staff Button */}
  <Button
    variant={selectedSetting === "staff" ? "default" : "outline"}
    className={`flex-shrink-0 rounded-full transition-all duration-200 ease-in-out ${
      selectedSetting === "staff"
        ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
        : "text-[#ff284d] shadow-sm hover:shadow-md hover:bg-muted/50 border-[#ff284d]" // Added border-[#ff284d]
    }`}
    onClick={() => setSelectedSetting("staff")}
  >
    <Users className="mr-2 h-4 w-4" /> Staff
  </Button>

  {/* QR Code Button */}
  <Button
    variant={selectedSetting === "qr_code" ? "default" : "outline"}
    className={`flex-shrink-0 rounded-full transition-all duration-200 ease-in-out ${
      selectedSetting === "qr_code"
        ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
        : "text-[#ff284d] shadow-sm hover:shadow-md hover:bg-muted/50 border-[#ff284d]" // Added border-[#ff284d]
    }`}
    onClick={() => setSelectedSetting("qr_code")}
  >
    <QrCode className="mr-2 h-4 w-4" /> QR Code
  </Button>

  {/* Billing Button */}
  <Button
    variant={selectedSetting === "billing" ? "default" : "outline"}
    className={`flex-shrink-0 rounded-full transition-all duration-200 ease-in-out ${
      selectedSetting === "billing"
        ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
        : "text-[#ff284d] shadow-sm hover:shadow-md hover:bg-muted/50 border-[#ff284d]" // Added border-[#ff284d]
    }`}
    onClick={() => setSelectedSetting("billing")}
  >
    <CreditCard className="mr-2 h-4 w-4" /> Billing
  </Button>
</motion.div>
      <motion.div
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        className="flex flex-col lg:flex-row gap-8"
      >
        {/* Left Sidebar Navigation (visible only on large screens) */}
        <nav className="hidden lg:block w-full lg:w-64 flex-shrink-0">
          <Card className="bg-card border-border p-4">
<h2 className="text-lg font-semibold mb-4 text-[#ff284d]">Settings Options</h2>            <div className="flex flex-col space-y-2">
              <Button
                // Keep variant as default/ghost, but we'll override the appearance with className
                variant={selectedSetting === "shop_details" ? "default" : "ghost"}
                className={`justify-start w-full rounded-md transition-all duration-200 ease-in-out ${
                  selectedSetting === "shop_details"
                    ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]" // Selected state: FF284D background, white text, FF284D shadow, darker hover
                    : "text-[#ff284d] hover:bg-muted/50 hover:shadow-sm" // Unselected state: FF284D text, light background on hover, subtle shadow on hover
                }`}
                onClick={() => setSelectedSetting("shop_details")}
              >
                <Info className="mr-2 h-4 w-4" /> Shop Details
              </Button>
              <Button
                // Keep variant as default/ghost, but we'll override the appearance with className
                variant={selectedSetting === "services" ? "default" : "ghost"} /* CHANGED HERE */
                className={`justify-start w-full rounded-md transition-all duration-200 ease-in-out ${
                  selectedSetting === "services" /* CHANGED HERE */
                    ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
                    : "text-[#ff284d] hover:bg-muted/50 hover:shadow-sm"
                }`}
                onClick={() => setSelectedSetting("services")} /* CHANGED HERE */
              >
                <ListPlus className="mr-2 h-4 w-4" /> Services
              </Button>
              <Button
                // Keep variant as default/ghost, but we'll override the appearance with className
                variant={selectedSetting === "staff" ? "default" : "ghost"} /* CHANGED HERE */
                className={`justify-start w-full rounded-md transition-all duration-200 ease-in-out ${
                  selectedSetting === "staff" /* CHANGED HERE */
                    ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
                    : "text-[#ff284d] hover:bg-muted/50 hover:shadow-sm"
                }`}
                onClick={() => setSelectedSetting("staff")} /* CHANGED HERE */
              >
                <Users className="mr-2 h-4 w-4" /> Staff
              </Button>
              <Button
                // Keep variant as default/ghost, but we'll override the appearance with className
                variant={selectedSetting === "qr_code" ? "default" : "ghost"} /* CHANGED HERE */
                className={`justify-start w-full rounded-md transition-all duration-200 ease-in-out ${
                  selectedSetting === "qr_code" /* CHANGED HERE */
                    ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
                    : "text-[#ff284d] hover:bg-muted/50 hover:shadow-sm"
                }`}
                onClick={() => setSelectedSetting("qr_code")} /* CHANGED HERE */
              >
                <QrCode className="mr-2 h-4 w-4" /> QR Code
              </Button>
              <Button
                // Keep variant as default/ghost, but we'll override the appearance with className
                variant={selectedSetting === "billing" ? "default" : "ghost"} /* CHANGED HERE */
                className={`justify-start w-full rounded-md transition-all duration-200 ease-in-out ${
                  selectedSetting === "billing" /* CHANGED HERE */
                    ? "bg-[#ff284d] text-white shadow-[0_4px_14px_0_rgba(255,40,77,0.3)] hover:bg-[#e62445]"
                    : "text-[#ff284d] hover:bg-muted/50 hover:shadow-sm"
                }`}
                onClick={() => setSelectedSetting("billing")} /* CHANGED HERE */
              >
                <CreditCard className="mr-2 h-4 w-4" /> Billing
              </Button>
            </div>
          </Card>
        </nav>

        {/* Main Settings Content Area */}
        <div className="flex-grow">
          {renderSettingsContent()}
        </div>
      </motion.div>

      <footer className="mt-16 py-6 text-center text-gray-300 bg-background border-t border-border/50"> {/* Removed text-3xl font-bold from footer itself as it's for text, not image */}
        {/* Replace /path/to/your/logo.svg with the actual path to your SVG logo file */}
        {/* Adjust width and height as needed. Tailwind's `w-auto h-12` is a good starting point for responsive sizing. */}
        <Image
          src="../Logo.svg" // Replace with your SVG path
          alt="WaitWise Logo"
          width={30} // Example width in pixels. Adjust as necessary.
          height={15} // Example height in pixels. Adjust as necessary.
          className="mx-auto" // Centers the image horizontally
          priority // Optional: if this logo should load quickly on initial page load
        />
        <p className="text-sm text-muted-foreground mt-2">&copy; {new Date().getFullYear()} WaitWise. All rights reserved.</p> {/* Added copyright text, adjusted styling */}
      </footer>

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
    </div>
  );
}