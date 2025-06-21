/// <reference types="https://esm.sh/v135/@supabase/supabase-js@2.43.4/dist/module/index.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { shop_id, startDate, endDate } = await req.json()
    if (!shop_id || !startDate || !endDate) {
      throw new Error("Missing required parameters: shop_id, startDate, or endDate")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch all billable events (completed jobs) within the date range
    const { data: billableEvents, error: billableError } = await supabaseAdmin
      .from('billable_events')
      .select('queue_entry_id')
      .eq('shop_id', shop_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (billableError) throw billableError

    const doneEntryIds = billableEvents.map(be => be.queue_entry_id);

    // If there are no completed jobs, return empty stats
    if (doneEntryIds.length === 0) {
      return new Response(JSON.stringify({
        totalRevenue: 0,
        totalCustomers: 0,
        noShowRate: 0,
        barberRevenueData: [],
        barberClientData: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Fetch the full details for only the completed queue entries
    const { data: doneEntries, error: doneEntriesError } = await supabaseAdmin
      .from('queue_entries')
      .select('status, barbers ( name ), queue_entry_services ( services ( price ) )')
      .in('id', doneEntryIds)
    
    if (doneEntriesError) throw doneEntriesError

    // 3. Fetch no-show entries separately for the no-show rate calculation
    const { data: noShowEntries, error: noShowError } = await supabaseAdmin
      .from('queue_entries')
      .select('id')
      .eq('shop_id', shop_id)
      .eq('status', 'no_show')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (noShowError) throw noShowError

    // --- Process the Data ---
    const totalCustomers = doneEntries.length;
    const totalRevenue = doneEntries.reduce((total, entry) => {
      const entryTotal = entry.queue_entry_services.reduce((sum, qes) => sum + (qes.services?.price || 0), 0);
      return total + entryTotal;
    }, 0);

    const totalRelevantEntries = totalCustomers + noShowEntries.length;
    const noShowRate = totalRelevantEntries > 0 ? (noShowEntries.length / totalRelevantEntries) * 100 : 0;

    const barberRevenue = doneEntries.reduce((acc, entry) => {
        if (entry.barbers?.name) {
            const entryTotal = entry.queue_entry_services.reduce((sum, qes) => sum + (qes.services?.price || 0), 0);
            acc[entry.barbers.name] = (acc[entry.barbers.name] || 0) + entryTotal;
        }
        return acc;
    }, {});
    const barberRevenueData = Object.keys(barberRevenue).map(name => ({ name, revenue: barberRevenue[name] }));
    
    const barberClientCount = doneEntries.reduce((acc, entry) => {
        if (entry.barbers?.name) {
            acc[entry.barbers.name] = (acc[entry.barbers.name] || 0) + 1;
        }
        return acc;
    }, {});
    const barberClientData = Object.keys(barberClientCount).map(name => ({ name, clients: barberClientCount[name] }));

    const analyticsData = {
      totalRevenue,
      totalCustomers,
      noShowRate,
      barberRevenueData,
      barberClientData,
    }

    return new Response(JSON.stringify(analyticsData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})