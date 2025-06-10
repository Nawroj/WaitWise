'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from '@/components/ui/separator'

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

  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')
  const [barberName, setBarberName] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
      if (shopData) {
        setShop(shopData)
        const { data: servicesData } = await supabase.from('services').select('*').eq('shop_id', shopData.id).order('created_at')
        const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id).order('created_at')
        setServices(servicesData || [])
        setBarbers(barbersData || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [supabase, router])

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !shopName || !shopAddress) return
    const { data } = await supabase.from('shops').insert({ name: shopName, address: shopAddress, owner_id: user.id }).select().single()
    if (data) setShop(data)
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop || !serviceName || !servicePrice || !serviceDuration) return
    const { data } = await supabase.from('services').insert({ name: serviceName, price: parseFloat(servicePrice), duration_minutes: parseInt(serviceDuration), shop_id: shop.id }).select().single()
    if (data) setServices([...services, data])
    setServiceName(''); setServicePrice(''); setServiceDuration('');
  }

  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop || !barberName) return
    const { data } = await supabase.from('barbers').insert({ name: barberName, shop_id: shop.id }).select().single()
    if (data) setBarbers([...barbers, data])
    setBarberName('');
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Logged in as: {user?.email}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </header>
      <Separator />
      {!shop ? (
        <div className="mt-8">
            <Card className="max-w-xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl">Create Your Barbershop</CardTitle>
                    <CardDescription>Let&apos;s get your shop set up. Add your business details here to get started.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateShop} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="shop-name">Shop Name</Label>
                            <Input id="shop-name" placeholder="e.g., Bankstown Fresh Cuts" value={shopName} onChange={e => setShopName(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="shop-address">Shop Address</Label>
                            <Input id="shop-address" placeholder="e.g., 123 Chapel Road, Bankstown NSW" value={shopAddress} onChange={e => setShopAddress(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full mt-2">Create Shop</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
      ) : (
        <div className="mt-8">
            <div className="mb-6">
                <h2 className="text-2xl font-semibold">{shop.name}</h2>
                <p className="text-muted-foreground">{shop.address}</p>
            </div>
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Our Services</CardTitle>
                        <CardDescription>Manage the services your shop offers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {services.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell>${s.price}</TableCell>
                                        <TableCell className="text-right">{s.duration_minutes} mins</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter>
                         <form onSubmit={handleAddService} className="flex gap-2 w-full items-end">
                            <div className="grid gap-1.5 flex-grow">
                                <Label htmlFor="service-name">New Service</Label>
                                <Input id="service-name" placeholder="Standard Cut" value={serviceName} onChange={e => setServiceName(e.target.value)} required />
                            </div>
                             <div className="grid gap-1.5">
                                <Input type="number" placeholder="Price" value={servicePrice} onChange={e => setServicePrice(e.target.value)} required />
                            </div>
                             <div className="grid gap-1.5">
                                <Input type="number" placeholder="Mins" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} required />
                            </div>
                            <Button type="submit">Add</Button>
                        </form>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Our Barbers</CardTitle>
                        <CardDescription>Manage your team of barbers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {barbers.map(b => (
                                    <TableRow key={b.id}>
                                        <TableCell className="font-medium">{b.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter>
                        <form onSubmit={handleAddBarber} className="flex gap-2 w-full items-end">
                            <div className="grid gap-1.5 flex-grow">
                                <Label htmlFor="barber-name">New Barber</Label>
                                <Input id="barber-name" placeholder="e.g., John Smith" value={barberName} onChange={e => setBarberName(e.target.value)} required />
                            </div>
                            <Button type="submit">Add</Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </div>
      )}
    </div>
  )
}