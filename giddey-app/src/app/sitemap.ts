import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://playgiddey.com";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/draft`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/how-to-play`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
