import { useEffect } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface MarketingSEOProps {
  title: string;
  titleAm?: string;
  description: string;
  descriptionAm?: string;
  path?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export function MarketingSEO({
  title,
  titleAm,
  description,
  descriptionAm,
  path = '',
  canonicalUrl,
  ogImage = '/kushinaPOStrace.png',
}: MarketingSEOProps) {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const fullTitle = `${isAm && titleAm ? titleAm : title} | KushinaPOS`;
  const metaDesc = isAm && descriptionAm ? descriptionAm : description;
  const canonicalHref = canonicalUrl
    ? (canonicalUrl.startsWith('http') ? canonicalUrl : `https://kushinapos.com${canonicalUrl.startsWith('/') ? '' : '/'}${canonicalUrl}`)
    : `https://kushinapos.com${path}`;

  useEffect(() => {
    // 1. Update Title
    document.title = fullTitle;

    // 2. Helper to set or create meta tag
    const setMeta = (nameOrProperty: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, nameOrProperty);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    setMeta('description', metaDesc);
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', metaDesc, true);
    setMeta('og:url', canonicalHref, true);
    setMeta('og:type', 'website', true);
    setMeta('og:image', ogImage, true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', metaDesc);

    // 3. Update canonical link
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalHref);
  }, [fullTitle, metaDesc, canonicalHref, ogImage]);

  return null;
}

export default MarketingSEO;
