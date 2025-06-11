'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// Import all the UI components we will use
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


// Define types for our data for better code quality
type Shop = { id: string; name: string; address: string; owner_id: string }
// The 'Client' type definition has been removed as it is no longer used in this component.
type Service = { id:string; name: string; price: number; duration_minutes: number }
type Barber = { id: string; name: string; avatar_url: string | null }
type QueueEntry = {
  id: string;
  client_name: string;
  queue_position: number;
  status: 'waiting' | 'in_progress' | 'done' | 'no_show';
  services: { name: string };
  barbers: { id: string; name: string };
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)

  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editedShopName, setEditedShopName] = useState('')
  const [editedShopAddress, setEditedShopAddress] = useState('')
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('')
  const [newBarberName, setNewBarberName] = useState('')
  const [newBarberAvatarFile, setNewBarberAvatarFile] = useState<File | null>(null)

  // Data Fetching and Real-time Subscription
  useEffect(() => {
    async function fetchData() {
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

        const today = new Date().toISOString().slice(0, 10);
        // REMOVED: Fetching for the 'clients' table has been removed.
        const [
          { data: entriesData },
          { data: servicesData },
          { data: barbersData }
        ] = await Promise.all([
          supabase.from('queue_entries').select('*, services(name), barbers(id, name)').eq('shop_id', shopData.id).gte('created_at', `${today}T00:00:00Z`).lte('created_at', `${today}T23:59:59Z`).order('queue_position'),
          supabase.from('services').select('*').eq('shop_id', shopData.id).order('created_at'),
          supabase.from('barbers').select('id, name, avatar_url').eq('shop_id', shopData.id).order('created_at')
        ]);

        setQueueEntries(entriesData as QueueEntry[] || []);
        setServices(servicesData || []);
        setBarbers(barbersData || []);
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase, router]);

  // Real-time subscription useEffect
  useEffect(() => {
    if (!shop) return;
    
    const refetchQueue = async () => {
        const today = new Date().toISOString().slice(0, 10);
        const { data: entriesData } = await supabase
          .from('queue_entries')
          .select('*, services(name), barbers(id, name)')
          .eq('shop_id', shop.id)
          .gte('created_at', `${today}T00:00:00Z`)
          .lte('created_at', `${today}T23:59:59Z`)
          .order('queue_position');
        setQueueEntries(entriesData as QueueEntry[] || []);
    }
    
    const queueChannel = supabase.channel(`queue_for_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `shop_id=eq.${shop.id}` }, 
      () => {
        refetchQueue();
      }
    ).subscribe();

    // REMOVED: The real-time channel for 'clients' has been removed.

    return () => { 
      supabase.removeChannel(queueChannel);
    };
  }, [shop, supabase]);


  const doneList = useMemo(() => queueEntries.filter(e => e.status === 'done' || e.status === 'no_show'), [queueEntries]);

  const handleUpdateStatus = async (id: string, newStatus: QueueEntry['status']) => { await supabase.from('queue_entries').update({ status: newStatus }).eq('id', id); };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const handleUpdateShopDetails = async () => {
    if (!shop) return;
    const { data: updatedShop } = await supabase.from('shops').update({ name: editedShopName, address: editedShopAddress }).eq('id', shop.id).select().single();
    if (updatedShop) setShop(updatedShop);
    alert("Shop details updated!");
  };

  const handleAddService = async () => {
    if (!shop || !newServiceName || !newServicePrice || !newServiceDuration) return;
    const { data: newService } = await supabase.from('services').insert({ name: newServiceName, price: parseFloat(newServicePrice), duration_minutes: parseInt(newServiceDuration), shop_id: shop.id }).select().single();
    if (newService) { setServices([...services, newService]); setNewServiceName(''); setNewServicePrice(''); setNewServiceDuration(''); }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await supabase.from('services').delete().eq('id', serviceId).throwOnError();
      setServices(currentServices => currentServices.filter(s => s.id !== serviceId));
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
    const { data: newBarber } = await supabase.from('barbers').insert({ name: newBarberName, avatar_url: avatarUrl, shop_id: shop.id }).select().single();
    if (newBarber) { 
      setBarbers([...barbers, newBarber]); 
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
      setBarbers(currentBarbers => currentBarbers.filter(b => b.id !== barberId));
    } catch (error) {
      console.error("Delete barber error:", error);
      alert("Could not delete barber. They may be linked to historical queue entries.");
    }
  };


  if (loading) { return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div> }
  if (!shop) { return <div className="p-8">Please create a shop to view the dashboard.</div> }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{shop.name} - Live View</h1>
        <div className="flex items-center gap-2">
           <Link href={`/shop/${shop.id}`} target="_blank"><Button variant="outline">Join Queue Page</Button></Link>
           <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             <DialogTrigger asChild><Button>Edit Shop</Button></DialogTrigger>
             <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        <Input id="new-barber-name" placeholder="e.g., John Smith" value={newBarberName} onChange={e => setNewBarberName(e.target.value)} />
                      </div>
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
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <span>{inProgressWithBarber.client_name}</span>
                        <Badge variant="destructive">In Progress</Badge>
                      </CardTitle>
                      <CardDescription>Service: {inProgressWithBarber.services?.name}</CardDescription>
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
                      <CardTitle className="text-base flex justify-between">
                        <span>{index + 1}. {entry.client_name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(entry.id, 'no_show')}><Trash2 className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(entry.id, 'in_progress')} disabled={!!inProgressWithBarber}>Start</Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      <div className="md:col-span-2 xl:col-span-3">
          <Card className="mt-8 bg-muted/50">
            <CardHeader><CardTitle>Completed Today</CardTitle></CardHeader>
            <CardContent>
               <div className="space-y-4">{doneList.map((entry, index) => (<div key={entry.id} className="flex items-center justify-between text-sm"><p>{index + 1}. {entry.client_name} <span className="text-muted-foreground">with {entry.barbers.name}</span></p><Badge variant={entry.status === 'done' ? 'default' : 'secondary'}>{entry.status === 'done' ? 'Done' : 'No Show'}</Badge></div>))}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}