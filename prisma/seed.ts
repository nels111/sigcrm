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
