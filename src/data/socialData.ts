import type { SocialProfile } from "./types";

export const socialProfiles: SocialProfile[] = [
  {
    entityId: "p1",
    platform: "Instagram",
    handle: "@arvind.m85",
    displayName: "Arvind Mehta",
    followers: 812,
    lastScanned: "2026-08-27 22:10",
    posts: [
      {
        id: "sp1",
        platform: "Instagram",
        handle: "@arvind.m85",
        postedOn: "2026-08-08",
        content: "Late night at the yard, big week ahead. 💪 #grind",
        flagReason: "Geotagged within 300m of Warehouse 7, GT Road Depot at 23:40 IST.",
        location: "Panipat, Haryana",
      },
      {
        id: "sp2",
        platform: "Instagram",
        handle: "@arvind.m85",
        postedOn: "2026-06-19",
        content: "Good catching up with an old friend today.",
        flagReason: "Tagged alongside @farhan.q, matching Alert a5's flagged association.",
        location: "Panipat, Haryana",
      },
    ],
  },
  {
    entityId: "p3",
    platform: "X",
    handle: "@ritika_sethi_",
    displayName: "Ritika Sethi",
    followers: 2140,
    lastScanned: "2026-08-26 19:05",
    posts: [
      {
        id: "sp3",
        platform: "X",
        handle: "@ritika_sethi_",
        postedOn: "2026-05-30",
        content: "Excited to announce Zenith Traders' new office space in Nariman Point!",
        flagReason: "References registered office shared with Nova Freight Solutions (Alert a2).",
        location: "Mumbai, Maharashtra",
      },
    ],
  },
  {
    entityId: "p7",
    platform: "Facebook",
    handle: "vikram.oberoi.90",
    displayName: "Vikram Oberoi",
    followers: 356,
    lastScanned: "2026-08-25 08:40",
    posts: [
      {
        id: "sp4",
        platform: "Facebook",
        handle: "vikram.oberoi.90",
        postedOn: "2026-05-22",
        content: "Great connecting with old colleagues at the finance meetup.",
        flagReason: "Mutual endorsement with Meera Kulkarni, matching CDR association pattern.",
        location: "Mumbai, Maharashtra",
      },
    ],
  },
];

export function getSocialProfile(entityId: string): SocialProfile | undefined {
  return socialProfiles.find((s) => s.entityId === entityId);
}
