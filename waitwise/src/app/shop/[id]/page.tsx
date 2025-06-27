export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import BookingClient from './BookingClient'
import { notFound } from 'next/navigation'

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  // Await the params
  const { id: shopId } = await params

  const supabase = await createClient()

  // Fetch the shop data on the server
  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single()

  if (!shop) {
    notFound()
  }

  // Fetch related data
  const { data: services } = await supabase.from('services').select('*').eq('shop_id', shop.id)
  
  // MODIFIED: Fetch only barbers who are marked as working today
  const { data: barbers } = await supabase
    .from('barbers')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('is_working_today', true)

  // Render the Client Component and pass the fetched data as props
  return (
    <BookingClient
      shop={shop}
      services={services || []}
      barbers={barbers || []}
    />
  )
}