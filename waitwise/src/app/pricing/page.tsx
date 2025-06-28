'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
  // Define pricing tiers with their details and features
  const tiers = [
    {
      name: 'Trial',
      price: 'Free',
      period: 'for your first 50 clients',
      description: 'Get started with WaitWise and experience the full platform on us. No credit card required.',
      features: [
        '100 free client credits',
        'Full access to all features',
        'Unlimited Stuffs & Services',
        'QR Code for customers',
      ],
      cta: 'Start for Free',
      href: '/login',
      variant: 'outline' as const
    },
    {
      name: 'Pay-as-you-go',
      price: '$0.33',
      period: 'per completed client',
      description: 'Only pay for what you use. Perfect for businesses of all sizes with fluctuating client flow.',
      features: [
        'All features included',
        'Unlimited Stuffs & Services',
        'Daily Analytics',
        'QR Code for customers',
        'Pay based on your usage anytime',
      ],
      cta: 'Activate Now',
      href: '/login',
      variant: 'default' as const
    }
  ];

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      {/* Page Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, Fair Pricing</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Start for free, then only pay for what you use. No subscriptions, no hidden fees.
        </p>
      </header>

      {/* Pricing Cards Section */}
      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Map through tiers to render each pricing card */}
        {tiers.map((tier) => (
          <Card key={tier.name} className={`flex flex-col ${tier.name === 'Pay-as-you-go' ? 'border-primary' : ''}`}>
            <CardHeader>
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{tier.price}</span>
                {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
              </div>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {/* Display features for each tier */}
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            {/* Call to action button */}
            <div className="p-6 pt-0">
                <Link href={tier.href} className="w-full">
                    <Button size="lg" className="w-full" variant={tier.variant}>
                        {tier.cta}
                    </Button>
                </Link>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}