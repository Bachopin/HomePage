import { MetadataRoute } from 'next';
import { METADATA } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${METADATA.siteUrl}/sitemap.xml`,
  };
}