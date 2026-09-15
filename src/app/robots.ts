import type { MetadataRoute } from 'next';

/** A private guest list has no business in a search index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
