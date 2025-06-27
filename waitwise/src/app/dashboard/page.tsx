'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { CreateShopForm } from '../../components/ui/CreateShopForm';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { Trash2, Edit, RefreshCw, QrCode, CreditCard, Wand2, ListPlus, UserPlus, MoreVertical, Loader2, Settings, Store, Users, Coffee } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Switch } from '../../components/ui/switch';
import { PinPaymentForm } from '../../components/ui/PinPaymentForm';
import { motion } from 'framer-motion';

// Animation Variants
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeInOut" } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Type definitions
type QueueEntry = { id: string; client_name: string; queue_position: number; status: 'waiting' | 'in_progress' | 'done' | 'no_show'; created_at: string; barbers: { id: string; name: string; } | null; queue_entry_services: { services: { id: string; name: string; price: number; } | null }[] | null; };
type Shop = { id: string; name: string; logo_url: string | null; address: string; owner_id: string; subscription_status: 'trial' | 'active' | 'past_due' | null; pin_customer_token: string | null; opening_time: string | null; closing_time: string | null; account_balance?: number; };
type Service = { id:string; name: string; price: number; duration_minutes: number };
type Barber = { id: string; name: string; avatar_url: string | null; is_working_today: boolean; is_on_break: boolean; break_end_time: string | null; };
type Invoice = { id: string; amount: number; created_at: string; status: string; };
type AnalyticsData = { totalRevenue: number; totalCustomers: number; noShowRate: number; barberRevenueData: { name: string; revenue: number }[]; barberClientData: { name: string; clients: number }[]; };
type EditSection = 'details' | 'services' | 'staff' | 'qr';


export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeEditSection, setActiveEditSection] = useState<EditSection | null>(null);
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
  const [editingQueueEntry, setEditingQueueEntry] = useState<QueueEntry | null>(null);
  const [isEditQueueEntryDialogOpen, setIsEditQueueEntryDialogOpen] = useState(false);
  const [barberForBreak, setBarberForBreak] = useState<Barber | null>(null);
  const [breakDuration, setBreakDuration] = useState('15');
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);
  const [editedBarberId, setEditedBarberId] = useState('');
  const [editedShopName, setEditedShopName] = useState('');
  const [editedShopAddress, setEditedShopAddress] = useState('');
  const [editedOpeningTime, setEditedOpeningTime] = useState('');
  const [editedClosingTime, setEditedClosingTime] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberAvatarFile, setNewBarberAvatarFile] = useState<File | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [monthlyBillableEventCount, setMonthlyBillableEventCount] = useState(0);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [showAllNoShows, setShowAllNoShows] = useState(false);
  const [isSmsPaused, setIsSmsPaused] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const [isEmailPromptVisible, setIsEmailPromptVisible] = useState(false);
  const [failedInvoice, setFailedInvoice] = useState<Invoice | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState('today');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [newShopLogoFile, setNewShopLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const fetchQueueData = useCallback(async (shopId: string) => {
    if (!shopId) return;

    // Get the start of the current day in the user's local timezone.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('queue_entries')
      .select(`*, barbers ( id, name ), queue_entry_services ( services ( id, name, price ) )`)
      .eq('shop_id', shopId)
      // Fetch all entries created since the start of today, regardless of status.
      // This will include 'waiting', 'in_progress', 'done', and 'no_show'.
      .gte('created_at', today.toISOString())
      .order('queue_position');

    if (error) {
      console.error('Error fetching queue:', error);
      return;
    }
    setQueueEntries(data as QueueEntry[]);
  }, [supabase]);

  const fetchShopData = useCallback(async (shopId: string) => {
    if (!shopId) return;
    const [
      { data: servicesData },
      { data: barbersData }
    ] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId).order('created_at'),
      supabase.from('barbers').select('*').eq('shop_id', shopId).order('created_at')
    ]);
    setServices(servicesData || []);
    setBarbers(barbersData as Barber[] || []);
  }, [supabase]);

  useEffect(() => {
    async function fetchUserAndShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single();
      if (shopData) {
        setShop(shopData);
        setEditedShopName(shopData.name);
        setEditedShopAddress(shopData.address);
        setEditedOpeningTime(shopData.opening_time || '09:00');
        setEditedClosingTime(shopData.closing_time || '17:00');
        fetchQueueData(shopData.id);
        fetchShopData(shopData.id);
      }
      setLoading(false);
    }
    fetchUserAndShop();
  }, [supabase, router, fetchQueueData, fetchShopData]);
  
  useEffect(() => {
    if (activeEditSection === 'details' && shop) {
      setLogoPreviewUrl(shop.logo_url || null);
      setNewShopLogoFile(null); // Also reset file input state
    }
  }, [activeEditSection, shop]);

  useEffect(() => {
    if (!shop) return;
    const fetchUsageCounts = async () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { count: totalCount, error: totalError } = await supabase
        .from('billable_events')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id);

      if (totalError) {
        console.error('Error fetching total events count:', totalError);
      } else {
        setTotalEventCount(totalCount || 0);
      }

      const { count: monthlyCount, error: monthlyError } = await supabase
        .from('billable_events')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id)
        .eq('is_billable', true)
        .gte('created_at', firstDayOfMonth);

      if (monthlyError) {
        console.error('Error fetching monthly billable events count:', monthlyError);
      } else {
        setMonthlyBillableEventCount(monthlyCount || 0);
      }
    };
    fetchUsageCounts();
  }, [shop, supabase]);

  useEffect(() => {
    if (shop?.subscription_status === 'past_due') {
      const fetchFailedInvoice = async () => {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, amount, created_at, status')
          .eq('shop_id', shop.id)
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching failed invoice:', error);
        } else {
          setFailedInvoice(data);
        }
      };
      fetchFailedInvoice();
    }
  }, [shop, supabase]);

  useEffect(() => {
    if (!shop) return;
    const fetchAnalytics = async () => {
      setIsAnalyticsLoading(true);
      const today = new Date();
      let startDate;
      const endDate = new Date();

      switch (analyticsRange) {
        case 'week':
          startDate = new Date(new Date().setDate(today.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(new Date().setMonth(today.getMonth() - 1));
          break;
        case 'all_time':
          startDate = new Date(0);
          break;
        case 'today':
        default:
          startDate = new Date(new Date().setHours(0, 0, 0, 0));
          break;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-analytics-data', {
          body: {
            shop_id: shop.id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
        });

        if (error) throw error;
        setAnalyticsData(data);
      } catch (error) {
        toast.error('Failed to load analytics data.');
        console.error('Analytics error:', error);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [shop, analyticsRange, supabase]);

  useEffect(() => {
    if (!shop) return;
    const queueChannel = supabase.channel(`queue_for_${shop.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `shop_id=eq.${shop.id}` }, () => fetchQueueData(shop.id)).subscribe();
    const barbersChannel = supabase.channel(`barbers_for_${shop.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}`}, () => fetchShopData(shop.id)).subscribe();
    const servicesChannel = supabase.channel(`services_for_${shop.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `shop_id=eq.${shop.id}`}, () => fetchShopData(shop.id)).subscribe();
    
    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(barbersChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, [shop, supabase, fetchQueueData, fetchShopData]);
  
  // Auto-generate QR code when the dialog is opened for the first time
  useEffect(() => {
    if (activeEditSection === 'qr' && !qrCodeDataUrl) {
      generateQRCode();
    }
  }, [activeEditSection, qrCodeDataUrl]);

  const fullCompletedList = useMemo(() => queueEntries.filter((e) => e.status === 'done').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [queueEntries]);
  const fullNoShowList = useMemo(() => queueEntries.filter((e) => e.status === 'no_show').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [queueEntries]);
  const visibleCompletedList = useMemo(() => showAllCompleted ? fullCompletedList : fullCompletedList.slice(0, 5), [fullCompletedList, showAllCompleted]);
  const visibleNoShowList = useMemo(() => showAllNoShows ? fullNoShowList : fullNoShowList.slice(0, 5), [fullNoShowList, showAllNoShows]);
  const barberColorMap = useMemo(() => {
    const VIBRANT_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    const map: { [key: string]: string } = {};
    barbers.forEach((barber, index) => {
      map[barber.name] = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
    });
    return map;
  }, [barbers]);
  const workingBarbers = useMemo(() => barbers.filter(b => b.is_working_today), [barbers]);

  const handleToggleBarberWorkStatus = async (barberId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('barbers')
      .update({ is_working_today: !currentState })
      .eq('id', barberId);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
    } else {
      toast.success(`Staff status updated.`);
    }
  };

  const handleStartBreak = async () => {
    if (!barberForBreak || !breakDuration) return;
    
    const breakEndTime = new Date(Date.now() + parseInt(breakDuration) * 60000);

    const { error } = await supabase
      .from('barbers')
      .update({ is_on_break: true, break_end_time: breakEndTime.toISOString() })
      .eq('id', barberForBreak.id);

    if (error) {
      toast.error(`Failed to start break: ${error.message}`);
    } else {
      toast.success(`${barberForBreak.name} is now on a break.`);
      setIsBreakDialogOpen(false);
      setBarberForBreak(null);
    }
  };

  const handleEndBreak = async (barberId: string) => {
    const { error } = await supabase
      .from('barbers')
      .update({ is_on_break: false, break_end_time: null })
      .eq('id', barberId);
    
    if (error) {
      toast.error(`Failed to end break: ${error.message}`);
    } else {
      toast.success('Break ended. Welcome back!');
    }
  };
  
  const handleUpgradeClick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
      setBillingEmail(user.email);
      setIsEmailPromptVisible(false);
    } else {
      setIsEmailPromptVisible(true);
    }
    setIsUpgrading(true);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setIsEmailPromptVisible(false);
  };

  const handleRequeue = async (entry: QueueEntry) => {
    if (!entry.barbers?.id) {
      toast.error('This client has no assigned staff member and cannot be re-queued.');
      return;
    }
    const { data: waitingEntries, error: fetchError } = await supabase
      .from('queue_entries')
      .select('queue_position')
      .eq('barber_id', entry.barbers.id)
      .eq('status', 'waiting')
      .order('queue_position', { ascending: true })
      .limit(1);
    if (fetchError) {
      console.error('Error fetching waiting queue:', fetchError);
      toast.error('Could not retrieve the current queue. Please try again.');
      return;
    }
    const newPosition = waitingEntries && waitingEntries.length > 0 ? waitingEntries[0].queue_position - 1 : 1;
    const { error: updateError } = await supabase
      .from('queue_entries')
      .update({ status: 'waiting', queue_position: newPosition })
      .eq('id', entry.id);
    if (updateError) {
      console.error('Error re-queuing client:', updateError);
      toast.error('Failed to re-queue the client.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: QueueEntry['status']) => {
    if (newStatus === 'done' && shop) {
      const { error: billableError } = await supabase
        .from('billable_events')
        .insert({ shop_id: shop.id, queue_entry_id: id });
      if (billableError) {
        console.error('Could not create billable event:', billableError);
        toast.warning('Could not log this event for billing. Please contact support.');
      }
    }
    const currentEntry = queueEntries.find((entry) => entry.id === id);
    const barberId = currentEntry?.barbers?.id;
    const { error: updateError } = await supabase
      .from('queue_entries')
      .update({ status: newStatus })
      .eq('id', id);
    if (updateError) {
      toast.error(`Failed to update status: ${updateError.message}`);
      return;
    }
    if (newStatus === 'in_progress' && barberId) {
      try {
        const { data: nextInQueue, error: nextError } = await supabase
          .from('queue_entries')
          .select('id, notification_sent_at')
          .eq('barber_id', barberId)
          .eq('status', 'waiting')
          .eq('queue_position', 1)
          .single();
        if (nextError && nextError.code !== 'PGRST116') {
           throw nextError;
        }
        if (nextInQueue && !nextInQueue.notification_sent_at) {
          if (!isSmsPaused) {
              console.log(`Live SMS Enabled: Found user ${nextInQueue.id} at position 1. Sending notification...`);
              const { error: invokeError } = await supabase.functions.invoke('notify-customer', {
                  body: { queue_entry_id: nextInQueue.id },
              });
              if (invokeError) {
                  toast.error(`Failed to send notification: ${invokeError.message}`);
              } else {
                  toast.success('Notification sent to the next client in the queue!');
              }
          } else {
              console.log(`SMS Paused: Would have sent notification to user ${nextInQueue.id}`);
              toast.info('SMS is paused. Notification not sent.');
          }
        }
      } catch (error) {
         console.error('Error in notification logic:', error);
         toast.error('An error occurred while sending the notification.');
      }
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  const handleDeleteFromQueue = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this entry?')) return;
    try {
      await supabase.from('queue_entries').delete().eq('id', id).throwOnError();
    } catch (error) {
      console.error('Delete queue entry error:', error);
      toast.error('Could not delete this entry.');
    }
  };

  const handleOpenEditDialog = (entry: QueueEntry) => {
    if (entry.barbers) {
      setEditingQueueEntry(entry);
      setEditedBarberId(entry.barbers.id);
      setIsEditQueueEntryDialogOpen(true);
    } else {
      toast.error('This entry has no staff member assigned to edit.');
    }
  };

  const handleUpdateQueueEntry = async () => {
    if (!editingQueueEntry) return;
    const { error } = await supabase
      .from('queue_entries')
      .update({ barber_id: editedBarberId })
      .eq('id', editingQueueEntry.id);
    if (error) {
      toast.error(`Error updating staff member: ${error.message}`);
      return;
    }
    setIsEditQueueEntryDialogOpen(false);
    setEditingQueueEntry(null);
  };

  const handleUpdateShopDetails = async () => {
    if (!shop) return;

    toast.loading('Updating shop details...');

    let logoUrlToUpdate = shop.logo_url;

    if (newShopLogoFile) {
      const file = newShopLogoFile;
      const fileExt = file.name.split('.').pop();
      const filePath = `${shop.id}/logo/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('shop-logos') // <-- CHANGE THIS LINE
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.dismiss();
        toast.error(`Logo upload failed: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage.from('shop-logos').getPublicUrl(filePath); // <-- AND CHANGE THIS LINE
      // Add a timestamp to bust browser cache for the image
      logoUrlToUpdate = `${data.publicUrl}?t=${new Date().getTime()}`;
    }

    const { data: updatedShop, error } = await supabase
      .from('shops')
      .update({
          name: editedShopName,
          address: editedShopAddress,
          opening_time: editedOpeningTime,
          closing_time: editedClosingTime,
          logo_url: logoUrlToUpdate,
      })
      .eq('id', shop.id)
      .select()
      .single();

    toast.dismiss();

    if (error) {
      toast.error(`Failed to update shop details: ${error.message}`);
      return;
    }

    if (updatedShop) {
        setShop(updatedShop);
        toast.success('Shop details updated!');
        setActiveEditSection(null);
        setNewShopLogoFile(null);
        setLogoPreviewUrl(null);
    }
  };

  const handleDeleteLogo = async () => {
    if (!shop || !shop.logo_url) return;

    if (!confirm('Are you sure you want to permanently delete your shop logo?')) {
      return;
    }

    toast.loading('Deleting logo...');

    try {
      // Extract the file path from the full URL to delete from storage
      const logoPath = shop.logo_url.split('/shop-logos/')[1].split('?')[0];
      const { error: storageError } = await supabase.storage.from('shop-logos').remove([logoPath]);
      
      if (storageError) {
        // If the file doesn't exist in storage, we can ignore the error and still update the DB
        if (storageError.message !== 'The resource was not found') {
          throw storageError;
        }
      }

      // Set the logo_url in the database to null
      const { data: updatedShop, error: dbError } = await supabase
        .from('shops')
        .update({ logo_url: null })
        .eq('id', shop.id)
        .select()
        .single();
        
      if (dbError) throw dbError;

      // Update the local state to reflect the change and close the dialog
      setShop(updatedShop);
      setLogoPreviewUrl(null);
      setActiveEditSection(null); 
      
      toast.dismiss();
      toast.success('Logo deleted successfully!');

    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to delete logo: ${error.message}`);
      console.error('Delete logo error:', error);
    }
  };

  const handleAddService = async () => {
    if (!shop || !newServiceName || !newServicePrice || !newServiceDuration) return;
    const { error } = await supabase.from('services').insert({ name: newServiceName, price: parseFloat(newServicePrice), duration_minutes: parseInt(newServiceDuration), shop_id: shop.id });
    if (!error) {
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDuration('');
      toast.success('Service added!');
    } else {
      toast.error('Failed to add service.');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await supabase.from('services').delete().eq('id', serviceId).throwOnError();
      toast.success('Service deleted.');
    } catch (error) {
      console.error('Delete service error:', error);
      toast.error('Could not delete service. It may be linked to historical queue entries.');
    }
  };

  const handleRetryPayment = async () => {
    if (!shop || !failedInvoice) return;
    toast.loading('Retrying payment...');
  
    const { error } = await supabase.functions.invoke('retry-payment', {
      body: { shop_id: shop.id },
    });
    
    toast.dismiss();
  
    if (error) {
      toast.error(`Payment failed: ${error.message}`);
    } else {
      toast.success('Payment successful! Your account is now active.');
      const { data: updatedShop } = await supabase.from('shops').select('*').eq('id', shop.id).single();
      if (updatedShop) {
        setShop(updatedShop);
        setFailedInvoice(null);
      }
    }
  };

  const handleAddBarber = async () => {
    if (!shop || !newBarberName) return;
    let avatarUrl: string | null = null;
    if (newBarberAvatarFile) {
      const file = newBarberAvatarFile;
      const fileExt = file.name.split('.').pop();
      const filePath = `${shop.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) {
        toast.error('Error uploading avatar. Please try again.');
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      avatarUrl = data.publicUrl;
    }
    const { error } = await supabase.from('barbers').insert({ name: newBarberName, avatar_url: avatarUrl, shop_id: shop.id });
    if (!error) {
      setNewBarberName('');
      setNewBarberAvatarFile(null);
      const fileInput = document.getElementById('new-barber-avatar') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
      toast.success('Staff member added!');
    } else {
      toast.error('Failed to add staff member.');
    }
  };
  const handleDeleteBarber = async (barberId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await supabase.from('barbers').delete().eq('id', barberId).throwOnError();
      toast.success('Staff member deleted.');
    } catch (error) {
      console.error('Delete barber error:', error);
      toast.error('Could not delete staff member. They may be linked to historical queue entries.');
    }
  };

  const generateQRCode = async () => {
    if (!shop) return;
    const url = `${window.location.origin}/shop/${shop.id}`;
    try {
      const options = {
        errorCorrectionLevel: 'H' as const,
        type: 'image/png' as const,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      };
      const dataUrl = await QRCode.toDataURL(url, options);
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      toast.error('Could not generate QR code. Please try again.');
    }
  };

  const renderEditDialogContent = () => {
    if (!activeEditSection) return null;

    switch (activeEditSection) {
      case 'details':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Edit Shop Details</DialogTitle>
              <DialogDescription>Update your shop's name, address, logo and opening hours.</DialogDescription>
            </DialogHeader>
            <div className='py-4'>
                <Card className="border-none shadow-none">
                    <CardContent className='grid gap-4 pt-4'>
                        <div className='grid gap-2'><Label htmlFor='shop-name-edit'>Shop Name</Label><Input id='shop-name-edit' value={editedShopName} onChange={(e) => setEditedShopName(e.target.value)} /></div>
                        <div className='grid gap-2'>
  <Label>Shop Logo</Label>
  {logoPreviewUrl ? (
      <Image src={logoPreviewUrl} alt="Logo Preview" width={80} height={80} className="rounded-lg object-cover" />
  ) : (
      <div className='w-20 h-20 bg-muted rounded-lg flex items-center justify-center'>
          <Store className="h-8 w-8 text-muted-foreground" />
      </div>
  )}
  <div className="flex items-center gap-2">
      <Input 
          id='shop-logo-edit' 
          type='file' 
          accept='image/png, image/jpeg, image/webp' 
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
      {/* --- ADD THIS BUTTON --- */}
      {shop?.logo_url && (
        <Button variant="destructive" type="button" onClick={handleDeleteLogo} title="Delete logo">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete Logo</span>
        </Button>
      )}
  </div>
</div>
                        <div className='grid gap-2'><Label htmlFor='shop-address-edit'>Shop Address</Label><Input id='shop-address-edit' value={editedShopAddress} onChange={(e) => setEditedShopAddress(e.target.value)} /></div>
                        <div className='grid grid-cols-2 gap-4'>
                        <div className='grid gap-2'><Label htmlFor='opening-time'>Opening Time</Label><Input id='opening-time' type='time' value={editedOpeningTime} onChange={(e) => setEditedOpeningTime(e.target.value)} /></div>
                        <div className='grid gap-2'><Label htmlFor='closing-time'>Closing Time</Label><Input id='closing-time' type='time' value={editedClosingTime} onChange={(e) => setEditedClosingTime(e.target.value)} /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type='button' variant='secondary'>Cancel</Button></DialogClose>
                <Button onClick={handleUpdateShopDetails}>Save Changes</Button>
            </DialogFooter>
          </>
        );
      case 'qr':
        return (
          <>
            <DialogHeader>
                <DialogTitle>Shop QR Code</DialogTitle>
                <DialogDescription>Customers can scan this code to go directly to your booking page.</DialogDescription>
            </DialogHeader>
            <div className='py-4'>
                <Card className="border-none shadow-none">
                    <CardContent className='flex flex-col items-center justify-center gap-4 pt-4'>
                        {qrCodeDataUrl ? ( <Image src={qrCodeDataUrl} alt='Shop QR Code' width={192} height={192} className='border rounded-lg' /> ) : (
                            <div className='w-48 h-48 border rounded-lg bg-muted flex items-center justify-center'><p className='text-sm text-muted-foreground'>Generating...</p></div>
                        )}
                        <div className='flex gap-2'>
                            <Button onClick={generateQRCode} variant='outline'><RefreshCw className='mr-2 h-4 w-4' />Regenerate</Button>
                            {qrCodeDataUrl && ( <a href={qrCodeDataUrl} download={`${editedShopName}-QRCode.png`}><Button>Download</Button></a> )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type='button' variant='secondary'>Close</Button></DialogClose>
            </DialogFooter>
          </>
        );
      case 'services':
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Manage Services</DialogTitle>
                    <DialogDescription>Add, remove, and edit the services your shop offers.</DialogDescription>
                </DialogHeader>
                <div className='py-4'>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-4">
                            {services.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Price</TableHead><TableHead>Mins</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {services.map((s) => (
                                            <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>${s.price}</TableCell><TableCell>{s.duration_minutes}</TableCell><TableCell className='text-right'><Button variant='ghost' size='icon' onClick={() => handleDeleteService(s.id)}><Trash2 className='h-4 w-4' /></Button></TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className='text-center p-6 border-2 border-dashed rounded-lg'><ListPlus className='mx-auto h-12 w-12 text-muted-foreground' /><h3 className='mt-4 text-lg font-semibold'>No Services Added Yet</h3><p className='mt-1 text-sm text-muted-foreground'>Add your first service below to make it available for customers.</p></div>
                            )}
                        </CardContent>
                        <CardFooter className='flex flex-wrap gap-2 items-end pt-6'>
                            <div className='grid gap-1.5 flex-grow min-w-[120px]'><Label htmlFor='new-service-name'>New Service</Label><Input id='new-service-name' placeholder='Name' value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} /></div>
                            <div className='grid gap-1.5 w-24'><Label htmlFor='new-service-price'>Price</Label><Input id='new-service-price' type='number' placeholder='$' value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} /></div>
                            <div className='grid gap-1.5 w-24'><Label htmlFor='new-service-duration'>Mins</Label><Input id='new-service-duration' type='number' placeholder='Time' value={newServiceDuration} onChange={(e) => setNewServiceDuration(e.target.value)} /></div>
                            <Button onClick={handleAddService}>Add</Button>
                        </CardFooter>
                    </Card>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type='button' variant='secondary'>Close</Button></DialogClose>
                </DialogFooter>
            </>
        );
        case 'staff':
            return (
                <>
                    <DialogHeader>
                        <DialogTitle>Manage Staff</DialogTitle>
                        <DialogDescription>Add, remove, and set which staff members are working today.</DialogDescription>
                    </DialogHeader>
                    <div className='py-4'>
                        <Card className="border-none shadow-none">
                            <CardContent className="pt-4">
                            {barbers.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff Member</TableHead>
                                            <TableHead className='text-center'>On Break</TableHead>
                                            <TableHead className='text-center'>Working Today</TableHead>
                                            <TableHead className='w-[50px]'></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {barbers.map((b) => (
                                            <TableRow key={b.id}>
                                                <TableCell className='flex items-center gap-4'>
                                                    <Avatar><AvatarImage src={b.avatar_url || undefined} alt={b.name} /><AvatarFallback>{b.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback></Avatar>
                                                    {b.name}
                                                </TableCell>
                                                <TableCell className='text-center'>
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
                                                <TableCell className='text-center'>
                                                    <Switch
                                                        checked={b.is_working_today}
                                                        onCheckedChange={() => handleToggleBarberWorkStatus(b.id, b.is_working_today)}
                                                        aria-label={`Toggle work status for ${b.name}`}
                                                    />
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    <Button variant='ghost' size='icon' className="hover:text-destructive" onClick={() => handleDeleteBarber(b.id)}>
                                                        <Trash2 className='h-4 w-4' />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className='text-center p-6 border-2 border-dashed rounded-lg'><UserPlus className='mx-auto h-12 w-12 text-muted-foreground' /><h3 className='mt-4 text-lg font-semibold'>No Staff Added Yet</h3><p className='mt-1 text-sm text-muted-foreground'>Add your first staff member below.</p></div>
                            )}
                            </CardContent>
                            <CardFooter className='flex flex-col gap-4 items-start pt-6'>
                                <div className='grid gap-1.5 w-full'><Label htmlFor='new-barber-name'>New Staff Member Name</Label><Input id='new-barber-name' placeholder='e.g., John Smith' value={newBarberName} onChange={(e) => setNewBarberName(e.target.value)} /></div>
                                <div className='grid gap-1.5 w-full'><Label htmlFor='new-barber-avatar'>Avatar</Label><Input id='new-barber-avatar' type='file' accept='image/*' onChange={(e) => e.target.files && setNewBarberAvatarFile(e.target.files[0])} /></div>
                                <Button onClick={handleAddBarber}>Add Staff Member</Button>
                            </CardFooter>
                        </Card>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type='button' variant='secondary'>Close</Button></DialogClose>
                    </DialogFooter>
                </>
            );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className='flex items-center justify-center h-screen bg-background'><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!shop) {
    return <CreateShopForm onShopCreated={setShop} />;
  }

  return (
    <>
      <div className='container mx-auto p-4 md:p-8 bg-background text-foreground min-h-screen'>
        <motion.div variants={fadeIn} initial="initial" animate="animate">
          {shop.subscription_status === 'past_due' && (
            <div className='p-4 mb-6 text-destructive-foreground bg-destructive rounded-md' role='alert'>
              <h3 className='font-bold'>Payment Problem</h3>
              <p>We were unable to process your last payment. Please update your payment method in the billing section to restore full access.</p>
            </div>
          )}
        </motion.div>
        
        <motion.header 
          variants={fadeIn} initial="initial" animate="animate"
          className='flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-border/50'
        >
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
    <h1 className='text-3xl font-bold tracking-tight text-primary'>{shop.name}</h1>
  )}
</div>
          <div className='hidden md:flex items-center gap-2'>
            <div className='flex items-center space-x-2 p-2 rounded-md hover:bg-accent transition-colors'>
              <Switch id='sms-mode' checked={!isSmsPaused} onCheckedChange={(checked) => setIsSmsPaused(!checked)} />
              <Label htmlFor='sms-mode'>Live SMS</Label>
            </div>
            <Link href={`/shop/${shop.id}`} target='_blank'><Button variant='outline' className='hover:text-primary hover:border-primary transition-colors'>Join Queue</Button></Link>
            <Button variant='outline' className='hover:text-primary hover:border-primary transition-colors' onClick={() => setIsBillingDialogOpen(true)}>Billing</Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className='transition-transform hover:scale-105'>Edit Shop <Settings className="ml-2 h-4 w-4"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setActiveEditSection('details')}><Store className="mr-2 h-4 w-4"/>Shop Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection('staff')}><Users className="mr-2 h-4 w-4"/>Manage Staff</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection('services')}><ListPlus className="mr-2 h-4 w-4"/>Manage Services</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveEditSection('qr')}><QrCode className="mr-2 h-4 w-4"/>Get QR Code</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button variant='ghost' className='hover:text-primary transition-colors' onClick={handleLogout}>Logout</Button>
          </div>
          <div className='md:hidden'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant='ghost' size='icon'><MoreVertical className='h-5 w-5' /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='focus:bg-transparent'>
                  <div className='flex items-center justify-between w-full'>
                    <Label htmlFor='sms-mode-mobile'>Live SMS</Label>
                    <Switch id='sms-mode-mobile' checked={!isSmsPaused} onCheckedChange={(checked) => setIsSmsPaused(!checked)} />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`/shop/${shop.id}`, '_blank')}>Join Queue Page</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setActiveEditSection('details')}>Edit Shop Details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveEditSection('staff')}>Manage Staff</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveEditSection('services')}>Manage Services</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveEditSection('qr')}>Get QR Code</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsBillingDialogOpen(true)}>Billing & Subscription</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.header>

        <Dialog open={isBillingDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsUpgrading(false);
            setIsEmailPromptVisible(false);
            setBillingEmail('');
          }
          setIsBillingDialogOpen(isOpen);
        }}>
          <DialogContent className='grid grid-rows-[auto_1fr_auto] max-h-[90vh]'>
            <DialogHeader>
              <DialogTitle>Billing & Subscription</DialogTitle>
            </DialogHeader>
            <motion.div initial="initial" animate="animate" variants={staggerContainer} className='py-4 pr-6 overflow-y-auto'>
              {shop.subscription_status === 'trial' || shop.subscription_status === null ? (
                <motion.div variants={fadeIn} className='space-y-4'>
                  <div className='flex justify-between items-center p-4 bg-muted rounded-lg'>
                    <div>
                      <p className='text-sm font-medium'>Current Plan</p>
                      <p className='text-2xl font-bold capitalize'>Trial</p>
                    </div>
                    {!isUpgrading && (
                      <Button onClick={handleUpgradeClick} className="transition-transform hover:scale-105">
                        <CreditCard className='mr-2 h-4 w-4' /> Upgrade Now
                      </Button>
                    )}
                  </div>
                  {isUpgrading && (
                    <motion.div variants={fadeIn} className='pt-4'>
                      {isEmailPromptVisible ? (
                        <form onSubmit={handleEmailSubmit} className='space-y-4'>
                          <DialogDescription>
                            Your account doesn&apos;t have an email. Please provide a billing email address to continue.
                          </DialogDescription>
                          <div className='grid gap-2'>
                            <Label htmlFor='billing-email'>Billing Email</Label>
                            <Input
                              id='billing-email'
                              type='email'
                              placeholder='you@example.com'
                              value={billingEmail}
                              onChange={(e) => setBillingEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type='submit' className='w-full'>Save and Continue</Button>
                        </form>
                      ) : (
                        <>
                          <DialogDescription className='mb-4'>
                            To upgrade to our Pay-as-you-go plan, please add a payment method.
                          </DialogDescription>
                          <PinPaymentForm
                            publishableKey={process.env.NEXT_PUBLIC_PIN_PUBLISHABLE_KEY!}
                            onSuccess={async (card_token) => {
                              toast.loading('Saving your card...');
                              const { data, error } = await supabase.functions.invoke('create-pin-customer', {
                                body: { card_token, email: billingEmail },
                              });
                              toast.dismiss();
                              if (error) { toast.error(`Failed to save card: ${error.message}`); return; }
                              const { error: updateError } = await supabase.from('shops').update({ pin_customer_token: data.customer_token, subscription_status: 'active' }).eq('id', shop.id);
                              if (updateError) { toast.error(`Failed to update shop: ${updateError.message}`); } 
                              else {
                                toast.success('Upgrade successful! Your payment method has been saved.');
                                const { data: updatedShop } = await supabase.from('shops').select('*').eq('id', shop.id).single();
                                if (updatedShop) setShop(updatedShop);
                                setIsBillingDialogOpen(false);
                              }
                            }}
                            onFailure={(error) => { toast.error(error); }}
                          />
                        </>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div variants={fadeIn} className='space-y-4'>
                  {shop.subscription_status === 'past_due' && failedInvoice && (
                    <div className='p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive'>
                      <p className='font-bold'>Payment Failed</p>
                      <p className='text-sm'>
                        Your payment of ${(failedInvoice.amount / 100).toFixed(2)} on {new Date(failedInvoice.created_at).toLocaleDateString()} was declined.
                      </p>
                    </div>
                  )}

                  <div className='flex justify-between items-center p-4 bg-muted rounded-lg'>
                    <div>
                      <p className='text-sm font-medium'>Current Plan</p>
                      <p className='text-2xl font-bold capitalize'>{shop.subscription_status}</p>
                    </div>
                    {shop.subscription_status === 'active' ? ( <Badge variant='default' className='bg-green-600'>Active</Badge> ) : ( <Badge variant='destructive'>Past Due</Badge> )}
                  </div>

                  <p className='text-sm text-muted-foreground'>
                    {shop.subscription_status === 'past_due' 
                        ? 'Please update your payment method to automatically retry the payment and restore service.'
                        : 'You have a payment method on file.'
                    }
                  </p>

                  <Button variant='outline' className='w-full hover:text-primary hover:border-primary' onClick={() => setIsUpgrading(!isUpgrading)}>
                    {isUpgrading ? 'Close Form' : 'Update Payment Method'}
                  </Button>

                  {isUpgrading && (
                    <motion.div variants={fadeIn} className='pt-4'>
                        <PinPaymentForm
                          publishableKey={process.env.NEXT_PUBLIC_PIN_PUBLISHABLE_KEY!}
                          onSuccess={async (new_card_token) => {
                            if (!shop?.pin_customer_token) { toast.error('Customer profile not found.'); return; }
                            toast.loading('Updating payment method...');
                            const { error: updateError } = await supabase.functions.invoke('update-pin-customer-card', { body: { customer_token: shop.pin_customer_token, card_token: new_card_token } });
                            if (updateError) { toast.dismiss(); toast.error(`Failed to update card: ${updateError.message}`); return; }
                            toast.dismiss();
                            toast.success('Payment method updated successfully!');
                            if (shop.subscription_status === 'past_due') {
                                toast.loading('Retrying failed payment...');
                                const { error: retryError } = await supabase.functions.invoke('retry-payment', { body: { shop_id: shop.id } });
                                toast.dismiss();
                                if (retryError) { toast.error(`Payment retry failed: ${retryError.message}`); } 
                                else {
                                    toast.success('Payment successful! Your account is now active.');
                                    const { data: updatedShop } = await supabase.from('shops').select('*').eq('id', shop.id).single();
                                    if (updatedShop) setShop(updatedShop);
                                }
                            }
                            setIsUpgrading(false);
                          }}
                          onFailure={(error) => { toast.error(error); }}
                        />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
            <DialogFooter>
              <DialogClose asChild><Button type='button' variant='secondary'>Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={!!activeEditSection} onOpenChange={(isOpen) => !isOpen && setActiveEditSection(null)}>
            <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
                {renderEditDialogContent()}
             </DialogContent>
        </Dialog>
        
        <motion.div initial="initial" animate="animate" variants={staggerContainer}>
          <motion.div variants={fadeIn}>
            <Card className='mb-6 bg-card border-border'>
              <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
              <CardContent>
                  {(() => {
                      if (totalEventCount < 100) {
                          const remaining = 100 - totalEventCount;
                          return (<div><p className='text-2xl font-bold'>{remaining}</p><p className='text-sm text-muted-foreground'>free trial usages remaining.</p></div>);
                      } else if (shop.subscription_status === 'trial' || shop.subscription_status === null) {
                          return (<div><p className='text-2xl font-bold text-destructive'>0</p><p className='text-sm text-muted-foreground'>free trial usages remaining.</p><p className='text-sm font-semibold text-destructive mt-2'>You have used all your free trial clients! Please upgrade to continue serving customers.</p></div>);
                      } else {
                          return (<div><p className='text-2xl font-bold'>{monthlyBillableEventCount}</p><p className='text-sm text-muted-foreground'>billable clients this month.</p></div>);
                      }
                  })()}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}><Separator className="my-8 bg-border/50" /></motion.div>

          {loading === false && barbers.length === 0 ? (
            <motion.div variants={fadeIn}>
              <Card className='mt-8 bg-card border-border'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-primary'><Wand2 className='h-6 w-6' />Welcome! Let&apos;s Get You Set Up.</CardTitle>
                  <CardDescription>Your live queue view will appear here once you&apos;ve added your staff members.</CardDescription>
                </CardHeader>
                <CardContent>
                  <motion.div initial="initial" animate="animate" variants={staggerContainer} className='space-y-4'>
                    <p className='font-semibold'>Follow these simple steps:</p>
                    {[
                      { title: 'Click "Edit Shop"', description: 'Open the main settings panel by clicking the "Edit Shop" button in the top-right corner.' },
                      { title: 'Add Services & Staff', description: 'In the dialog, add the services you offer and the staff members on your team. Each staff member will get their own dedicated queue.' },
                      { title: 'Share Your QR Code', description: "Generate your shop's unique QR code from the \"Edit Shop\" panel and share it with your customers so they can join the queue!" }
                    ].map((step, i) => (
                      <motion.div key={i} variants={fadeIn} className='flex items-start gap-4 p-4 bg-muted rounded-lg'>
                        <div className='bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0'>{i + 1}</div>
                        <div><h4 className='font-bold'>{step.title}</h4><p className='text-sm text-muted-foreground'>{step.description}</p></div>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <>
              <motion.div initial="initial" animate="animate" variants={staggerContainer} className='grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'>
                {workingBarbers.map((barber) => {
                  const barberQueue = queueEntries.filter((entry) => entry.barbers?.id === barber.id);
                  const waitingForBarber = barberQueue.filter((entry) => entry.status === 'waiting');
                  const inProgressWithBarber = barberQueue.find((entry) => entry.status === 'in_progress');
                  return (
                    <motion.div key={barber.id} variants={fadeIn} className='space-y-4'>
                      <div className="flex justify-between items-center">
                        <h2 className='text-xl font-semibold flex items-center gap-2'>
                          <Avatar className="h-8 w-8 border-2 border-border"><AvatarImage src={barber.avatar_url || ''}/><AvatarFallback>{barber.name.charAt(0)}</AvatarFallback></Avatar>
                          {barber.name}
                        </h2>
                        {barber.is_on_break && <Badge variant="destructive">ON BREAK</Badge>}
                      </div>
                      <Card className={`transition-all duration-300 ${inProgressWithBarber ? 'border-primary shadow-primary/10 shadow-lg' : 'border-border bg-card'}`}>
                        {inProgressWithBarber ? (
                          <>
                            <CardHeader><CardTitle className='flex justify-between items-start'><span>{inProgressWithBarber.client_name}</span><Badge className='bg-primary text-primary-foreground'>In Progress</Badge></CardTitle><CardDescription>Services: { inProgressWithBarber.queue_entry_services?.map(item => item.services?.name).filter(Boolean).join(', ') || 'N/A' }</CardDescription></CardHeader>
                            <CardFooter className='flex justify-end'><Button size='sm' className='bg-green-600 hover:bg-green-700 transition-transform hover:scale-105' onClick={() => handleUpdateStatus(inProgressWithBarber.id, 'done')}>Mark as Done</Button></CardFooter>
                          </>
                        ) : ( <CardContent className='pt-6'><p className='text-sm text-center text-muted-foreground'>Available</p></CardContent> )}
                      </Card>
                      <Separator className="bg-border/50"/>
                      <motion.div initial="initial" animate="animate" variants={staggerContainer} className='space-y-2'>
                        <h3 className='text-sm font-medium text-muted-foreground flex items-center gap-2'><Badge variant='secondary'>{waitingForBarber.length}</Badge>Waiting</h3>
                        {waitingForBarber.map((entry, index) => (
                          <motion.div key={entry.id} variants={fadeIn}>
                            <Card className="bg-card border-border transition-all hover:border-border/50 hover:-translate-y-1">
                              <CardHeader className='p-4'>
                                <CardTitle className='text-base flex justify-between items-start'>
                                  <span className='font-semibold'>{index + 1}. {entry.client_name}</span>
                                  <div className='flex gap-1 flex-shrink-0'>
                                    <Button variant='ghost' size='icon' className='h-7 w-7 hover:text-primary transition-colors' onClick={() => handleOpenEditDialog(entry)}><Edit className='h-4 w-4' /></Button>
                                    <Button variant='ghost' size='icon' className='h-7 w-7 hover:text-destructive transition-colors' onClick={() => handleUpdateStatus(entry.id, 'no_show')}><Trash2 className='h-4 w-4' /></Button>
                                    <Button variant='outline' size='sm' className="hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => handleUpdateStatus(entry.id, 'in_progress')} disabled={!!inProgressWithBarber || barber.is_on_break || shop.subscription_status === 'past_due' || (totalEventCount >= 100 && (shop.subscription_status === 'trial' || shop.subscription_status === null))}>Start</Button>
                                  </div>
                                </CardTitle>
                                <CardDescription className='text-xs pt-1'>{ entry.queue_entry_services?.map(item => item.services?.name).filter(Boolean).join(', ') || 'No services listed' }</CardDescription>
                              </CardHeader>
                            </Card>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>
              <motion.div initial="initial" animate="animate" variants={staggerContainer} className='mt-8 grid gap-8 grid-cols-1 lg:grid-cols-2 xl:col-span-3'>
                <motion.div variants={fadeIn}>
                  <Card className='bg-card border-border'>
                    <CardHeader><CardTitle>Completed Today</CardTitle></CardHeader>
                    <CardContent>
                      {visibleCompletedList.length > 0 ? (
                        <div className='space-y-4'>
                            {visibleCompletedList.map((entry, index) => ( <div key={entry.id} className='flex items-center justify-between text-sm'><p>{index + 1}. {entry.client_name} <span className='text-muted-foreground'>with {entry.barbers?.name || 'N/A'}</span></p><Badge variant={'default'}>Done</Badge></div> ))}
                        </div>
                      ) : (<p className='text-sm text-center text-muted-foreground'>No clients have been marked as done yet.</p>)}
                      {fullCompletedList.length > 5 && !showAllCompleted && ( <Button variant='link' className='w-full mt-4 hover:text-primary' onClick={() => setShowAllCompleted(true)}>See all {fullCompletedList.length}</Button> )}
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={fadeIn}>
                  <Card className='bg-card border-border'>
                    <CardHeader><CardTitle>No-Shows</CardTitle></CardHeader>
                    <CardContent>
                      {visibleNoShowList.length > 0 ? (
                        <div className='space-y-4'>
                          {visibleNoShowList.map((entry, index) => (
                            <div key={entry.id} className='flex items-center justify-between text-sm'>
                              <p>{index + 1}. {entry.client_name} <span className='text-muted-foreground'>with {entry.barbers?.name || 'N/A'}</span></p>
                              <div className='flex items-center gap-2'>
                                <Badge variant={'secondary'}>No Show</Badge>
                                <Button variant='ghost' size='icon' className='h-7 w-7 hover:text-primary' title='Re-queue Client' onClick={() => handleRequeue(entry)}><RefreshCw className='h-4 w-4' /></Button>
                                <Button variant='ghost' size='icon' className='h-7 w-7 hover:text-destructive' title='Delete Entry' onClick={() => handleDeleteFromQueue(entry.id)}><Trash2 className='h-4 w-4' /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (<p className='text-sm text-center text-muted-foreground'>No clients have been marked as a no-show.</p>)}
                      {fullNoShowList.length > 5 && !showAllNoShows && ( <Button variant='link' className='w-full mt-4 hover:text-primary' onClick={() => setShowAllNoShows(true)}>See all {fullNoShowList.length}</Button> )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
              <motion.div variants={fadeIn} className='mt-8 xl:col-span-3'>
                <div className='flex flex-wrap justify-between items-center gap-4 mb-4'>
                  <h2 className='text-2xl font-bold tracking-tight'>Analytics</h2>
                  <div>
                    <Select value={analyticsRange} onValueChange={setAnalyticsRange}><SelectTrigger className='w-[180px]'><SelectValue placeholder='Select a range' /></SelectTrigger><SelectContent><SelectItem value='today'>Today</SelectItem><SelectItem value='week'>This Week</SelectItem><SelectItem value='month'>This Month</SelectItem><SelectItem value='all_time'>All Time</SelectItem></SelectContent></Select>
                  </div>
                </div>
                {isAnalyticsLoading ? (<p className='text-center text-muted-foreground py-10'><Loader2 className="h-6 w-6 animate-spin mx-auto" /></p>) : analyticsData ? (
                  <motion.div initial="initial" animate="animate" variants={staggerContainer}>
                    <div className='grid gap-4 md:grid-cols-3 mb-8'>
                      <motion.div variants={fadeIn}><Card><CardHeader><CardTitle>Total Revenue</CardTitle></CardHeader><CardContent><p className='text-2xl font-bold'>${(analyticsData.totalRevenue || 0).toFixed(2)}</p></CardContent></Card></motion.div>
                      <motion.div variants={fadeIn}><Card><CardHeader><CardTitle>Customers Served</CardTitle></CardHeader><CardContent><p className='text-2xl font-bold'>{analyticsData.totalCustomers || 0}</p></CardContent></Card></motion.div>
                      <motion.div variants={fadeIn}><Card><CardHeader><CardTitle>No-Show Rate</CardTitle></CardHeader><CardContent><p className='text-2xl font-bold'>{(analyticsData.noShowRate || 0).toFixed(1)}%</p></CardContent></Card></motion.div>
                    </div>
                    <div className='grid gap-8 grid-cols-1 lg:grid-cols-2'>
                      <motion.div variants={fadeIn}><Card><CardHeader><CardTitle>Revenue per Staff Member</CardTitle></CardHeader><CardContent><ResponsiveContainer width='100%' height={300}><BarChart data={analyticsData.barberRevenueData || []} layout='vertical' margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray='3 3' /><XAxis type='number' tickFormatter={(value) => `$${value}`} /><YAxis type='category' dataKey='name' width={80} /><Tooltip formatter={(value: number) => `$${Number(value).toFixed(2)}`} /><Bar dataKey='revenue' name='Total Revenue'>{(analyticsData.barberRevenueData || []).map((entry: { name: string }) => (<Cell key={`cell-${entry.name}`} fill={barberColorMap[entry.name] || '#8884d8'} />))}</Bar></BarChart></ResponsiveContainer></CardContent></Card></motion.div>
                      <motion.div variants={fadeIn}><Card><CardHeader><CardTitle>Clients per Staff Member</CardTitle></CardHeader><CardContent><ResponsiveContainer width='100%' height={300}><PieChart><Pie data={analyticsData.barberClientData || []} cx='50%' cy='50%' innerRadius={50} outerRadius={90} fill='#8884d8' paddingAngle={5} dataKey='clients' nameKey='name' label={({ name, clients }) => `${name}: ${clients}`}>{(analyticsData.barberClientData || []).map((entry: { name: string }) => (<Cell key={`cell-${entry.name}`} fill={barberColorMap[entry.name] || '#8884d8'} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card></motion.div>
                    </div>
                  </motion.div>
                ) : ( <p className='text-center text-muted-foreground'>No analytics data available for this period.</p> )}
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
      <Dialog open={isEditQueueEntryDialogOpen} onOpenChange={setIsEditQueueEntryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Queue for {editingQueueEntry?.client_name}</DialogTitle><DialogDescription>Change the assigned staff member for this client.</DialogDescription></DialogHeader>
          <div className='space-y-4 py-4'><div className='space-y-2'><Label htmlFor='barber-select'>Change Staff Member</Label><Select value={editedBarberId} onValueChange={setEditedBarberId}><SelectTrigger id='barber-select'><SelectValue placeholder='Select a staff member' /></SelectTrigger><SelectContent>{barbers.map((barber) => (<SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>))}</SelectContent></Select></div></div>
          <DialogFooter><DialogClose asChild><Button variant='outline'>Cancel</Button></DialogClose><Button onClick={handleUpdateQueueEntry}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBreakDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setBarberForBreak(null);
        }
        setIsBreakDialogOpen(isOpen);
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Start a Break for {barberForBreak?.name}</DialogTitle>
                <DialogDescription>
                    Select the approximate duration. This helps with wait time estimates but does not end the break automatically. You must toggle it off manually.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid gap-2">
                <Label htmlFor="break-duration">Approximate Duration (minutes)</Label>
                <Input id="break-duration" type="number" value={breakDuration} onChange={(e) => setBreakDuration(e.target.value)} min="5" step="5" />
            </div>
            <DialogFooter>
                <Button variant='outline' onClick={() => setIsBreakDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleStartBreak}>Start Break</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}