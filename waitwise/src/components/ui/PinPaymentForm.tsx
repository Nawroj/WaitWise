// In components/ui/PinPaymentForm.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

// --- FIX: Define specific interfaces for the Pin Payments library objects ---

// Describes a single error message from the API.
interface PinErrorMessage {
  param: string;
  message: string;
}

// Describes the structure of the error object.
interface PinError {
  messages: PinErrorMessage[];
}

// Describes the structure of a successful tokenization response.
interface PinSuccessResponse {
  token: string;
}

// Describes the instance returned by window.HostedFields.create()
interface HostedFieldsInstance {
  tokenize: (
    options: { publishable_api_key: string; [key: string]: string },
    callback: (err: PinError | null, response: PinSuccessResponse) => void
  ) => void;
}

// Describes the options for creating the hosted fields.
interface HostedFieldsCreateOptions {
  sandbox: boolean;
  style: { [key: string]: any }; // Style object can be complex, so `any` is acceptable here.
  fields: {
    name: { selector: string; placeholder: string };
    number: { selector: string; placeholder: string };
    cvc: { selector: string; placeholder: string };
    expiry: { selector: string; placeholder: string };
  };
}

// Define the HostedFields object on the window with our new types.
declare global {
  interface Window {
    HostedFields: {
      create: (options: HostedFieldsCreateOptions) => HostedFieldsInstance;
    };
  }
}

interface PinPaymentFormProps {
  publishableKey: string;
  onSuccess: (token: string) => void;
  onFailure: (error: string) => void;
}

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

  // --- FIX: Use the specific HostedFieldsInstance type for the ref ---
  const hostedFieldsRef = useRef<HostedFieldsInstance | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.HostedFields && document.getElementById('name')) {
        clearInterval(interval);
        
        if (!hostedFieldsRef.current) {
          hostedFieldsRef.current = window.HostedFields.create({
            sandbox: true,
            style: hostedFieldStyles,
            fields: {
              name: { selector: '#name', placeholder: 'Full Name' },
              number: { selector: '#number', placeholder: 'Card Number' },
              cvc: { selector: '#cvc', placeholder: 'CVC' },
              expiry: { selector: '#expiry', placeholder: 'MM/YYYY' },
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
        address_country: address.country,
      },
      // --- FIX: Use the specific types for the callback parameters ---
      (err: PinError | null, response: PinSuccessResponse) => {
        setIsLoading(false);
        if (err) {
          const newErrors: { [key: string]: string } = {};
          // --- No `any` needed here, TypeScript infers the type from PinError ---
          err.messages.forEach((errMsg) => {
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
    <form onSubmit={handleSubmit} className='space-y-3'>
      {/* Card Fields */}
      <div className='grid gap-1'>
        <Label htmlFor='name'>Name on Card</Label>
        <div id='name' className='pin-hosted-field'></div>
        {errors.name && <p className='text-sm text-red-500'>{errors.name}</p>}
      </div>
      <div className='grid gap-1'>
        <Label htmlFor='number'>Card Number</Label>
        <div id='number' className='pin-hosted-field'></div>
        {errors.number && <p className='text-sm text-red-500'>{errors.number}</p>}
      </div>
      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1'>
          <Label htmlFor='expiry'>Expiry</Label>
          <div id='expiry' className='pin-hosted-field'></div>
          {errors.expiry && <p className='text-sm text-red-500'>{errors.expiry}</p>}
        </div>
        <div className='grid gap-1'>
          <Label htmlFor='cvc'>CVC</Label>
          <div id='cvc' className='pin-hosted-field'></div>
          {errors.cvc && <p className='text-sm text-red-500'>{errors.cvc}</p>}
        </div>
      </div>
      
      {/* Address Fields */}
      <h3 className='text-lg font-semibold !mt-6'>Billing Address</h3>
      <div className='grid gap-1'>
        <Label htmlFor='line1'>Address Line 1</Label>
        <Input id='line1' name='line1' value={address.line1} onChange={handleAddressChange} required />
      </div>
      <div className='grid grid-cols-3 gap-4'>
        <div className='grid gap-1 col-span-2'>
            <Label htmlFor='city'>City</Label>
            <Input id='city' name='city' value={address.city} onChange={handleAddressChange} required />
        </div>
        <div className='grid gap-1'>
            <Label htmlFor='postcode'>Postcode</Label>
            <Input id='postcode' name='postcode' value={address.postcode} onChange={handleAddressChange} required />
        </div>
      </div>
      <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1'>
              <Label htmlFor='state'>State</Label>
              <Input id='state' name='state' value={address.state} onChange={handleAddressChange} required />
          </div>
          <div className='grid gap-1'>
              <Label htmlFor='country'>Country</Label>
              <Input id='country' name='country' value={address.country} onChange={handleAddressChange} required />
          </div>
      </div>
      
      <Button type='submit' disabled={isLoading} className='w-full !mt-6'>
        {isLoading ? 'Processing...' : 'Save Card'}
      </Button>
    </form>
  );
};