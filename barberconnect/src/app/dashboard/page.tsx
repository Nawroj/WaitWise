'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Define types for our data for better code quality
type Shop = { id: string; name: string; address: string; owner_id: string }
type Service = { id: string; name: string; price: number; duration_minutes: number }
type Barber = { id: string; name: string }

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)

  // State for our forms
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')
  const [barberName, setBarberName] = useState('')

  // Fetch all necessary data on component load
  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Check if the user has a shop
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .single() // We expect only one shop per user

      if (shopData) {
        setShop(shopData)
        // If a shop exists, fetch its services and barbers
        const { data: servicesData } = await supabase.from('services').select('*').eq('shop_id', shopData.id)
        const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id)
        setServices(servicesData || [])
        setBarbers(barbersData || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [supabase, router])

  // Form submission handlers
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !shopName || !shopAddress) return

    const { data, error } = await supabase
      .from('shops')
      .insert({ name: shopName, address: shopAddress, owner_id: user.id })
      .select()
      .single()
    
    if (data) setShop(data)
    else if (error) console.error('Error creating shop:', error)
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop || !serviceName || !servicePrice || !serviceDuration) return
    
    const { data, error } = await supabase
      .from('services')
      .insert({ name: serviceName, price: parseFloat(servicePrice), duration_minutes: parseInt(serviceDuration), shop_id: shop.id })
      .select()
      .single()
    
    if (data) setServices([...services, data])
    setServiceName(''); setServicePrice(''); setServiceDuration(''); // Reset form
  }

  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop || !barberName) return

    const { data, error } = await supabase
      .from('barbers')
      .insert({ name: barberName, shop_id: shop.id })
      .select()
      .single()
    
    if (data) setBarbers([...barbers, data])
    setBarberName(''); // Reset form
  }

  if (loading) return <div>Loading...</div>

  // RENDER LOGIC
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Logged in as: {user?.email}</p>
      <hr style={{ margin: '20px 0' }} />

      {!shop ? (
        // SCENE 1: User has no shop, show create form
        <div>
          <h2>Create Your Barbershop</h2>
          <p>Let's get your shop set up. Add your business details here.</p>
          <form onSubmit={handleCreateShop}>
            <input type="text" placeholder="Shop Name" value={shopName} onChange={e => setShopName(e.target.value)} required style={{ padding: '8px', marginRight: '10px' }} />
            <input type="text" placeholder="Shop Address" value={shopAddress} onChange={e => setShopAddress(e.target.value)} required style={{ padding: '8px', marginRight: '10px' }}/>
            <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>Create Shop</button>
          </form>
        </div>
      ) : (
        // SCENE 2: User has a shop, show management UI
        <div>
          <h2>{shop.name}</h2>
          <p>{shop.address}</p>

          <div style={{ display: 'flex', gap: '40px', marginTop: '40px' }}>
            {/* Manage Services */}
            <div style={{ flex: 1 }}>
              <h3>Our Services</h3>
              <ul>{services.map(s => <li key={s.id}>{s.name} - ${s.price} ({s.duration_minutes} mins)</li>)}</ul>
              <form onSubmit={handleAddService} style={{ marginTop: '20px' }}>
                <input type="text" placeholder="Service Name" value={serviceName} onChange={e => setServiceName(e.target.value)} required />
                <input type="number" placeholder="Price" value={servicePrice} onChange={e => setServicePrice(e.target.value)} required />
                <input type="number" placeholder="Duration (mins)" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} required />
                <button type="submit">Add Service</button>
              </form>
            </div>

            {/* Manage Barbers */}
            <div style={{ flex: 1 }}>
              <h3>Our Barbers</h3>
              <ul>{barbers.map(b => <li key={b.id}>{b.name}</li>)}</ul>
              <form onSubmit={handleAddBarber} style={{ marginTop: '20px' }}>
                <input type="text" placeholder="Barber's Name" value={barberName} onChange={e => setBarberName(e.target.value)} required />
                <button type="submit">Add Barber</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}