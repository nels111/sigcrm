import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadSource } from "@prisma/client";

// GET /api/reports/attribution — Marketing attribution: leads, conversions, wins by source
export async function GET() {
  try {
    // Fetch all leads with their conversion data
    const leads = await prisma.lead.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        leadSource: true,
        convertedToDealId: true,
        convertedToAccountId: true,
      },
    });

    // Fetch all won deals to map back to leads
    const wonDeals = await prisma.deal.findMany({
      where: {
        deletedAt: null,
        stage: { in: ["ClosedWonRecurring", "ClosedWonOneOff"] },
      },
      select: {
        id: true,
        leadId: true,
        stage: true,
        amount: true,
        monthlyValue: true,
      },
    });

    // Build a set of won deal IDs and a map from lead to won deal
    const wonDealIds = new Set(wonDeals.map((d) => d.id));
    const wonDealsByLeadId = new Map(
      wonDeals.filter((d) => d.leadId).map((d) => [d.leadId!, d])
    );

    // Get all unique lead sources (including null)
    const allSources = Object.values(LeadSource);

    // Build attribution data per source
    const attribution = allSources.map((source) => {
      const sourceLeads = leads.filter((l) => l.leadSource === source);
      const totalLeads = sourceLeads.length;

      // Converted = lead has a convertedToDealId or convertedToAccountId
      const convertedLeads = sourceLeads.filter(
        (l) => l.convertedToDealId || l.convertedToAccountId
      ).length;

      // Won = lead's converted deal is in won stages
      const wonLeads = sourceLeads.filter((l) => {
        if (l.convertedToDealId && wonDealIds.has(l.convertedToDealId)) {
          return true;
        }
        return wonDealsByLeadId.has(l.id);
      }).length;

      // Revenue from won deals for this source
      const wonRevenue = sourceLeads.reduce((sum, l) => {
        const deal =
          l.convertedToDealId && wonDealIds.has(l.convertedToDealId)
            ? wonDeals.find((d) => d.id === l.convertedToDealId)
            : wonDealsByLeadId.get(l.id);
        if (deal) {
          return sum + (deal.amount ? Number(deal.amount) : 0);
        }
        return sum;
      }, 0);

      const conversionRate =
        totalLeads > 0
          ? parseFloat(((convertedLeads / totalLeads) * 100).toFixed(1))
          : 0;
      const winRate =
        totalLeads > 0
          ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(1))
          : 0;

      return {
        source,
        totalLeads,
        convertedLeads,
        wonDeals: wonLeads,
        conversionRate,
        winRate,
        wonRevenue: parseFloat(wonRevenue.toFixed(2)),
      };
    });

    // Add "Unknown" bucket for leads with no source
    const unknownLeads = leads.filter((l) => !l.leadSource);
    if (unknownLeads.length > 0) {
      const convertedUnknown = unknownLeads.filter(
        (l) => l.convertedToDealId || l.convertedToAccountId
      ).length;
      const wonUnknown = unknownLeads.filter((l) => {
        if (l.convertedToDealId && wonDealIds.has(l.convertedToDealId)) {
          return true;
        }
        return wonDealsByLeadId.has(l.id);
      }).length;

      const unknownRevenue = unknownLeads.reduce((sum, l) => {
        const deal =
          l.convertedToDealId && wonDealIds.has(l.convertedToDealId)
            ? wonDeals.find((d) => d.id === l.convertedToDealId)
            : wonDealsByLeadId.get(l.id);
        if (deal) {
          return sum + (deal.amount ? Number(deal.amount) : 0);
        }
        return sum;
      }, 0);

      attribution.push({
        source: "Unknown" as LeadSource,
        totalLeads: unknownLeads.length,
        convertedLeads: convertedUnknown,
        wonDeals: wonUnknown,
        conversionRate:
          unknownLeads.length > 0
            ? parseFloat(
                ((convertedUnknown / unknownLeads.length) * 100).toFixed(1)
              )
            : 0,
        winRate:
          unknownLeads.length > 0
            ? parseFloat(
                ((wonUnknown / unknownLeads.length) * 100).toFixed(1)
              )
            : 0,
        wonRevenue: parseFloat(unknownRevenue.toFixed(2)),
      });
    }

    // Sort by total leads descending
    attribution.sort((a, b) => b.totalLeads - a.totalLeads);

    // Summary totals
    const summary = {
      totalLeads: leads.length,
      totalConverted: leads.filter(
        (l) => l.convertedToDealId || l.convertedToAccountId
      ).length,
      totalWon: wonDeals.length,
      totalWonRevenue: parseFloat(
        wonDeals
          .reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0)
          .toFixed(2)
      ),
    };

    // Google Ads summary — derived from existing attribution data
    const googleAdsRow = attribution.find((a) => a.source === "GoogleAds");
    const googleAdsLeads = googleAdsRow?.totalLeads ?? 0;
    const googleAdsConversions = googleAdsRow?.convertedLeads ?? 0;
    const googleAdsWins = googleAdsRow?.wonDeals ?? 0;
    const googleAdsRevenue = googleAdsRow?.wonRevenue ?? 0;

    const googleAds = {
      leads: googleAdsLeads,
      conversions: googleAdsConversions,
      conversionRate: googleAdsLeads > 0
        ? parseFloat(((googleAdsConversions / googleAdsLeads) * 100).toFixed(1))
        : 0,
      wins: googleAdsWins,
      winRate: googleAdsLeads > 0
        ? parseFloat(((googleAdsWins / googleAdsLeads) * 100).toFixed(1))
        : 0,
      revenue: googleAdsRevenue,
      avgDealValue: googleAdsWins > 0
        ? parseFloat((googleAdsRevenue / googleAdsWins).toFixed(2))
        : 0,
      conversionTag: process.env.GOOGLE_ADS_TAG || null,
      conversionLabel: process.env.GOOGLE_ADS_CONVERSION_LABEL || null,
    };

    return NextResponse.json({
      data: {
        attribution,
        summary,
        googleAds,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/attribution error:", error);
    return NextResponse.json(
      { error: "Failed to generate attribution report" },
      { status: 500 }
    );
  }
}
