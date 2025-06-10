'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Import the UI components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from '@/components/ui/separator'

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

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [bookingTime, setBookingTime] = useState<Date | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedBarber || !bookingTime || !clientName || !clientPhone) {
      alert('Please fill out all fields');
      return;
    }
    setLoading(true)
    const startTime = bookingTime;
    const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);
    const { error } = await supabase.from('appointments').insert({
      shop_id: shop.id,
      service_id: selectedService.id,
      barber_id: selectedBarber.id,
      client_name: clientName,
      client_phone: clientPhone,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });

    if (error) {
      alert('Error booking appointment: ' + error.message);
    } else {
      alert('Appointment booked successfully!');
      setSelectedService(null);
      setSelectedBarber(null);
      setBookingTime(null);
      setClientName('');
      setClientPhone('');
    }
    setLoading(false)
  };

  // A very simple time slot generator for demonstration
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    // For simplicity, let's just generate a few slots for today
    for (let i = 9; i < 17; i++) {
        const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i, 0, 0);
        if (slotTime > now) {
            slots.push(slotTime);
        }
    }
    return slots;
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{shop.name}</h1>
        <p className="text-muted-foreground mt-1">{shop.address}</p>
      </header>

      <Separator />

      <form onSubmit={handleBookAppointment} className="mt-8 space-y-8">
        {/* Step 1: Services */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">1. Select a Service</h2>
          <div className="flex flex-wrap gap-2">
            {services.map(service => (
              <Button
                type="button"
                key={service.id}
                variant={selectedService?.id === service.id ? 'default' : 'outline'}
                onClick={() => setSelectedService(service)}
              >
                {service.name} (${service.price})
              </Button>
            ))}
          </div>
        </div>

        {/* Step 2: Barbers */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">2. Select a Barber</h2>
          <div className="flex flex-wrap gap-2">
            {barbers.map(barber => (
              <Button
                type="button"
                key={barber.id}
                variant={selectedBarber?.id === barber.id ? 'default' : 'outline'}
                onClick={() => setSelectedBarber(barber)}
              >
                {barber.name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Step 3: Time Slots */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">3. Select a Time</h2>
          <div className="flex flex-wrap gap-2">
            {generateTimeSlots().map(time => (
              <Button
                type="button"
                key={time.toISOString()}
                variant={bookingTime?.getTime() === time.getTime() ? 'default' : 'outline'}
                onClick={() => setBookingTime(time)}
              >
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Step 4: Client Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">4. Your Details</h2>
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
          {loading ? 'Booking...' : 'Book Appointment'}
        </Button>
      </form>
    </div>
  )
}