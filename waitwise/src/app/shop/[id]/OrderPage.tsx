// app/shop/[id]/page.tsx

'use client'

import { useState, useMemo, useCallback } from 'react' // Removed useEffect
import Image from 'next/image'
import { createClient } from '../../../lib/supabase/client'
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Separator } from '../../../components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card' // Removed CardFooter
import { Badge } from '../../../components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../../components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible'
import { ShoppingCart, UtensilsCrossed, CheckCircle2, Trash2, ChevronDown, Info } from 'lucide-react' // Removed ChevronUp
import { toast } from "sonner"
import { motion, easeInOut } from 'framer-motion'

// Stripe.js imports for frontend checkout redirection
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);


// Animation Variants
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeInOut } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Type definitions
type Shop = {
    id: string;
    name: string;
    logo_url: string | null;
    address: string;
    opening_time: string | null;
    closing_time: string | null;
    type: 'hair_salon' | 'restaurant' | 'food_truck';
    enable_online_payments: boolean; // From DB
    pass_stripe_fees_to_customer: boolean; // From DB
}
type MenuItem = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    image_url: string | null;
    is_available: boolean;
}

type CartItem = {
    id: string; // MenuItem ID
    name: string;
    price: number;
    quantity: number;
    description: string | null;
    image_url: string | null;
};

interface OrderPageProps {
    shop: Shop; // Shop prop includes payment settings
    menuItems: MenuItem[]; // Food truck menu items
}

export default function OrderPage({ shop, menuItems }: OrderPageProps) {
  const supabase = useMemo(() => createClient(), []); // Memoize supabase client creation if it's consistently the same instance

  // --- General States ---
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [loading, setLoading] = useState(false); // General loading state for form submission / payment
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevents multiple submissions

  // --- States specific to Food Truck Ordering ---
  const [cart, setCart] = useState<CartItem[]>([]);
  // orderPlacedInfo will now only be used for the Stripe success/cancel page redirection and message display
  const [orderPlacedInfo, setOrderPlacedInfo] = useState<{ orderId: string; clientName: string; } | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);

  // Determine if the shop is currently open based on operating hours
  const isShopOpen = useMemo(() => {
    if (!shop.opening_time || !shop.closing_time) {
        return true;
    }
    const now = new Date();
    const [openingHours, openingMinutes] = shop.opening_time.split(':').map(Number);
    const [closingHours, closingMinutes] = shop.closing_time.split(':').map(Number);
    const openingDate = new Date();
    openingDate.setHours(openingHours, openingMinutes, 0);
    const closingDate = new Date();
    closingDate.setHours(closingHours, closingMinutes, 0);
    return now >= openingDate && now <= closingDate;
  }, [shop.opening_time, shop.closing_time]);

  // Format time strings for display (e.g., 9:00 AM)
  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      console.error("Error formatting time:", timeString, e);
      return timeString;
    }
  };

  // Validate Australian phone numbers
  const isValidAustralianPhone = useCallback((phone: string) => /^(04|\(04\)|\+614|02|03|07|08)\d{8}$/.test(phone.replace(/\s/g, '')), []);


  const totalCartPrice = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  // Calculate surcharge for display on frontend
  const calculateSurcharge = useMemo(() => {
    // Only calculate surcharge if shop owner has enabled passing fees to customer
    if (!shop.pass_stripe_fees_to_customer) {
      return 0;
    }
    // These rates MUST MATCH the backend API for secure calculation
    const STRIPE_DOMESTIC_RATE = 0.0175; // 1.75%
    const STRIPE_DOMESTIC_FIXED_FEE = 0.30; // A$0.30
    // SURCHARGE_BUFFER is removed as per decision.

    const estimatedSurcharge = (totalCartPrice * STRIPE_DOMESTIC_RATE) + STRIPE_DOMESTIC_FIXED_FEE; // Changed to const

    return parseFloat(estimatedSurcharge.toFixed(2)); // Round to 2 decimal places for display
  }, [totalCartPrice, shop.pass_stripe_fees_to_customer]);

  // Calculate total payable including surcharge
  const calculateTotalPayable = useMemo(() => {
    return totalCartPrice + calculateSurcharge;
  }, [totalCartPrice, calculateSurcharge]);


  // Wrapped functions in useCallback
  const handleAddToCart = useCallback((menuItem: MenuItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === menuItem.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...menuItem, quantity: 1 }];
      }
    });
    toast.success(`${menuItem.name} added to cart!`);
  }, []);

  const handleUpdateCartQuantity = useCallback((itemId: string, newQuantity: number) => {
    setCart(prevCart => {
      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== itemId);
      }
      return prevCart.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );
    });
  }, []);

  const handleRemoveFromCart = useCallback((itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    toast.info('Item removed from cart.');
  }, []);

  // MODIFIED: handleConfirmOrder to ONLY handle online payment
  const handleConfirmOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // MODIFIED: !clientPhone removed - only name is required for customer info for online orders
    if (isSubmitting || cart.length === 0 || !clientName) {
        toast.error('Please add items to your order and fill in your name.');
        return;
    }
    // MODIFIED: Only validate phone if it's provided (since it's now optional)
    if (clientPhone && !isValidAustralianPhone(clientPhone)) {
        toast.error('Please enter a valid 10-digit Australian phone number (e.g., 04XX XXX XXX), or leave it blank if you prefer not to provide it.');
        return;
    }
    // Critical check: Ensure shop allows online payments BEFORE initiating
    if (!shop.enable_online_payments) {
        toast.error('This food truck does not accept online payments. Please order directly at the food truck counter.');
        setIsCheckoutDialogOpen(false); // Close dialog if it was open incorrectly
        return;
    }

    setLoading(true);
    setIsSubmitting(true);

    try {
        const orderPayload = {
            shop_id: shop.id,
            items: cart.map(item => ({ menu_item_id: item.id, quantity: item.quantity })),
            client_name: clientName,
            client_phone: clientPhone || null, // MODIFIED: Pass null if phone is empty string
            notes: orderNotes, // Pass order notes
        };

        // ... rest of handleConfirmOrder logic (fetch, redirect etc.)

        const response = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initiate online payment.');
        }

        const { sessionId } = await response.json();
        const stripe = await stripePromise;
        if (stripe) {
            // Redirect to Stripe Checkout
            const { error } = await stripe.redirectToCheckout({ sessionId });
            if (error) {
                console.error("Stripe Redirect Error:", error.message);
                toast.error(`Payment failed: ${error.message}`);
            }
        }
    } catch (error) {
        toast.error(`Error placing order: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    } finally {
        setLoading(false);
        setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    cart,
    clientName,
    clientPhone,
    isValidAustralianPhone,
    shop, // shop.enable_online_payments, shop.id used
    orderNotes // orderNotes used
    // supabase - REMOVED from dependencies
  ]);


  // Group menu items by category for collapsible display
  const categorizedMenuItems = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems]);


  // --- Main Render Logic ---
  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      {/* Shop Header */}
      <motion.header
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="mb-6 text-center"
      >
        {shop.logo_url ? (
          <div className="flex items-center justify-center mb-3">
            <Image
              src={shop.logo_url}
              alt={`${shop.name} Logo`}
              width={144}
              height={36}
              className="object-contain dark:invert"
              priority
            />
          </div>
        ) : (
          <h1 className="text-3xl font-bold tracking-tight text-primary mb-3">{shop.name}</h1>
        )}
        <p className="text-muted-foreground">{shop.address}</p>
      </motion.header>

      <Separator className="bg-border/50" />

      {/* Conditional rendering based on shop status or order confirmation */}
      {!isShopOpen ? (
        <motion.div variants={fadeIn} initial="initial" animate="animate">
          <Card className="mt-8 text-center p-8 bg-card border-border">
              <CardHeader>
                  <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground" />
                  <CardTitle className="mt-4">Sorry, We&apos;re Currently Closed</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">
                      Our operating hours are from {formatTime(shop.opening_time)} to {formatTime(shop.closing_time)}.
                  </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : orderPlacedInfo ? (
          <motion.div variants={fadeIn} initial="initial" animate="animate" className="mt-8">
            <Alert className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-center">
              <AlertTitle className="text-green-800 dark:text-green-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6"/> Order Placed!
              </AlertTitle>
              <AlertDescription className="mt-4 text-green-700 dark:text-green-400 space-y-3 flex flex-col items-center justify-center text-center">
                <p>Thanks, {orderPlacedInfo.clientName}! Your order ID is <strong>{orderPlacedInfo.orderId}</strong>.</p>
                <p className="text-sm">Please proceed to the food truck for pickup. You will receive an SMS notification when your order is ready.</p> {/* Updated message */}
                <div className="flex justify-center">
                  <Button onClick={() => setOrderPlacedInfo(null)} className="mt-4">Place Another Order</Button>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        ) : !shop.enable_online_payments ? ( // If online payments are disabled by owner
            <motion.div variants={fadeIn} initial="initial" animate="animate">
              <Card className="mt-8 text-center p-8 bg-card border-border">
                  <CardHeader>
                      <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                      <CardTitle className="mt-4">Online Ordering Temporarily Unavailable</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-muted-foreground">
                          This food truck is not currently accepting online orders.
                          Please order and pay directly at the food truck counter.
                      </p>
                  </CardContent>
              </Card>
            </motion.div>
        ) : ( // Online ordering is available
          <motion.div className="mt-8 space-y-10" initial="initial" animate="animate" variants={staggerContainer}>
            {/* Menu Items Section */}
            <motion.div className="space-y-4" variants={fadeIn}>
                <h2 className="text-xl font-semibold flex items-center gap-2"><UtensilsCrossed className="h-6 w-6"/> Our Menu</h2>
                {menuItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {Object.entries(categorizedMenuItems).map(([category, itemsInCategory], index) => (
                            <Collapsible key={category} className="space-y-2" defaultOpen={index === 0}>
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-muted/80 transition-colors">
                                        <h3 className="text-lg font-bold">{category}</h3>
                                        <ChevronDown className="h-5 w-5 ui-open:rotate-180 transition-transform" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                        {itemsInCategory.map(menuItem => (
                                            <motion.div key={menuItem.id} variants={fadeIn}>
                                                <Card className="p-3 hover:shadow-lg transition-shadow">
                                                    <div className="flex items-center gap-4">
                                                    {menuItem.image_url ? (
                                                        <Image
                                                        src={menuItem.image_url}
                                                        alt={menuItem.name}
                                                        width={64}
                                                        height={64}
                                                        className="rounded-md object-cover flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-muted rounded-md">
                                                        <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col flex-grow min-w-0">
                                                        <p className="font-medium truncate">{menuItem.name}</p>
                                                        {menuItem.description && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{menuItem.description}</p>
                                                        )}
                                                        <p className="text-sm font-semibold text-primary">${menuItem.price.toFixed(2)}</p>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => handleAddToCart(menuItem)}
                                                        disabled={!menuItem.is_available}
                                                    >
                                                        {menuItem.is_available ? 'Add' : 'Sold Out'}
                                                    </Button>
                                                    </div>
                                                </Card>
                                            </motion.div>

                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                ) : (
                    <div className='text-center p-6 border-2 border-dashed rounded-lg'>
                        <UtensilsCrossed className='mx-auto h-12 w-12 text-muted-foreground' />
                        <h3 className='mt-4 text-lg font-semibold'>Menu Not Available</h3>
                        <p className='mt-1 text-sm text-muted-foreground'>Please check back later.</p>
                    </div>
                )}
            </motion.div>

            {/* Shopping Cart Summary */}
            {cart.length > 0 && (
                <motion.div className="space-y-4" variants={fadeIn}>
                    <h2 className="text-xl font-semibold flex items-center gap-2"><ShoppingCart className="h-6 w-6"/> Your Order <Badge variant="secondary">${totalCartPrice.toFixed(2)}</Badge></h2>
                    <Card className="p-4">
                        <CardContent className="space-y-3 p-0">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                    <div className="flex items-center gap-2">
                                        {item.image_url && <Image src={item.image_url} alt={item.name} width={40} height={40} className="rounded-md object-cover"/>}
                                        <div>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} ea</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleUpdateCartQuantity(item.id, item.quantity - 1)}>-</Button>
                                        <span className="font-semibold w-6 text-center">{item.quantity}</span>
                                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleUpdateCartQuantity(item.id, item.quantity + 1)}>+</Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFromCart(item.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-4 font-bold text-lg">
                                <span>Subtotal:</span>
                                <span>${totalCartPrice.toFixed(2)}</span>
                            </div>
                            {/* NEW: Surcharge Display */}
                            {calculateSurcharge > 0 && (
                                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                    <span>Online Service Fee:</span>
                                    <span>+${calculateSurcharge.toFixed(2)}</span>
                                </div>
                            )}
                            {/* NEW: Service Fee Information Helper */}
                  {shop.pass_stripe_fees_to_customer && ( // Only show if fees are passed
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2 italic">
                        <Info className="h-3 w-3 inline-block" />
                        This fee covers payment processing costs for your order.
                    </p>
                  )}
                            <div className="flex justify-between items-center font-bold text-xl mt-2 border-t pt-2">
                                <span>Total Payable:</span>
                                <span>${calculateTotalPayable.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Checkout Button - Opens Dialog */}
            <motion.div variants={fadeIn}>
                <Button
                    type="button"
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
                    disabled={loading || isSubmitting || cart.length === 0}
                    onClick={() => setIsCheckoutDialogOpen(true)} // Open the new dialog
                >
                    {loading || isSubmitting ? 'Processing...' : `Checkout ($${calculateTotalPayable.toFixed(2)})`}
                </Button>
            </motion.div>
          </motion.div>
        )
      }

      {/* Checkout Dialog (NEW) */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>Confirm Your Order</DialogTitle>
            <DialogDescription>
              Please enter your details and confirm your order.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmOrder}> {/* Wrap dialog content in a form */}
            <div className="grid gap-4 py-4">
              {/* Order Summary in Dialog */}
              <h3 className="text-lg font-semibold flex items-center gap-2">
                  Order Summary <Badge variant="secondary">${totalCartPrice.toFixed(2)}</Badge>
              </h3>
              <div className="max-h-40 overflow-y-auto pr-2 border-b pb-2">
                  {cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-sm mb-1">
                          <span>{item.quantity}x {item.name}</span>
                          <span>${(item.quantity * item.price).toFixed(2)}</span>
                      </div>
                  ))}
                  {calculateSurcharge > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground mt-2 border-t pt-2">
                          <span>Online Service Fee:</span>
                          <span>+${calculateSurcharge.toFixed(2)}</span>
                      </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mt-2">
                      <span>Total Payable:</span>
                      <span>${calculateTotalPayable.toFixed(2)}</span>
                  </div>
              </div>

              {/* Customer Details */}
              <div className="grid gap-2">
                  <Label htmlFor="client-name-dialog">Your Name</Label>
                  <Input id="client-name-dialog" placeholder="e.g., John Smith" value={clientName} onChange={e => setClientName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="client-phone-dialog">Your Phone (Optional)</Label> {/* Changed label */}
                  <Input
                      id="client-phone-dialog"
                      type="tel"
                      placeholder="e.g., 0412 345 678"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      // REMOVED: required attribute
                  />
                  {/* Phone Number Information Helper (already exists, but including for context) */}
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 italic">
                      <Info className="h-3 w-3 inline-block" />
                      We use your phone number to send SMS notifications when your order is ready.
                  </p>
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="order-notes-dialog">Special Requests/Notes (Optional)</Label>
                  <Input id="order-notes-dialog" placeholder="e.g., no onions" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
              </div>

              {/* Payment Options (Now only online payment is presented from here) */}
              <div className="space-y-3 mt-4">
                  <h3 className="text-lg font-semibold">Pay Now via Card / Apple Pay / Google Pay</h3>
                  <p className="p-3 bg-accent rounded-md text-accent-foreground text-sm">
                      If you are paying by cash, please order directly at the counter.
                  </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isSubmitting || loading}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || loading || cart.length === 0 || !clientName || (clientPhone && !isValidAustralianPhone(clientPhone))}>
                {isSubmitting ? 'Confirming...' : 'Proceed to Pay'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}