// app/api/stripe/onboard-account/route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '../../../../lib/supabase/server'; // Adjust path

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Ensures this route is not statically optimized
export const dynamic = 'force-dynamic';

interface RequestBody {
  shop_id: string;
  owner_email: string;
}

export async function POST(req: Request) {
  const { shop_id, owner_email }: RequestBody = await req.json(); // Expect shop_id and owner's email

  if (!shop_id || !owner_email) {
    return NextResponse.json({ error: 'Shop ID and owner email are required.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    // 1. Check if the shop already has a connected account ID
    const { data: existingShop, error: fetchError } = await supabase
      .from('shops')
      .select('stripe_connect_account_id')
      .eq('id', shop_id)
      .single();

    if (fetchError || !existingShop) {
      console.error('API: Error fetching shop for onboarding:', fetchError);
      return NextResponse.json({ error: 'Shop not found for onboarding.' }, { status: 404 });
    }

    let accountId = existingShop.stripe_connect_account_id;

    // If no existing account, create a new Express connected account
    if (!accountId) {
      console.log('API: Creating new Stripe Express account for shop:', shop_id);
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU', // IMPORTANT: Set your platform's primary country code
        email: owner_email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          // Link this Stripe account back to your internal shop and owner
          shop_id: shop_id,
          // You might fetch owner_id from Supabase auth here if needed for more detailed metadata
        }
      });
      accountId = account.id;

      // Update your shop record with the new Stripe Connect Account ID
      const { error: updateShopError } = await supabase
        .from('shops')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', shop_id);

      if (updateShopError) {
        console.error('API: Error updating shop with Stripe Connect Account ID:', updateShopError);
        // This is a critical error. You might want to delete the created Stripe account here
        // to prevent orphaned accounts.
        return NextResponse.json({ error: 'Failed to link Stripe account to shop in DB.' }, { status: 500 });
      }
      console.log('API: Shop updated with new Stripe Connect Account ID:', accountId);

    } else {
      console.log('API: Using existing Stripe Express account for shop:', accountId);
    }

    // Create an Account Link to direct the user to Stripe's onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      // These URLs are where Stripe redirects the user after the onboarding flow
      // They should point back to a page in your dashboard, or a generic success page.
      refresh_url: `${req.headers.get('origin')}/dashboard/settings/reauth`, // A page to handle re-authentication if link expires
      return_url: `${req.headers.get('origin')}/dashboard/settings/onboarding-complete`, // A page after successful onboarding
      type: 'account_onboarding', // Standard onboarding flow
    });

    console.log('API: Account link created:', accountLink.url);
    // Return the URL to the frontend to redirect the user
    return NextResponse.json({ url: accountLink.url }, { status: 200 });

  } catch (error: unknown) { // Catch as unknown and then assert type or check
    console.error('API: Error creating Stripe Connect account or link:', error);
    let errorMessage = 'Failed to initiate Stripe onboarding.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}