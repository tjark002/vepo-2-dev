import { PrismaClient } from "@prisma/client";

const prisma = global.prismaVepo || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaVepo) {
    global.prismaVepo = new PrismaClient();
  }
}

export default prisma;
