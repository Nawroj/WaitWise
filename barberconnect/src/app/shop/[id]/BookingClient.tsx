'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Import the UI components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Define types for our data
type Shop = { id: string; name: string; address: string; }
type Service = { id: string; name: string; price: number; duration_minutes: number }
type Barber = { id: string; name: string }

interface BookingClientProps {
  shop: Shop;
  services: Service[];
  barbers: Barber[];
}

export default function BookingClient({ shop, services, barbers }: BookingClientProps) {
  const supabase = createClient()

  // State for user's selections
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  
  // State for form and submission
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  
  // State to show success message after joining queue
  const [queueInfo, setQueueInfo] = useState<{ position: number; name: string } | null>(null);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedBarber || !clientName || !clientPhone) {
      alert('Please select a service, a barber, and enter your details.');
      return;
    }
    setLoading(true);

    try {
      // --- NEW CLIENT MANAGEMENT LOGIC ---
      let clientId = null;

      // 1. Check if a client with this phone number already exists for this shop
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', clientPhone)
        .eq('shop_id', shop.id)
        .single();
      
      if (existingClient) {
        // 2a. If client exists, use their ID
        clientId = existingClient.id;
      } else {
        // 2b. If client does not exist, create a new one
        const { data: newClient, error: newClientError } = await supabase
          .from('clients')
          .insert({ name: clientName, phone: clientPhone, shop_id: shop.id })
          .select('id')
          .single();
        
        if (newClientError) throw newClientError;
        clientId = newClient.id;
      }

      // 3. Now that we have a client ID, add the client to the queue
      const { data: queueData, error: queueError } = await supabase
        .from('queue_entries')
        .insert({
          shop_id: shop.id,
          service_id: selectedService.id,
          barber_id: selectedBarber.id,
          client_id: clientId, // Use the determined client ID
          client_name: clientName, // Still store name for easy display
          client_phone: clientPhone, // Still store phone for easy display/notifications
        })
        .select()
        .single();
      
      if (queueError) throw queueError;
      
      if (queueData) {
        setQueueInfo({ position: queueData.queue_position, name: queueData.client_name });
        setSelectedService(null);
        setSelectedBarber(null);
        setClientName('');
        setClientPhone('');
      }

    } catch (error) {
      if (error instanceof Error) {
        alert('Error joining queue: ' + error.message);
      } else {
        alert('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{shop.name}</h1>
        <p className="text-muted-foreground mt-1">{shop.address}</p>
      </header>
      <Separator />

      {queueInfo ? (
        <Alert className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertTitle className="text-green-800 dark:text-green-300">You're in the queue!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400">
                Thanks, {queueInfo.name}! You are number <strong>{queueInfo.position}</strong> in the queue. You&apos;ll be notified when it&apos;s your turn.
            </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleJoinQueue} className="mt-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">1. Select a Service</h2>
              <div className="flex flex-wrap gap-2">
                {services.map(service => (
                  <Button type="button" key={service.id} variant={selectedService?.id === service.id ? 'default' : 'outline'} onClick={() => setSelectedService(service)}>
                    {service.name} (${service.price})
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">2. Select a Barber</h2>
              <div className="flex flex-wrap gap-2">
                {barbers.map(barber => (
                  <Button type="button" key={barber.id} variant={selectedBarber?.id === barber.id ? 'default' : 'outline'} onClick={() => setSelectedBarber(barber)}>
                    {barber.name}
                  </Button>
                ))}
              </div>
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
            <Button type="submit" size="lg" className="w-full mt-4" disabled={loading}>
              {loading ? 'Joining Queue...' : 'Join Queue'}
            </Button>
        </form>
      )}
    </div>
  )
}
