import type { MetadataRoute } from "next";

/**
 * The salon's booking page is shared by link, not found by search. Keeping it
 * out of indexes is a privacy choice as much as anything: the service menu
 * and prices are public to anyone holding the link, and there's no reason for
 * them to surface in results alongside the salon's name.
 *
 * Paired with `robots: { index: false }` in app/layout.tsx. robots.txt is a
 * request that well-behaved crawlers honour; the meta tag / X-Robots-Tag is
 * what actually keeps a page out of an index if it gets fetched anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
