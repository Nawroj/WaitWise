'use client'; // This component will be used on the client side

import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface StripePaymentFormProps {
  onSuccess: () => void;
  onFailure: (message: string) => void;
  billingEmail: string; // Passed from parent
  shopId: string;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ onSuccess, onFailure, billingEmail, shopId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setLoading(true);
    toast.loading('Processing payment details...', { id: 'stripe-submit' });

    try {
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card Element not found.');
      }

      const { paymentMethod, error: createPaymentMethodError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: billingEmail,
        },
      });

      if (createPaymentMethodError) {
        throw new Error(createPaymentMethodError.message || 'Failed to create payment method.');
      }

      // Call the Supabase Edge Function
      const supabase = await import('@/lib/supabase/client').then(m => m.createClient()); // Dynamically import createClient
      const { error: invokeError } = await supabase.functions.invoke('create-stripe-customer-and-attach-payment-method', {
        body: {
          payment_method_id: paymentMethod.id,
          email: billingEmail,
          shop_id: shopId,
          // shop_id will be passed from the parent DashboardPage
          // This component doesn't know the shop_id directly.
          // It's better to pass it as a prop or get it from auth session if it's consistently tied to the user.
          // For this specific test, we'll assume the parent `DashboardPage` will handle the shop_id.
          // We'll modify DashboardPage to send it.
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Error invoking Supabase function.');
      }
      
      toast.dismiss('stripe-submit');
      toast.success('Payment method saved successfully!');
      onSuccess();

    } catch (error: unknown) {
      toast.dismiss('stripe-submit');
      let errorMessage = 'An unexpected error occurred.';
if (error instanceof Error) {
  errorMessage = error.message;
}
onFailure(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email-display">Billing Email</Label>
        <Input id="email-display" type="email" value={billingEmail} disabled />
      </div>
      <div className="grid gap-2">
        <Label>Card details</Label>
        <div className="p-3 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading ? 'Saving...' : 'Save Payment Method'}
      </Button>
    </form>
  );
};