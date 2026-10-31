import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const coupleConfig = await prisma.coupleConfig.findFirst({ take: 1 });

  const membership = await prisma.coupleMember.findUnique({
    where: { userId: session.user.id },
    select: {
      couple: {
        select: {
          members: {
            where: { userId: { not: session.user.id } },
            select: { user: { select: { name: true, email: true, image: true } } },
          },
        },
      },
    },
  });
  const partnerUser = membership?.couple?.members?.[0]?.user ?? null;

  return (
    <ProfileContent
      user={{
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        role: (session.user as { role?: string }).role ?? "PARTNER",
      }}
      partner={
        partnerUser
          ? {
              name: partnerUser.name ?? "",
              email: partnerUser.email,
              image: partnerUser.image ?? null,
            }
          : null
      }
      couple={
        coupleConfig
          ? {
              name1: coupleConfig.name1,
              name2: coupleConfig.name2,
              anniversaryDate: coupleConfig.anniversaryDate.toISOString(),
              birthDate1: coupleConfig.birthDate1?.toISOString() ?? null,
              birthDate2: coupleConfig.birthDate2?.toISOString() ?? null,
              tagline: coupleConfig.tagline,
            }
          : null
      }
    />
  );
}
