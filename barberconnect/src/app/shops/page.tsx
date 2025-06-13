'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Define the type for a shop for type safety
type Shop = {
  id: string;
  name: string;
  address: string;
};

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchShops = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shops')
        .select('id, name, address')
        .order('name');

      if (error) {
        console.error('Error fetching shops:', error);
        setError('Could not fetch shops. Please try again later.');
      } else {
        setShops(data as Shop[]);
      }
      setLoading(false);
    };

    fetchShops();
  }, []);

  const filteredShops = useMemo(() => {
    if (!searchQuery) {
      return shops;
    }
    return shops.filter(shop =>
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, shops]);

  if (loading) {
    return <p className="p-8 text-center text-muted-foreground">Loading shops...</p>;
  }

  if (error) {
    return <p className="p-8 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Find a Barbershop</h1>
        <p className="text-muted-foreground mt-2">Select a shop below to join their queue.</p>
      </header>

      <div className="mb-8 max-w-md mx-auto">
        <Input
          type="text"
          placeholder="Search by shop name or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {filteredShops.length > 0 ? (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop) => (
            <Card key={shop.id} className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle>{shop.name}</CardTitle>
                  <CardDescription>{shop.address}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Future details like current wait time could go here */}
                </CardContent>
              </div>
              <CardFooter>
                <Link href={`/shop/${shop.id}`} className="w-full">
                  <Button className="w-full">Join Queue</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </main>
      ) : (
        <p className="text-center text-muted-foreground">
          {shops.length > 0 ? 'No shops match your search.' : 'No shops have registered yet.'}
        </p>
      )}
    </div>
  );
}