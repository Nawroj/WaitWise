'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '../../../lib/supabase/client'
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Separator } from '../../../components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog"
import { Clock, Timer } from 'lucide-react'
import { toast } from "sonner"
import { motion } from "framer-motion"

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
type Shop = {
    id: string;
    name: string;
    logo_url: string | null;
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
type Service = {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
}
type Barber = {
    id: string;
    name: string;
    avatar_url: string | null;
    is_on_break: boolean;
    break_end_time: string | null;
}
type QueueEntryWithBarber = {
    id: string;
    status: 'waiting' | 'in_progress';
    barbers: {
        name: string;
        id: string;
    } | null;
};
type NewQueueEntryData = {
    id: string,
    queue_position: number,
    client_name: string
};
interface BookingClientProps {
    shop: Shop;
    services: Service[];
    barbers: Barber[];
}


export default function BookingClient({ shop, services, barbers }: BookingClientProps) {
  const supabase = createClient();

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [loading, setLoading] =useState(false);
  const [queueInfo, setQueueInfo] = useState<{ position: number; name: string } | null>(null);
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({});
  const [waitTimes, setWaitTimes] = useState<Record<string, number>>({});
  const [checkName, setCheckName] = useState('');
  const [checkPhone, setCheckPhone] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPositionInfo, setCheckedPositionInfo] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isShopOpen = useMemo(() => {
    if (!shop.opening_time || !shop.closing_time) {
        return true;
    }
    const now = new Date();
    const [openingHours, openingMinutes] = shop.opening_time.split(':').map(Number);
    const [closingHours, closingMinutes] = shop.closing_time.split(':').map(Number);
    const openingDate = new Date();
    openingDate.setHours(openingHours, openingMinutes, 0);
    const closingDate = new Date();
    closingDate.setHours(closingHours, closingMinutes, 0);
    return now >= openingDate && now <= closingDate;
  }, [shop.opening_time, shop.closing_time]);

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const isValidAustralianPhone = (phone: string) => /^(04|02|03|07|08)\d{8}$/.test(phone.replace(/\s/g, ''));
  const totalPrice = useMemo(() => selectedServices.reduce((sum, service) => sum + service.price, 0), [selectedServices]);

  const handleServiceSelect = (service: Service) => {
    setSelectedServices(prev => prev.some(s => s.id === service.id) ? prev.filter(s => s.id !== service.id) : [...prev, service]);
  };

  const fetchQueueDetails = useCallback(async () => {
    const { data, error } = await supabase
        .from('queue_entries')
        .select(`barber_id, queue_entry_services (services (duration_minutes))`)
        .eq('shop_id', shop.id)
        .eq('status', 'waiting');

    if (error) {
        console.error("Error fetching queue details:", error);
        return;
    }

    // Initialize wait times, factoring in any active breaks
    const newWaitTimes: Record<string, number> = {};
    const now = new Date();
    barbers.forEach(barber => {
        if (barber.is_on_break && barber.break_end_time) {
            const breakEndTime = new Date(barber.break_end_time);
            if (breakEndTime > now) {
                const remainingBreakMs = breakEndTime.getTime() - now.getTime();
                newWaitTimes[barber.id] = Math.ceil(remainingBreakMs / 60000);
            }
        }
    });

    // Add service durations for waiting clients
    const newCounts: Record<string, number> = {};
    for (const entry of data as unknown as FetchedQueueEntry[]) {
      if (entry.barber_id) {
        newCounts[entry.barber_id] = (newCounts[entry.barber_id] || 0) + 1;
        if (Array.isArray(entry.queue_entry_services)) {
            const entryDuration = entry.queue_entry_services.reduce((total, qes) => (total + (qes.services?.duration_minutes || 0)), 0);
            newWaitTimes[entry.barber_id] = (newWaitTimes[entry.barber_id] || 0) + entryDuration;
        }
      }
    }
    setWaitingCounts(newCounts);
    setWaitTimes(newWaitTimes);
  }, [supabase, shop.id, barbers]);

  useEffect(() => {
    fetchQueueDetails();
    const channel = supabase
        .channel(`booking_queue_realtime_for_${shop.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'queue_entries',
            filter: `shop_id=eq.${shop.id}`
        }, () => {
            fetchQueueDetails();
        })
        .subscribe();
    return () => {
        supabase.removeChannel(channel);
    };
  }, [supabase, shop.id, fetchQueueDetails]);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedBarber || selectedServices.length === 0 || !clientName || !clientPhone) {
        toast.error('Please complete all steps before joining.');
        return;
    }
    if (!isValidAustralianPhone(clientPhone)) {
        toast.error('Please enter a valid 10-digit Australian phone number.');
        return;
    }
    setLoading(true);
    setIsSubmitting(true);
    try {
      let clientId = null;
      const { data: existingClient } = await supabase.from('clients').select('id').eq('phone', clientPhone).eq('shop_id', shop.id).single();

      if (existingClient) {
          clientId = existingClient.id;
      } else {
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
        const { data: waitingQueue } = await supabase.from('queue_entries').select('id, queue_position').eq('barber_id', selectedBarber.id).eq('status', 'waiting').order('queue_position', { ascending: true });
        const position = waitingQueue ? waitingQueue.findIndex(entry => entry.id === newEntry.id) + 1 : 0;
        setQueueInfo({ position: position > 0 ? position : (waitingQueue?.length ?? 1), name: newEntry.client_name });
        setSelectedServices([]);
        setSelectedBarber(null);
        setClientName('');
        setClientPhone('');
      }

    } catch (error) {
        toast.error(`Error joining queue: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    } finally {
        setLoading(false);
        setTimeout(() => setIsSubmitting(false), 3000);
    }
  };

  const handleCheckPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName || !checkPhone) {
        setCheckedPositionInfo('Please enter both name and phone.');
        return;
    }
    if (!isValidAustralianPhone(checkPhone)) {
        setCheckedPositionInfo('Please enter a valid Australian phone number.');
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

    if (userEntryError || !userEntry) {
        setCheckedPositionInfo("We couldn't find you in the queue.");
        setIsChecking(false);
        return;
    }

    if (userEntry.status === 'in_progress') {
        setCheckedPositionInfo(`You're up next with ${userEntry.barbers?.name || 'a staff member'}.`);
        setIsChecking(false);
        return;
    }

    const { data: waitingQueue } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('barber_id', userEntry.barbers!.id)
        .eq('status', 'waiting')
        .order('queue_position', { ascending: true });

    if (!waitingQueue) {
        setCheckedPositionInfo("Could not determine your position.");
        setIsChecking(false);
        return;
    }

    const position = waitingQueue.findIndex(entry => entry.id === userEntry.id) + 1;
    if (position > 0) {
        setCheckedPositionInfo(`You are number ${position} in the queue for ${userEntry.barbers?.name}.`);
    } else {
        setCheckedPositionInfo("Could not determine your exact position.");
    }
    setIsChecking(false);
  }

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <motion.header
  variants={fadeIn}
  initial="initial"
  animate="animate"
  className="mb-6 text-center"
>
  {shop.logo_url ? (
    <div className="flex items-center justify-center mb-3"> {/* spacing below logo */}
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
    <h1 className="text-3xl font-bold tracking-tight text-primary mb-3">{shop.name}</h1>
  )}

  <p className="text-muted-foreground">{shop.address}</p>
</motion.header>

      <Separator className="bg-border/50" />

      {!isShopOpen ? (
        <motion.div variants={fadeIn} initial="initial" animate="animate">
          <Card className="mt-8 text-center p-8 bg-card border-border">
              <CardHeader>
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <CardTitle className="mt-4">Sorry, We're Currently Closed</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">
                      Our operating hours are from {formatTime(shop.opening_time)} to {formatTime(shop.closing_time)}.
                  </p>
              </CardContent>
          </Card>
        </motion.div>
      ) : queueInfo ? (
        <motion.div variants={fadeIn} initial="initial" animate="animate" className="mt-8">
            <Alert className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <AlertTitle className="text-green-800 dark:text-green-300">You&apos;re in the queue!</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-400 space-y-3">
                    <p>Thanks, {queueInfo.name}! You are number <strong>{queueInfo.position}</strong> in the queue.</p>
                    <p className="text-sm">We will send you an SMS when it&apos;s your turn. In the meantime, you can also check your position manually if you wish.</p>
                    <div className="mt-2 flex justify-center w-full">
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="link" className="mx-auto text-green-700 dark:text-green-400">
                                    Check your position now
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Check Your Position</DialogTitle>
                                    <DialogDescription>Enter the name and phone number you used to join the queue.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCheckPosition} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="check-name">Your Name</Label>
                                        <Input id="check-name" value={checkName} onChange={(e) => setCheckName(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="check-phone">Your Phone</Label>
                                        <Input id="check-phone" type="tel" value={checkPhone} onChange={(e) => setCheckPhone(e.target.value)} />
                                    </div>
                                    <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isChecking}>
                                        {isChecking ? "Checking..." : "Check Position"}
                                    </Button>
                                </form>
                                {checkedPositionInfo && (<Alert className="mt-4"><AlertDescription>{checkedPositionInfo}</AlertDescription></Alert>)}
                                <DialogFooter>
                                    <Button variant="ghost" className="hover:text-primary" onClick={() => setIsDialogOpen(false)}>Close</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </AlertDescription>
            </Alert>
        </motion.div>
      ) : (
        <motion.form onSubmit={handleJoinQueue} className="mt-8 space-y-10" initial="initial" animate="animate" variants={staggerContainer}>
            <motion.div className="space-y-4" variants={fadeIn}>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">1. Select Service(s)</h2>
                <p className="text-lg font-semibold text-primary">${totalPrice.toFixed(2)}</p>
              </div>
              <motion.div className="flex flex-wrap gap-2" variants={staggerContainer}>
                {services.map(service => (
                  <motion.div key={service.id} variants={fadeIn} className="transition-transform hover:-translate-y-1">
                    <Button type="button" variant={selectedServices.some(s => s.id === service.id) ? 'default' : 'outline'} onClick={() => handleServiceSelect(service)} className="transition-colors">
                      {service.name} (${service.price})
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div className="space-y-4" variants={fadeIn}>
              <h2 className="text-xl font-semibold">2. Select a Staff Member</h2>
              <motion.div className="grid grid-cols-2 md:grid-cols-3 gap-4" variants={staggerContainer}>{barbers.map(barber => {
                const waitingCount = waitingCounts[barber.id] || 0;
                const waitTime = waitTimes[barber.id] || 0;
                return (
                  <motion.div key={barber.id} variants={fadeIn} className="relative">
                    {barber.is_on_break && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg z-10 flex items-center justify-center">
                            <Badge variant="destructive">ON BREAK</Badge>
                        </div>
                    )}
                    <Card
                        className={`cursor-pointer transition-all h-full bg-card border-border hover:border-primary/80 ${selectedBarber?.id === barber.id ? 'border-primary ring-2 ring-primary/50' : ''}`}
                        onClick={() => !barber.is_on_break && setSelectedBarber(barber)}
                    >
                      <CardContent className="flex flex-col items-center justify-center p-4 gap-2 text-center">
                        <Avatar className="w-20 h-20 border-2 border-border">
                            <AvatarImage src={barber.avatar_url || undefined} alt={barber.name} />
                            <AvatarFallback>{barber.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
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
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
              </motion.div>
            </motion.div>

            <motion.div className="space-y-4" variants={fadeIn}>
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
            </motion.div>

            <motion.div variants={fadeIn}>
              <Button type="submit" size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105" disabled={loading || isSubmitting}>
                {isSubmitting ? 'Joining...' : 'Join Queue'}
              </Button>
            </motion.div>
        </motion.form>
      )}
    </div>
  )
}