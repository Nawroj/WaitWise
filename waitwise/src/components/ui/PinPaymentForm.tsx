// In components/ui/PinPaymentForm.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';



// Define the HostedFields object on the window
declare global {
  interface Window {
    HostedFields: {
      create: (options: any) => any;
    };
  }
}

interface PinPaymentFormProps {
  publishableKey: string;
  onSuccess: (token: string) => void;
  onFailure: (error: string) => void;
}

// --- ADD THIS STYLE OBJECT ---
// This object defines the styles for the input fields inside the iframes.
// It uses your app's CSS variables to ensure a perfect match with your theme.
const hostedFieldStyles = {
  default: {
    color: 'hsl(var(--foreground))',
    backgroundColor: 'hsl(var(--background))',
    fontSize: '14px',
    fontFamily: 'inherit',
    '::placeholder': {
      color: 'hsl(var(--muted-foreground))',
    },
  },
  focus: {
    color: 'hsl(var(--foreground))',
    backgroundColor: 'hsl(var(--background))',
    borderColor: 'hsl(var(--primary))',
  },
  valid: {
    borderColor: 'hsl(var(--success))',
  },
  invalid: {
    borderColor: 'hsl(var(--destructive))',
    color: 'hsl(var(--destructive))',
  },
};



export const PinPaymentForm: React.FC<PinPaymentFormProps> = ({ publishableKey, onSuccess, onFailure }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [address, setAddress] = useState({
    line1: '',
    city: '',
    postcode: '',
    state: '',
    country: 'Australia',
  });
  
  const hostedFieldsRef = useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.HostedFields && document.getElementById('name')) {
        clearInterval(interval);
        
        if (!hostedFieldsRef.current) {
            hostedFieldsRef.current = window.HostedFields.create({
              sandbox: true,
              // --- PASS THE STYLES HERE ---
              style: hostedFieldStyles,
              fields: {
                name: { selector: '#name', placeholder: 'Full Name' },
                number: { selector: '#number', placeholder: 'Card Number' },
                cvc: { selector: '#cvc', placeholder: 'CVC' },
                expiry: { selector: '#expiry', placeholder: 'MM/YYYY' }
              },
            });
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddress(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    if (!hostedFieldsRef.current) {
      onFailure('Payment form not initialized.');
      setIsLoading(false);
      return;
    }

    hostedFieldsRef.current.tokenize(
      {
        publishable_api_key: publishableKey,
        address_line1: address.line1,
        address_city: address.city,
        address_postcode: address.postcode,
        address_state: address.state,
        address_country: address.country
      },
      (err: any, response: any) => {
        setIsLoading(false);
        if (err) {
          const newErrors: { [key: string]: string } = {};
          err.messages.forEach((errMsg: any) => {
            newErrors[errMsg.param] = errMsg.message;
          });
          setErrors(newErrors);
          onFailure('Please check your card and address details.');
          return;
        }
        onSuccess(response.token);
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Card Fields */}
      <div className="grid gap-1">
        <Label htmlFor="name">Name on Card</Label>
        <div id="name" className="pin-hosted-field"></div>
        {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="number">Card Number</Label>
        <div id="number" className="pin-hosted-field"></div>
        {errors.number && <p className="text-sm text-red-500">{errors.number}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1">
          <Label htmlFor="expiry">Expiry</Label>
          <div id="expiry" className="pin-hosted-field"></div>
          {errors.expiry && <p className="text-sm text-red-500">{errors.expiry}</p>}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cvc">CVC</Label>
          <div id="cvc" className="pin-hosted-field"></div>
          {errors.cvc && <p className="text-sm text-red-500">{errors.cvc}</p>}
        </div>
      </div>
      
      {/* Address Fields */}
      <h3 className="text-lg font-semibold !mt-6">Billing Address</h3>
      <div className="grid gap-1">
        <Label htmlFor="line1">Address Line 1</Label>
        <Input id="line1" name="line1" value={address.line1} onChange={handleAddressChange} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1 col-span-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" value={address.city} onChange={handleAddressChange} required />
        </div>
        <div className="grid gap-1">
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" name="postcode" value={address.postcode} onChange={handleAddressChange} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" value={address.state} onChange={handleAddressChange} required />
          </div>
          <div className="grid gap-1">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" value={address.country} onChange={handleAddressChange} required />
          </div>
      </div>
      
      <Button type="submit" disabled={isLoading} className="w-full !mt-6">
        {isLoading ? 'Processing...' : 'Save Card'}
      </Button>
    </form>
  );
};