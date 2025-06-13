'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Edit } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


type QueueEntry = {
  id: string;
  client_name: string;
  queue_position: number;
  status: 'waiting' | 'in_progress' | 'done' | 'no_show';
  barbers: { id: string; name: string; };
  queue_entry_services: {
    services: { id: string; name: string; price: number; } | null
  }[] | null;
}
type Shop = { id: string; name: string; address: string; owner_id: string }
type Service = { id:string; name: string; price: number; duration_minutes: number }
type Barber = { id: string; name: string; avatar_url: string | null }


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingQueueEntry, setEditingQueueEntry] = useState<QueueEntry | null>(null);
  const [isEditQueueEntryDialogOpen, setIsEditQueueEntryDialogOpen] = useState(false);
  const [editedBarberId, setEditedBarberId] = useState('');
  const [editedShopName, setEditedShopName] = useState('')
  const [editedShopAddress, setEditedShopAddress] = useState('')
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('')
  const [newBarberName, setNewBarberName] = useState('')
  const [newBarberAvatarFile, setNewBarberAvatarFile] = useState<File | null>(null)

  const fetchQueueData = useCallback(async (shopId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('queue_entries')
      .select(`*, barbers ( id, name ), queue_entry_services ( services ( id, name, price ) )`)
      .eq('shop_id', shopId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`)
      .order('queue_position');
    
    if (error) {
      console.error("Error fetching queue:", error);
      return [];
    }
    return data as QueueEntry[];
  }, [supabase]);

  // All useEffect hooks remain the same...
  useEffect(() => {
    async function initialFetch() {
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
        const [entriesData, { data: servicesData }, { data: barbersData }] = await Promise.all([
          fetchQueueData(shopData.id),
          supabase.from('services').select('*').eq('shop_id', shopData.id).order('created_at'),
          supabase.from('barbers').select('id, name, avatar_url').eq('shop_id', shopData.id).order('created_at')
        ]);
        setQueueEntries(entriesData);
        setServices(servicesData || []);
        setBarbers(barbersData || []);
      }
      setLoading(false);
    }
    initialFetch();
  }, [supabase, router, fetchQueueData]);

  useEffect(() => {
    if (!shop) return;
    const channel = supabase.channel(`queue_for_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `shop_id=eq.${shop.id}` }, async () => {
        const updatedQueue = await fetchQueueData(shop.id);
        setQueueEntries(updatedQueue);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entry_services' }, async () => {
        const updatedQueue = await fetchQueueData(shop.id);
        setQueueEntries(updatedQueue);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop, supabase, fetchQueueData]);

  useEffect(() => {
    if (!shop) return;
    const servicesChannel = supabase
      .channel(`services_for_${shop.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'services', filter: `shop_id=eq.${shop.id}`}, 
        (payload) => setServices((current) => [...current, payload.new as Service]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'services', filter: `shop_id=eq.${shop.id}`},
        (payload) => setServices((current) => current.filter(s => s.id !== payload.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(servicesChannel); };
  }, [shop, supabase]);

  useEffect(() => {
    if (!shop) return;
    const barbersChannel = supabase
      .channel(`barbers_for_${shop.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}`},
        (payload) => setBarbers((current) => [...current, payload.new as Barber]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}`},
        (payload) => setBarbers((current) => current.filter(b => b.id !== payload.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(barbersChannel); };
  }, [shop, supabase]);

  const completedList = useMemo(() => queueEntries.filter(e => e.status === 'done'), [queueEntries]);
  const noShowList = useMemo(() => queueEntries.filter(e => e.status === 'no_show'), [queueEntries]);
  
  const barberClientCount = useMemo(() => {
    const counts = barbers.reduce((acc, barber) => {
      acc[barber.name] = 0;
      return acc;
    }, {} as { [key: string]: number });
    completedList.forEach(entry => {
      if(entry.barbers?.name) {
        counts[entry.barbers.name] = (counts[entry.barbers.name] || 0) + 1;
      }
    });
    return Object.keys(counts).map(name => ({ name, clients: counts[name] }));
  }, [completedList, barbers]);

  const barberRevenue = useMemo(() => {
    const revenues = barbers.reduce((acc, barber) => {
      acc[barber.name] = 0;
      return acc;
    }, {} as { [key: string]: number });
    completedList.forEach(entry => {
      if(entry.barbers?.name) {
        const entryTotal = entry.queue_entry_services?.reduce((sum, qes) => {
          return sum + (qes.services?.price || 0);
        }, 0) || 0;
        revenues[entry.barbers.name] = (revenues[entry.barbers.name] || 0) + entryTotal;
      }
    });
    return Object.keys(revenues).map(name => ({ name, revenue: revenues[name] }));
  }, [completedList, barbers]);

  // All handlers remain the same...
  const handleUpdateStatus = async (id: string, newStatus: QueueEntry['status']) => { await supabase.from('queue_entries').update({ status: newStatus }).eq('id', id); };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }
  
  const handleDeleteFromQueue = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this entry?")) return;
    try {
      await supabase.from('queue_entries').delete().eq('id', id).throwOnError();
    } catch (error) {
      console.error("Delete queue entry error:", error);
      alert("Could not delete this entry.");
    }
  }

  const handleOpenEditDialog = (entry: QueueEntry) => {
    setEditingQueueEntry(entry);
    setEditedBarberId(entry.barbers.id);
    setIsEditQueueEntryDialogOpen(true);
  }

  const handleUpdateQueueEntry = async () => {
    if (!editingQueueEntry) return;
    
    const { error } = await supabase
      .from('queue_entries')
      .update({ barber_id: editedBarberId })
      .eq('id', editingQueueEntry.id);
    
    if (error) {
      alert(`Error updating barber: ${error.message}`);
      return;
    }
    setIsEditQueueEntryDialogOpen(false);
    setEditingQueueEntry(null);
  }

  const handleUpdateShopDetails = async () => {
    if (!shop) return;
    const { data: updatedShop } = await supabase.from('shops').update({ name: editedShopName, address: editedShopAddress }).eq('id', shop.id).select().single();
    if (updatedShop) setShop(updatedShop);
    alert("Shop details updated!");
  };
  const handleAddService = async () => {
    if (!shop || !newServiceName || !newServicePrice || !newServiceDuration) return;
    const { error } = await supabase.from('services').insert({ name: newServiceName, price: parseFloat(newServicePrice), duration_minutes: parseInt(newServiceDuration), shop_id: shop.id });
    if (!error) { 
      setNewServiceName(''); 
      setNewServicePrice(''); 
      setNewServiceDuration(''); 
    }
  };
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await supabase.from('services').delete().eq('id', serviceId).throwOnError();
    } catch (error) {
      console.error("Delete service error:", error);
      alert("Could not delete service. It may be linked to historical queue entries.");
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
        alert('Error uploading avatar. Please try again.');
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
    }
  };
  const handleDeleteBarber = async (barberId: string) => {
    if (!confirm("Are you sure you want to delete this barber?")) return;
    try {
      await supabase.from('barbers').delete().eq('id', barberId).throwOnError();
    } catch (error) {
      console.error("Delete barber error:", error);
      alert("Could not delete barber. They may be linked to historical queue entries.");
    }
  };

  // --- NEW: VIBRANT & CONSISTENT COLORS ---
  const VIBRANT_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

  const barberColorMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    barbers.forEach((barber, index) => {
      map[barber.name] = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
    });
    return map;
  }, [barbers]);


  if (loading) { return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div> }
  if (!shop) { return <div className="p-8">Please create a shop to view the dashboard.</div> }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        {/* Header and main Edit Shop dialog remain the same */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{shop.name} - Live View</h1>
          <div className="flex items-center gap-2">
            <Link href={`/shop/${shop.id}`} target="_blank"><Button variant="outline">Join Queue</Button></Link>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild><Button>Edit Shop</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                 {/* ... Edit shop cards ... */}
                 <DialogHeader>
                 <DialogTitle>Edit {editedShopName}</DialogTitle>
                 <DialogDescription>Update your shop details, services, and barbers here.</DialogDescription>
               </DialogHeader>
               <div className="grid gap-6 py-4">
                 <Card>
                   <CardHeader><CardTitle>Shop Details</CardTitle></CardHeader>
                   <CardContent className="grid gap-4">
                      <div className="grid gap-2"><Label htmlFor="name">Shop Name</Label><Input id="name" value={editedShopName} onChange={(e) => setEditedShopName(e.target.value)} /></div>
                      <div className="grid gap-2"><Label htmlFor="address">Shop Address</Label><Input id="address" value={editedShopAddress} onChange={(e) => setEditedShopAddress(e.target.value)} /></div>
                   </CardContent>
                   <CardFooter><Button onClick={handleUpdateShopDetails}>Save Shop Details</Button></CardFooter>
                 </Card>
                 <Card>
                   <CardHeader><CardTitle>Manage Services</CardTitle></CardHeader>
                   <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Price</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                          {services.map(s => <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>${s.price}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteService(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}
                        </TableBody>
                     </Table>
                   </CardContent>
                   <CardFooter className="flex gap-2 items-end">
                      <div className="grid gap-1.5 flex-grow"><Label htmlFor="new-service-name">New Service</Label><Input id="new-service-name" placeholder="Name" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} /></div>
                      <div className="grid gap-1.5 w-24"><Label htmlFor="new-service-price">Price</Label><Input id="new-service-price" type="number" placeholder="$" value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} /></div>
                      <div className="grid gap-1.5 w-24"><Label htmlFor="new-service-duration">Mins</Label><Input id="new-service-duration" type="number" placeholder="Time" value={newServiceDuration} onChange={e => setNewServiceDuration(e.target.value)} /></div>
                      <Button onClick={handleAddService}>Add</Button>
                   </CardFooter>
                 </Card>
                 <Card>
                   <CardHeader><CardTitle>Manage Barbers</CardTitle></CardHeader>
                   <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Barber</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                          {barbers.map(b => (
                            <TableRow key={b.id}>
                              <TableCell className="flex items-center gap-4">
                                <Avatar>
                                  <AvatarImage src={b.avatar_url || undefined} alt={b.name} />
                                  <AvatarFallback>{b.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                {b.name}
                              </TableCell>
                              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteBarber(b.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                     </Table>
                   </CardContent>
                   <CardFooter className="flex flex-col gap-4 items-start">
                      <div className="grid gap-1.5 w-full">
                        <Label htmlFor="new-barber-name">New Barber Name</Label>
                        <Input id="new-barber-name" placeholder="e.g., John Smith" value={newBarberName} onChange={e => setNewBarberName(e.target.value)} /></div>
                      <div className="grid gap-1.5 w-full">
                          <Label htmlFor="new-barber-avatar">Avatar</Label>
                          <Input id="new-barber-avatar" type="file" accept="image/*" onChange={(e) => e.target.files && setNewBarberAvatarFile(e.target.files[0])} />
                      </div>
                      <Button onClick={handleAddBarber}>Add Barber</Button>
                   </CardFooter>
                 </Card>
               </div>
               <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </header>
        <Separator />
        <div className="mt-8 grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {/* Barber columns remain the same */}
          {barbers.map(barber => {
            const barberQueue = queueEntries.filter(entry => entry.barbers?.id === barber.id);
            const waitingForBarber = barberQueue.filter(entry => entry.status === 'waiting');
            const inProgressWithBarber = barberQueue.find(entry => entry.status === 'in_progress');
            return (
              <div key={barber.id} className="space-y-4">
                <h2 className="text-xl font-semibold">{barber.name}</h2>
                <Card className={inProgressWithBarber ? "border-primary" : "border-transparent shadow-none"}>
                  {inProgressWithBarber ? (
                    <>
                      {/* ... In Progress Card ... */}
                      <CardHeader>
                        <CardTitle className="flex justify-between items-start">
                          <span>{inProgressWithBarber.client_name}</span>
                          <Badge variant="destructive" className="dark:text-black">In Progress</Badge>
                        </CardTitle>
                        <CardDescription>
                          Services: {
                            inProgressWithBarber.queue_entry_services && inProgressWithBarber.queue_entry_services.length > 0
                              ? inProgressWithBarber.queue_entry_services
                                  .map(item => item.services?.name)
                                  .filter(Boolean)
                                  .join(', ')
                              : 'No services listed'
                          }
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-end">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(inProgressWithBarber.id, 'done')}>Mark as Done</Button>
                      </CardFooter>
                    </>
                  ) : (
                    <CardContent className="pt-6">
                      <p className="text-sm text-center text-muted-foreground">Available</p>
                    </CardContent>
                  )}
                </Card>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Badge variant="secondary">{waitingForBarber.length}</Badge>
                    Waiting
                  </h3>
                  {waitingForBarber.map((entry, index) => (
                    <Card key={entry.id}>
                      <CardHeader className="p-4">
                        <CardTitle className="text-base flex justify-between items-start">
                          <span className="font-semibold">{index + 1}. {entry.client_name}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDialog(entry)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(entry.id, 'no_show')}><Trash2 className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(entry.id, 'in_progress')} disabled={!!inProgressWithBarber}>Start</Button>
                          </div>
                        </CardTitle>
                        <CardDescription className="text-xs pt-1">
                          {
                            entry.queue_entry_services && entry.queue_entry_services.length > 0
                              ? entry.queue_entry_services.map(item => item.services?.name).filter(Boolean).join(', ')
                              : 'No services listed'
                          }
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Completed and No-Shows Cards */}
        <div className="mt-8 grid gap-8 grid-cols-1 lg:grid-cols-2 xl:col-span-3">
          <Card className="bg-muted/50">
            <CardHeader><CardTitle>Completed Today</CardTitle></CardHeader>
            <CardContent>
              {completedList.length > 0 ? (
                <div className="space-y-4">
                    {completedList.map((entry, index) => (
                      <div key={entry.id} className="flex items-center justify-between text-sm"><p>{index + 1}. {entry.client_name} <span className="text-muted-foreground">with {entry.barbers.name}</span></p><Badge variant={'default'}>Done</Badge></div>
                    ))}
                </div>
              ) : (<p className="text-sm text-center text-muted-foreground">No clients have been marked as done yet.</p>)}
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardHeader><CardTitle>No-Shows</CardTitle></CardHeader>
            <CardContent>
              {noShowList.length > 0 ? (
                <div className="space-y-4">
                  {noShowList.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm">
                      <p>{index + 1}. {entry.client_name} <span className="text-muted-foreground">with {entry.barbers.name}</span></p>
                      <div className="flex items-center gap-2">
                        <Badge variant={'secondary'}>No Show</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteFromQueue(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (<p className="text-sm text-center text-muted-foreground">No clients have been marked as a no-show.</p>)}
            </CardContent>
          </Card>
        </div>

        {/* --- UPDATED: CHARTS SECTION --- */}
        <div className="mt-8 xl:col-span-3">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Today&apos;s Analytics</h2>
          <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Revenue per Barber</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barberRevenue} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="revenue" name="Total Revenue">
                      {barberRevenue.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={barberColorMap[entry.name] || '#8884d8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Clients per Barber</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={barberClientCount}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="clients"
                            nameKey="name"
                            label={({ name, clients }) => `${name}: ${clients}`}
                        >
                            {barberClientCount.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={barberColorMap[entry.name] || '#8884d8'} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* Edit Queue Entry Dialog */}
      <Dialog open={isEditQueueEntryDialogOpen} onOpenChange={setIsEditQueueEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Queue for {editingQueueEntry?.client_name}</DialogTitle>
            <DialogDescription>Change the assigned barber for this client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="barber-select">Change Barber</Label>
              <Select value={editedBarberId} onValueChange={setEditedBarberId}>
                <SelectTrigger id="barber-select">
                  <SelectValue placeholder="Select a barber" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map(barber => (
                    <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdateQueueEntry}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}