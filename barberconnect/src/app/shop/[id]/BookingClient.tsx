'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"

type Shop = { id: string; name: string; address: string; }
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
  const [checkName, setCheckName] = useState('');
  const [checkPhone, setCheckPhone] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPositionInfo, setCheckedPositionInfo] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- NEW: Phone number validation function ---
  const isValidAustralianPhone = (phone: string) => {
    // Regex for 10-digit Australian mobile or landline numbers.
    const phoneRegex = /^(04|02|03|07|08)\d{8}$/;
    // Remove all whitespace from the input before testing.
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

  useEffect(() => {
    const fetchWaitingCounts = async () => {
        const { data, error } = await supabase.from('queue_entries').select('barber_id').eq('shop_id', shop.id).eq('status', 'waiting');
        if (error) { console.error("Error fetching waiting counts:", error); return; }
        const counts = data.reduce((acc, entry) => {
            if (entry.barber_id) { acc[entry.barber_id] = (acc[entry.barber_id] || 0) + 1; }
            return acc;
        }, {} as Record<string, number>);
        setWaitingCounts(counts);
    };
    fetchWaitingCounts();
    const channel = supabase.channel(`booking_queue_realtime_for_${shop.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `shop_id=eq.${shop.id}` }, () => fetchWaitingCounts()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, shop.id]);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0 || !selectedBarber || !clientName || !clientPhone) {
      alert('Please select at least one service, a barber, and enter your details.');
      return;
    }

    // --- NEW: Add phone number validation before submission ---
    if (!isValidAustralianPhone(clientPhone)) {
      alert('Please enter a valid 10-digit Australian mobile or landline number.');
      return;
    }

    setLoading(true);

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
    }
  };

  const handleCheckPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName || !checkPhone) { 
        setCheckedPositionInfo('Please enter both your name and phone number.'); 
        return; 
    }
    
    // --- NEW: Add phone number validation for checking status ---
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
      .eq('client_phone', checkPhone.replace(/\s/g, '')) // Also use cleaned phone for lookup
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single<QueueEntryWithBarber>();

    if (userEntryError || !userEntry) { setCheckedPositionInfo("We couldn't find you in the current queue. Please check your details or join the queue."); setIsChecking(false); return; }
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
                <form onSubmit={handleCheckPosition} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="check-name">Your Name</Label>
                        <Input id="check-name" value={checkName} onChange={(e) => setCheckName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="check-phone">Your Phone</Label>
                        <Input id="check-phone" type="tel" value={checkPhone} onChange={(e) => setCheckPhone(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={isChecking}>{isChecking ? "Checking..." : "Check Position"}</Button>
                </form>
                {checkedPositionInfo && (<Alert><AlertDescription>{checkedPositionInfo}</AlertDescription></Alert>)}
                <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </div>


      {queueInfo ? (
        <Alert className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertTitle className="text-green-800 dark:text-green-300">You&apos;re in the queue!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400 space-y-2">
                <p>Thanks, {queueInfo.name}! You are number <strong>{queueInfo.position}</strong> in the queue. You&apos;ll be notified when it&apos;s your turn.</p>
                <p className="text-xs">You can check your position again at any time using the &quot;Check Position&quot; link.</p>
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{barbers.map(barber => (<Card key={barber.id} className={`cursor-pointer transition-all ${selectedBarber?.id === barber.id ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/50'}`} onClick={() => setSelectedBarber(barber)}><CardContent className="flex flex-col items-center justify-center p-4 gap-2 h-full"><Avatar className="w-20 h-20"><AvatarImage src={barber.avatar_url || undefined} alt={barber.name} /><AvatarFallback>{barber.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar><div className="text-center"><p className="font-medium">{barber.name}</p><Badge variant={(waitingCounts[barber.id] || 0) > 0 ? "default" : "secondary"} className="mt-1 transition-colors">{waitingCounts[barber.id] || 0} waiting</Badge></div></CardContent></Card>))}</div>
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
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? 'Joining Queue...' : 'Join Queue'}
                </Button>
            </form>
        </>
      )}
    </div>
  )
}