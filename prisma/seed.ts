import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default users
  const nelsPassword = await bcrypt.hash("changeme123", 12);
  const nickPassword = await bcrypt.hash("changeme123", 12);

  const nels = await prisma.user.upsert({
    where: { email: "nelson@signature-cleans.co.uk" },
    update: {},
    create: {
      email: "nelson@signature-cleans.co.uk",
      passwordHash: nelsPassword,
      name: "Nelson Iseguan",
      role: "admin",
      ionosEmail: "nelson@signature-cleans.co.uk",
    },
  });

  const nick = await prisma.user.upsert({
    where: { email: "nick@signature-cleans.co.uk" },
    update: {},
    create: {
      email: "nick@signature-cleans.co.uk",
      passwordHash: nickPassword,
      name: "Nick Stentiford",
      role: "sales",
      ionosEmail: "nick@signature-cleans.co.uk",
    },
  });

  console.log("Created users:", { nels: nels.id, nick: nick.id });

  // Create protected accounts
  const protectedAccounts = [
    "Porsche Centre Exeter",
    "Bouygues UK",
    "Vistry",
    "Certas Energy",
  ];

  for (const name of protectedAccounts) {
    const existing = await prisma.account.findFirst({ where: { name } });
    if (!existing) {
      await prisma.account.create({
        data: {
          name,
          isProtected: true,
        },
      });
    }
  }

  console.log("Created protected accounts:", protectedAccounts);

  // Create email templates
  const fromAddress = "hello@signature-cleans.co.uk";

  // Sales cadence templates
  const salesCadenceTemplates = [
    {
      sequenceNumber: 1,
      name: "Sales Cadence Step 1 - Introduction",
      subject:
        "Quick thought for {{company_name}} - commercial cleaning efficiency",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I came across {{company_name}} and thought you might find this valuable.</p>

      <p>Many facility managers we work with at Signature Cleans are looking to improve their cleaning standards whilst managing costs effectively. We specialise in commercial cleaning solutions for businesses like yours, with a focus on consistency and reliability.</p>

      <p>Rather than a lengthy pitch, I'd love to share a quick case study from a similar company in your sector to see if it could apply to you.</p>

      <p>Would you have 15 minutes for a brief chat?</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Book a quick call</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Cheers,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 2,
      name: "Sales Cadence Step 2 - Industry Insights",
      subject: "{{company_name}} - industry insights for facility managers",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>Following up on my previous message - I wanted to share some insights we've seen this year in your sector.</p>

      <p>Leading facility managers are increasingly focused on three key areas:</p>
      <ul>
        <li><strong>Consistency:</strong> Maintaining high standards across all shifts and locations</li>
        <li><strong>Accountability:</strong> Clear metrics and regular reporting on cleaning performance</li>
        <li><strong>Efficiency:</strong> Optimising resources without compromising quality</li>
      </ul>

      <p>At Signature Cleans, we've developed solutions that address all three. I've attached a brief report on current industry trends that might interest you.</p>

      <p>Open to grabbing 15 minutes to explore further?</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Check my availability</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 3,
      name: "Sales Cadence Step 3 - Case Study",
      subject: "{{company_name}} - case study: how similar businesses improved their cleaning",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I've been reflecting on {{company_name}} and wanted to share a relevant case study.</p>

      <p style="background: #e8f0f7; padding: 15px; border-left: 4px solid #1f4788; border-radius: 4px;">
        <strong>The Challenge:</strong> A similar-sized business was struggling with inconsistent cleaning standards and wanted better visibility into their facility management.<br><br>
        <strong>The Solution:</strong> Signature Cleans implemented a structured cleaning programme with weekly reporting and quality audits.<br><br>
        <strong>The Result:</strong> 35% improvement in client satisfaction scores and reduced complaints by 80%.
      </p>

      <p>I think we could deliver similar results for {{company_name}}. The first step is simply a conversation to understand your current challenges and goals.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Let's have a chat</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 4,
      name: "Sales Cadence Step 4 - Proposition",
      subject: "{{company_name}} - our proposition for {{contact_name}}",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I wanted to be direct: Signature Cleans specialises in delivering reliable, consistent commercial cleaning for businesses like {{company_name}}.</p>

      <p style="background: #e8f0f7; padding: 15px; border-left: 4px solid #1f4788; border-radius: 4px;">
        <strong>What we offer:</strong>
        <ul>
          <li>Fully managed cleaning programmes tailored to your facility</li>
          <li>Weekly quality reporting and performance metrics</li>
          <li>Dedicated point of contact for continuity</li>
          <li>Flexible scheduling around your operations</li>
        </ul>
      </p>

      <p>Rather than a generic pitch, I'd love to understand {{company_name}}'s specific needs first. That way, if we move forward, it's with a solution built for you.</p>

      <p>Ready to explore?</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Schedule a call</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Thanks,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 5,
      name: "Sales Cadence Step 5 - Pilot Offer",
      subject: "{{company_name}} - special pilot programme offer",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I've been impressed by my interactions with {{company_name}}, and I'd like to make a proposal.</p>

      <p>We're confident in what Signature Cleans can deliver, so we're offering selected companies a <strong>pilot programme</strong> with preferential terms. This gives you the chance to experience our service with minimal risk, and prove the value before a longer commitment.</p>

      <p style="background: #e8f0f7; padding: 15px; border-left: 4px solid #1f4788; border-radius: 4px;">
        <strong>The Pilot includes:</strong>
        <ul>
          <li>4-6 weeks of our standard cleaning programme</li>
          <li>Weekly performance reports</li>
          <li>Special pilot pricing to keep your initial investment modest</li>
          <li>Exit flexibility - no long-term commitment unless you're happy</li>
        </ul>
      </p>

      <p>I'd love to discuss whether this could work for {{company_name}}.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Let's discuss this</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 6,
      name: "Sales Cadence Step 6 - Final Urgency",
      subject: "{{contact_name}}, let's move forward with {{company_name}}",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I've tried reaching out several times because I genuinely believe Signature Cleans can add value to {{company_name}}.</p>

      <p>I don't want to be pushy, so this will be my last message - but I wanted to be clear: the door is still open.</p>

      <p style="background: #ffe8e8; padding: 15px; border-left: 4px solid #d32f2f; border-radius: 4px;">
        <strong>Here's what I suggest:</strong><br>
        A brief 15-minute conversation (no pressure, no sales pitch) where we explore if there's a fit. If not, I'll leave you in peace.
      </p>

      <p>If you'd like to proceed, my calendar is below. Otherwise, feel free to ignore this email.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Book final call</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Looking forward to hearing from you,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
  ];

  // Quote follow-up templates
  const quoteFollowUpTemplates = [
    {
      sequenceNumber: 1,
      name: "Quote Follow-up - 48 Hours",
      subject: "Quick check in on your quote - {{company_name}}",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>Just checking in - did you receive the quote we sent over the other day?</p>

      <p>I know these things sometimes end up in spam or get lost in a busy inbox, so I wanted to make sure it landed safely with you.</p>

      <p>If you have any questions about what we've proposed, I'm happy to jump on a quick call to walk through it.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Schedule a chat</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 2,
      name: "Quote Follow-up - 5 Days",
      subject: "Your {{company_name}} proposal - happy to discuss",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I wanted to follow up on the quote we sent for {{company_name}}'s cleaning programme.</p>

      <p>Are there any questions or concerns I can address? Sometimes people want to discuss specific areas, alternative approaches, or just need clarification on how we'd deliver the service.</p>

      <p>I'm here to help make this as straightforward as possible.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Let's talk</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Cheers,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 3,
      name: "Quote Follow-up - 10 Days",
      subject: "{{company_name}} - one more thing about your proposal",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I notice we haven't heard back on the proposal, and I wanted to check in properly.</p>

      <p>Rather than keep chasing, I'd prefer to understand where things stand:</p>
      <ul>
        <li>Are you still interested in exploring this with Signature Cleans?</li>
        <li>Is there something in the proposal that didn't quite fit?</li>
        <li>Would it help to modify the offer in any way?</li>
      </ul>

      <p>Either way, I appreciate your time, and I'm open to feedback.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Let's discuss</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
  ];

  // Nurture loop templates
  const nurtureLoopTemplates = [
    {
      sequenceNumber: 1,
      name: "Nurture Loop - Monthly Check-in 1",
      subject: "{{company_name}} - staying in touch",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>Just checking in to see how {{company_name}} is getting on.</p>

      <p>I know things are busy, but I wanted to stay connected. If circumstances change or you'd like to revisit a conversation about your facility management, I'm only an email away.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reconnect</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 2,
      name: "Nurture Loop - Monthly Check-in 2",
      subject: "{{company_name}} - new approaches in facility management",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I came across some interesting research on facility management trends this month and thought of {{company_name}}.</p>

      <p>The key insight: businesses that invest in preventative maintenance and regular cleaning audits see significantly better long-term outcomes. It's worth a conversation if you haven't already explored this approach.</p>

      <p>Would be great to catch up briefly.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Schedule time</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
    {
      sequenceNumber: 3,
      name: "Nurture Loop - Monthly Check-in 3",
      subject: "{{contact_name}}, ready to talk cleaning solutions?",
      bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Hi {{contact_name}},</h2>

      <p>I've been reflecting on our previous conversations and {{company_name}}'s situation.</p>

      <p>I genuinely believe that what Signature Cleans offers could make a meaningful difference to your operations. But I don't want to push it unless you're genuinely interested.</p>

      <p>So here's my ask: if you think it's worth exploring, let's set up a proper conversation. If not, no hard feelings - I'll respect that decision.</p>

      <p style="margin-top: 20px;">
        <a href="{{calendly_link}}" style="background: #1f4788; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Let's talk</a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Regards,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
    },
  ];

  // Client welcome template
  const clientWelcomeTemplate = {
    sequenceNumber: 1,
    name: "Client Welcome - Contract Start",
    subject: "Welcome to Signature Cleans, {{company_name}}!",
    bodyHtml: `<html>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #1f4788; margin-bottom: 15px;">Welcome to Signature Cleans, {{company_name}}!</h2>

      <p>We're delighted that you've chosen to partner with us. Your contract is now active, and our team is ready to deliver the high-quality, reliable cleaning service you expect.</p>

      <p style="background: #e8f0f7; padding: 15px; border-left: 4px solid #1f4788; border-radius: 4px;">
        <strong>Here's what comes next:</strong>
        <ul>
          <li><strong>Week 1:</strong> Our team will conduct a full site familiarisation and establish routines</li>
          <li><strong>Ongoing:</strong> Weekly quality reports and performance metrics delivered to your inbox</li>
          <li><strong>Contact:</strong> {{contact_name}} is your primary point of contact - you have direct access</li>
        </ul>
      </p>

      <p>If there's anything you need during this first month, please don't hesitate to reach out. We're committed to making this a smooth partnership.</p>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Welcome aboard,<br>
        <strong>Signature Cleans Team</strong><br>
        hello@signature-cleans.co.uk
      </p>
    </div>
  </body>
</html>`,
  };

  // Seed all templates using findFirst + create (no compound unique exists)
  const allTemplates = [
    ...salesCadenceTemplates.map((t) => ({ ...t, templateType: "sales_cadence" as const })),
    ...quoteFollowUpTemplates.map((t) => ({ ...t, templateType: "quote_follow_up" as const })),
    ...nurtureLoopTemplates.map((t) => ({ ...t, templateType: "nurture_loop" as const })),
  ];

  for (const template of allTemplates) {
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        templateType: template.templateType,
        sequenceNumber: template.sequenceNumber,
      },
    });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: {
          templateType: template.templateType,
          sequenceNumber: template.sequenceNumber,
          name: template.name,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          fromAddress,
          isActive: true,
        },
      });
    }
  }

  // Client welcome template (no sequenceNumber)
  const existingWelcome = await prisma.emailTemplate.findFirst({
    where: { templateType: "client_welcome" },
  });
  if (!existingWelcome) {
    await prisma.emailTemplate.create({
      data: {
        templateType: "client_welcome",
        name: clientWelcomeTemplate.name,
        subject: clientWelcomeTemplate.subject,
        bodyHtml: clientWelcomeTemplate.bodyHtml,
        fromAddress,
        isActive: true,
      },
    });
  }

  console.log("Created email templates (sales cadence, quote follow-up, nurture loop, client welcome)");
  console.log("Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
