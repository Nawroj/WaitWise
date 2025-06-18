'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Clock, Timer, Bell } from 'lucide-react'

type Shop = {
  id: string;
  name: string;
  address: string;
  opening_time: string | null;
  closing_time: string | null;
}
type ServiceDuration = {
  duration_minutes: number | null;
};

type QueueEntryService = {
  services: ServiceDuration | null;
};

type FetchedQueueEntry = {
  barber_id: string;
  queue_entry_services: QueueEntryService[];
};
type Service = { id: string; name: string; price: number; duration_minutes: number }
type Barber = { id: string; name:string; avatar_url: string | null }
type QueueEntryWithBarber = {
    id: string;
    status: 'waiting' | 'in_progress';
    barbers: { name: string; id: string; } | null;
};
type NewQueueEntryData = { id: string, queue_position: number, client_name: string };

interface BookingClientProps {
  shop: Shop;
  services: Service[];
  barbers: Barber[];
}

export default function BookingClient({ shop, services, barbers }: BookingClientProps) {
  const supabase = createClient()

  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [queueInfo, setQueueInfo] = useState<{ position: number; name: string } | null>(null);
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({});
  const [waitTimes, setWaitTimes] = useState<Record<string, number>>({});
  const [checkName, setCheckName] = useState('');
  const [checkPhone, setCheckPhone] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPositionInfo, setCheckedPositionInfo] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState('default');
  // --- MODIFIED: State now tracks both queue and barber ID ---
  const [currentUserQueueEntryId, setCurrentUserQueueEntryId] = useState<string | null>(null);
  const [currentUserBarberId, setCurrentUserBarberId] = useState<string | null>(null);

  // --- MODIFIED: Effect now checks for both IDs in localStorage ---
  useEffect(() => {
    setNotificationPermission(Notification.permission);
    
    const storedQueueId = localStorage.getItem(`queueEntryId_${shop.id}`);
    const storedBarberId = localStorage.getItem(`barberId_${shop.id}`);
    
    if (storedQueueId && storedBarberId) {
      setCurrentUserQueueEntryId(storedQueueId);
      setCurrentUserBarberId(storedBarberId);
    }
  }, [shop.id]);


  const isShopOpen = useMemo(() => {
    if (!shop.opening_time || !shop.closing_time) {
      return false;
    }
    const now = new Date();

    const openingTimeParts = shop.opening_time.split(':');
    const closingTimeParts = shop.closing_time.split(':');

    const openingDate = new Date();
    openingDate.setHours(parseInt(openingTimeParts[0]), parseInt(openingTimeParts[1]), 0);

    const closingDate = new Date();
    closingDate.setHours(parseInt(closingTimeParts[0]), parseInt(closingTimeParts[1]), 0);

    return now >= openingDate && now <= closingDate;
  }, [shop.opening_time, shop.closing_time]);

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const isValidAustralianPhone = (phone: string) => {
    const phoneRegex = /^(04|02|03|07|08)\d{8}$/;
    const cleanedPhone = phone.replace(/\s/g, '');
    return phoneRegex.test(cleanedPhone);
  };

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + service.price, 0);
  }, [selectedServices]);

  const handleServiceSelect = (service: Service) => {
    setSelectedServices(prev => {
        if (prev.some(s => s.id === service.id)) {
            return prev.filter(s => s.id !== service.id);
        }
        return [...prev, service];
    });
  };

  const fetchQueueDetails = useCallback(async () => {
    const { data, error } = await supabase
      .from('queue_entries')
      .select(`
        barber_id,
        queue_entry_services (
          services ( duration_minutes )
        )
      `)
      .eq('shop_id', shop.id)
      .eq('status', 'waiting');

    if (error) {
      console.error("Error fetching queue details:", error);
      return;
    }

    const newCounts: Record<string, number> = {};
    const newWaitTimes: Record<string, number> = {};

    for (const entry of data as unknown as FetchedQueueEntry[]) {
      if (entry.barber_id) {
        newCounts[entry.barber_id] = (newCounts[entry.barber_id] || 0) + 1;

        const entryDuration = entry.queue_entry_services.reduce((total, qes) => {
          const serviceDuration = qes.services?.duration_minutes || 0;
          return total + serviceDuration;
        }, 0);

        newWaitTimes[entry.barber_id] = (newWaitTimes[entry.barber_id] || 0) + entryDuration;
      }
    }

    setWaitingCounts(newCounts);
    setWaitTimes(newWaitTimes);
  }, [supabase, shop.id]);

  const showNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === 'granted') {
      new Notification(title, { 
        body,
        icon: '/favicon.ico'
      });
    }
  }, [notificationPermission]);

  // --- MODIFIED: Real-time listener now checks user's position in the queue ---
  useEffect(() => {
    fetchQueueDetails();
    const channel = supabase
      .channel(`booking_queue_realtime_for_${shop.id}`)
      .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `shop_id=eq.${shop.id}`
      }, async (payload) => { // Made async to await queue check
          fetchQueueDetails();

          // Check if the current user is waiting for a "you're next" notification
          if (currentUserQueueEntryId && currentUserBarberId) {
            const { data: waitingQueue, error } = await supabase
              .from('queue_entries')
              .select('id')
              .eq('barber_id', currentUserBarberId)
              .eq('status', 'waiting')
              .order('queue_position', { ascending: true });

            if (error || !waitingQueue) return;

            const userPositionIndex = waitingQueue.findIndex(entry => entry.id === currentUserQueueEntryId);

            // If user is number 1 in the queue (index 0)
            if (userPositionIndex === 0) {
              showNotification(
                "You're next in line!",
                `Please head to the shop. You are next for your barber at ${shop.name}.`
              );
              // Clear stored IDs to prevent re-notification
              localStorage.removeItem(`queueEntryId_${shop.id}`);
              localStorage.removeItem(`barberId_${shop.id}`);
              setCurrentUserQueueEntryId(null);
              setCurrentUserBarberId(null);
            }
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, shop.id, fetchQueueDetails, currentUserQueueEntryId, currentUserBarberId, showNotification]);

  // --- MODIFIED: Now saves both queue entry ID and barber ID ---
  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedBarber) return;

    if (selectedServices.length === 0 || !clientName || !clientPhone) {
      alert('Please select at least one service and enter your details.');
      return;
    }
    if (!isValidAustralianPhone(clientPhone)) {
      alert('Please enter a valid 10-digit Australian mobile or landline number.');
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    try {
      let clientId = null;
      const { data: existingClient } = await supabase.from('clients').select('id').eq('phone', clientPhone).eq('shop_id', shop.id).single();
      if (existingClient) { clientId = existingClient.id; }
      else {
        const { data: newClient, error: newClientError } = await supabase.from('clients').insert({ name: clientName, phone: clientPhone, shop_id: shop.id }).select('id').single();
        if (newClientError) throw newClientError;
        clientId = newClient.id;
      }

      const { data: queueData, error: rpcError } = await supabase.rpc('create_queue_entry_with_services', {
        p_shop_id: shop.id,
        p_barber_id: selectedBarber.id,
        p_client_id: clientId,
        p_client_name: clientName,
        p_client_phone: clientPhone,
        p_service_ids: selectedServices.map(s => s.id)
      });

      if (rpcError) throw rpcError;
      const newEntry = queueData as NewQueueEntryData;

      if (newEntry) {
        // Store both IDs in localStorage and state for notification listener
        localStorage.setItem(`queueEntryId_${shop.id}`, newEntry.id);
        localStorage.setItem(`barberId_${shop.id}`, selectedBarber.id);
        setCurrentUserQueueEntryId(newEntry.id);
        setCurrentUserBarberId(selectedBarber.id);

        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          setNotificationPermission(permission);
        } else {
          setNotificationPermission(Notification.permission);
        }

        const { data: waitingQueue, error: waitingQueueError } = await supabase.from('queue_entries').select('id, queue_position').eq('barber_id', selectedBarber.id).eq('status', 'waiting').order('queue_position', { ascending: true });
        if (waitingQueueError) {
            console.error("Could not fetch waiting queue:", waitingQueueError);
            setQueueInfo({ position: newEntry.queue_position, name: newEntry.client_name });
        } else {
            const position = waitingQueue.findIndex(entry => entry.id === newEntry.id) + 1;
            const finalPosition = position > 0 ? position : waitingQueue.length;
            setQueueInfo({ position: finalPosition, name: newEntry.client_name });
        }

        setSelectedServices([]);
        setSelectedBarber(null);
        setClientName('');
        setClientPhone('');
      }
    } catch (error) {
      alert(`Error joining queue: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setIsSubmitting(false), 5000);
    }
  };

  const handleCheckPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName || !checkPhone) {
        setCheckedPositionInfo('Please enter both your name and phone number.');
        return;
    }
    if (!isValidAustralianPhone(checkPhone)) {
        setCheckedPositionInfo('Please enter a valid 10-digit Australian phone number to check your status.');
        return;
    }

    setIsChecking(true);
    setCheckedPositionInfo(null);
    const { data: userEntry, error: userEntryError } = await supabase
      .from('queue_entries')
      .select(`id, status, barbers ( id, name )`)
      .ilike('client_name', checkName)
      .eq('client_phone', checkPhone.replace(/\s/g, ''))
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single<QueueEntryWithBarber>();

    if (userEntryError || !userEntry) { setCheckedPositionInfo("We couldn't find you in the current queue. Please check your details or join the queue."); setIsChecking(false); return; }
    
    // --- MODIFIED: If user checks and is found, set their IDs for notifications ---
    if (userEntry.barbers?.id) {
        localStorage.setItem(`queueEntryId_${shop.id}`, userEntry.id);
        localStorage.setItem(`barberId_${shop.id}`, userEntry.barbers.id);
        setCurrentUserQueueEntryId(userEntry.id);
        setCurrentUserBarberId(userEntry.barbers.id);
    }

    if (userEntry.status === 'in_progress') { setCheckedPositionInfo(`You're up next! You are currently with ${userEntry.barbers?.name || 'a barber'}.`); setIsChecking(false); return; }

    const barberId = userEntry.barbers?.id;
    if (!barberId) { setCheckedPositionInfo("There was an error finding your barber. Please contact the shop."); setIsChecking(false); return; }

    const { data: waitingQueue, error: waitingQueueError } = await supabase.from('queue_entries').select('id').eq('barber_id', barberId).eq('status', 'waiting').order('queue_position', { ascending: true });

    if (waitingQueueError) { setCheckedPositionInfo("Could not determine your position. Please contact the shop."); setIsChecking(false); return; }
    const position = waitingQueue.findIndex(entry => entry.id === userEntry.id) + 1;

    if (position > 0) { setCheckedPositionInfo(`You are number ${position} in the queue for ${userEntry.barbers?.name}.`);}
    else { setCheckedPositionInfo("We found you, but could not determine your exact position. Please check with the shop.");}
    setIsChecking(false);
  }

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{shop.name}</h1>
        <p className="text-muted-foreground mt-1">{shop.address}</p>
      </header>
      <Separator />

      <div className="text-center mt-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button type="button" variant="link" className="w-full">Already in the queue? Check your position</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Check Your Position</DialogTitle>
                  <DialogDescription>Enter the name and phone number you used to join the &quot;queue&quot;.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCheckPosition} className="space-y-4"><div className="grid gap-2"><Label htmlFor="check-name">Your Name</Label><Input id="check-name" value={checkName} onChange={(e) => setCheckName(e.target.value)} /></div><div className="grid gap-2"><Label htmlFor="check-phone">Your Phone</Label><Input id="check-phone" type="tel" value={checkPhone} onChange={(e) => setCheckPhone(e.target.value)} /></div><Button type="submit" className="w-full" disabled={isChecking}>{isChecking ? "Checking..." : "Check Position"}</Button></form>
                {checkedPositionInfo && (<Alert><AlertDescription>{checkedPositionInfo}</AlertDescription></Alert>)}
                <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      {!isShopOpen ? (
        <Card className="mt-8 text-center p-8">
            <CardHeader>
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">Sorry, we&apos;re currently closed.</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    Our operating hours are from {formatTime(shop.opening_time)} to {formatTime(shop.closing_time)}. Please check back then!
                </p>
            </CardContent>
        </Card>
      ) : queueInfo ? (
        <Alert className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertTitle className="text-green-800 dark:text-green-300">You&apos;re in the queue!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400 space-y-2">
                <p>Thanks, {queueInfo.name}! You are number <strong>{queueInfo.position}</strong> in the queue.</p>
                {notificationPermission === 'granted' && (
                  <p className="text-xs flex items-center gap-1.5"><Bell className="h-3 w-3"/>We'll notify you when you're next in line.</p>
                )}
                {notificationPermission === 'denied' && (
                  <p className="text-xs">You have blocked notifications. You can enable them in your browser settings to be alerted.</p>
                )}
            </AlertDescription>
        </Alert>
      ) : (
        <>
            <form onSubmit={handleJoinQueue} className="mt-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">1. Select Service(s)</h2>
                    <p className="text-lg font-semibold">Total: ${totalPrice.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {services.map(service => (
                      <Button type="button" key={service.id} variant={selectedServices.some(s => s.id === service.id) ? 'default' : 'outline'} onClick={() => handleServiceSelect(service)}>
                        {service.name} (${service.price})
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">2. Select a Barber</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{barbers.map(barber => {
                    const waitingCount = waitingCounts[barber.id] || 0;
                    const waitTime = waitTimes[barber.id] || 0;
                    return (
                      <Card key={barber.id} className={`cursor-pointer transition-all ${selectedBarber?.id === barber.id ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/50'}`} onClick={() => setSelectedBarber(barber)}>
                        <CardContent className="flex flex-col items-center justify-center p-4 gap-2 h-full">
                          <Avatar className="w-20 h-20"><AvatarImage src={barber.avatar_url || undefined} alt={barber.name} /><AvatarFallback>{barber.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                          <div className="text-center">
                            <p className="font-medium">{barber.name}</p>
                            <Badge variant={waitingCount > 0 ? "default" : "secondary"} className="mt-1 transition-colors">
                              {waitingCount} waiting
                            </Badge>
                            {waitTime > 0 && (
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1.5">
                                <Timer className="h-3 w-3" />
                                ~{waitTime} min wait
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}</div>
                </div>
                <div className="space-y-4 pt-4">
                  <h2 className="text-xl font-semibold">3. Your Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                          <Label htmlFor="client-name">Your Name</Label>
                          <Input id="client-name" placeholder="e.g., Jane Doe" value={clientName} onChange={e => setClientName(e.target.value)} required />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="client-phone">Your Phone</Label>
                          <Input id="client-phone" type="tel" placeholder="e.g., 0412 345 678" value={clientPhone} onChange={e => setClientPhone(e.target.value)} required />
                      </div>
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading || isSubmitting}>
                  {isSubmitting ? 'Joining...' : 'Join Queue'}
                </Button>
            </form>
        </>
      )}
    </div>
  )
}
