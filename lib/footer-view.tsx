import { Sparkles, MapPin, Phone, Mail } from 'lucide-react';
import FooterSocials from '@/app/footer-socials';
import { CookieChoice } from '@/app/public-client';
export default function Footer({
  settings,
  lang,
  links,
  policies,
}: {
  settings: any;
  lang: string;
  links: any[];
  policies: any[];
}) {
  const en = lang === 'en',
    f = settings.footer,
    local = (obj: any, k: string) => obj?.[k + (en ? 'En' : 'Zh')] || '';
  const brand = local(settings, 'name'),
    description = local(f, 'description') || local(settings, 'description');
  const nav = f
    ? f.navIds
        .map((id: string) => links.find((n) => n.id === id))
        .filter(Boolean)
    : links;
  const fallback = [
    {
      id: 'articles',
      href: `/${lang}/articles`,
      labelZh: '文章',
      labelEn: 'Journal',
    },
    {
      id: 'products',
      href: `/${lang}/products`,
      labelZh: '商品',
      labelEn: 'Products',
    },
    {
      id: 'contact',
      href: `/${lang}/contact`,
      labelZh: '联系我们',
      labelEn: 'Contact',
    },
  ];
  const navigation = f ? nav : nav.length ? nav : fallback;
  const policyRows = (f?.policyKinds || ['terms', 'privacy', 'cookies'])
    .map((kind: string) => policies.find((p) => p.kind === kind))
    .filter(Boolean);
  const company = local(f, 'company'),
    address = local(f, 'address'),
    phone = f?.phone,
    email = f?.email || settings.contactEmail;
  const socials = f?.socials?.filter((s: any) => s.enabled) || [];
  const copyright = `© ${f?.year || new Date().getFullYear()} ${local(f, 'copyright') || brand}`;
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <section className="footer-brand-block">
            <a className="footer-brand" href={`/${lang}`}>
              {f?.logoId ? (
                <img src={'/api/media/' + f.logoId} alt={brand} />
              ) : (
                <Sparkles size={23} aria-hidden="true" />
              )}
              <span>{brand}</span>
            </a>
            {description && <p>{description}</p>}
          </section>
          {navigation.length > 0 && (
            <section>
              <h2>{en ? 'Explore' : '快捷导航'}</h2>
              <nav
                className="footer-links"
                aria-label={en ? 'Footer navigation' : '底部导航'}
              >
                {navigation.map((n: any) => (
                  <a key={n.id} href={n.href}>
                    {en ? n.labelEn : n.labelZh}
                  </a>
                ))}
              </nav>
            </section>
          )}
          {(company || address || phone || email) && (
            <section className="footer-contact">
              <h2>{en ? 'Contact us' : '联系我们'}</h2>
              {company && <p className="footer-company">{company}</p>}
              {address && (
                <p>
                  <MapPin size={16} aria-hidden="true" />
                  <span>{address}</span>
                </p>
              )}
              {phone && (
                <a href={'tel:' + phone.replace(/[ ()]/g, '')}>
                  <Phone size={16} aria-hidden="true" />
                  <span>{phone}</span>
                </a>
              )}
              {email && (
                <a href={'mailto:' + email}>
                  <Mail size={16} aria-hidden="true" />
                  <span>{email}</span>
                </a>
              )}
            </section>
          )}
          {socials.length > 0 && (
            <section>
              <h2>{en ? 'Connect with us' : '关注我们'}</h2>
              <FooterSocials items={socials} en={en} />
            </section>
          )}
        </div>
        <div className="footer-bottom">
          <div className="footer-policy-row">
            {policyRows.map((p: any) => (
              <a key={p.kind} href={`/${lang}/policies/${p.kind}`}>
                {en ? p.titleEn : p.titleZh}
              </a>
            ))}
            <CookieChoice
              en={en}
              hasPolicy={policies.some((p) => p.kind === 'cookies')}
            />
          </div>
          <div className="footer-legal-row">
            {f?.copyrightUrl ? (
              <a href={f.copyrightUrl} target="_blank" rel="noreferrer">
                {copyright}
              </a>
            ) : (
              <span>{copyright}</span>
            )}
            <div className="footer-registrations">
              {f?.registrations?.map((r: any, i: number) => (
                <a key={i} href={r.url} target="_blank" rel="noreferrer">
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
