import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/leads/[id]/convert — Convert a lead to Account + Contact + Deal
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Fetch the lead
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    if (lead.deletedAt) {
      return NextResponse.json(
        { error: "Cannot convert a deleted lead" },
        { status: 400 }
      );
    }

    if (lead.convertedToAccountId || lead.convertedToContactId || lead.convertedToDealId) {
      return NextResponse.json(
        { error: "Lead has already been converted" },
        { status: 400 }
      );
    }

    // Run conversion inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Account from lead company info
      const account = await tx.account.create({
        data: {
          name: lead.companyName,
          address: lead.address,
          industry: lead.industry,
          phone: lead.contactPhone,
        },
      });

      // 2. Create Contact from lead contact info, linked to the new account
      // Split contactName into first and last name
      const nameParts = lead.contactName.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : undefined;
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

      const contact = await tx.contact.create({
        data: {
          accountId: account.id,
          firstName: firstName || null,
          lastName,
          email: lead.contactEmail,
          phone: lead.contactPhone,
          isPrimary: true,
        },
      });

      // 3. Create Deal linked to account, contact, and lead
      const dealName = body.dealName || `${lead.companyName} - New Deal`;

      const deal = await tx.deal.create({
        data: {
          name: dealName,
          accountId: account.id,
          contactId: contact.id,
          leadId: lead.id,
          stage: "NewLead",
          assignedTo: lead.assignedTo,
          amount: body.amount || null,
          dealType: body.dealType || "recurring",
          notes: lead.notes,
        },
      });

      // 4. Update lead with converted references
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          convertedToAccountId: account.id,
          convertedToContactId: contact.id,
          convertedToDealId: deal.id,
          leadStatus: "OngoingCustomer",
        },
      });

      return { account, contact, deal, lead: updatedLead };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads/[id]/convert error:", error);
    return NextResponse.json(
      { error: "Failed to convert lead" },
      { status: 500 }
    );
  }
}
