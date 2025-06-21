'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Shop = {
  id: string;
  name: string;
  address: string;
  owner_id: string;
  subscription_status: 'trial' | 'active' | 'past_due' | null;
  stripe_customer_id: string | null;
  opening_time: string | null;
  closing_time: string | null;
};

interface CreateShopFormProps {
  onShopCreated: (newShop: Shop) => void;
}

export function CreateShopForm({ onShopCreated }: CreateShopFormProps) {
  const supabase = createClient()
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [openingTime, setOpeningTime] = useState('09:00')
  const [closingTime, setClosingTime] = useState('17:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("Could not find user. Please log in again.")
      }

      const { data: newShop, error: insertError } = await supabase
        .from('shops')
        .insert({
          name: shopName,
          address: shopAddress,
          opening_time: openingTime,
          closing_time: closingTime,
          owner_id: user.id
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      if (newShop) {
        onShopCreated(newShop as Shop)
      }

    } catch (err) {
      // --- FIX 1: Type-safe error handling ---
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred.')
      }
      console.error("Error creating shop:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Welcome to WaitWise!</CardTitle>
          <CardDescription>
            {/* --- FIX 2: Escaped the apostrophe in "Let's" --- */}
            Let&apos;s get your business set up. Fill in the details below to create your shop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateShop} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="shop-name">Shop Name</Label>
              <Input
                id="shop-name"
                placeholder="e.g., The Modern Barber"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shop-address">Shop Address</Label>
              <Input
                id="shop-address"
                placeholder="e.g., 123 Main St, Sydney, NSW"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="opening-time">Opening Time</Label>
                <Input
                  id="opening-time"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="closing-time">Closing Time</Label>
                <Input
                  id="closing-time"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Shop...' : 'Create Shop'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}