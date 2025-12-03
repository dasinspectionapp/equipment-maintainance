'use client'

const quickLinks = [
  { label: 'Consumer Charter', href: '#about' },
  { label: 'Tariff Orders', href: '#updates' },
  { label: 'Tenders', href: '#updates' },
  { label: 'RTI Disclosure', href: '#about' },
]

const contactInfo = [
  { title: 'Corporate Office', detail: 'K.R. Circle, Bengaluru – 560001' },
  { title: 'Helpline', detail: '1912 (24x7) | WhatsApp: +91 87229 84207' },
  { title: 'Email', detail: 'helpdesk@bescom.co.in' },
]

const resources = [
  'Renewable Energy Initiatives',
  'Energy Conservation Awareness',
  'Investor Relations',
  'Customer Grievance Redressal',
]

export default function Footer() {
  return (
    <footer className="bg-[#002a54] text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">BESCOM</div>
            <h3 className="mt-3 text-xl font-bold">Bangalore Electricity Supply Company Limited</h3>
            <p className="mt-4 text-sm text-white/80">
              A Government of Karnataka undertaking responsible for power distribution across Bengaluru city and adjacent districts.
              BESCOM is committed to delivering reliable power, strengthening infrastructure and enabling customer-centric digital
              services.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">Quick Links</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-white/80">Resources</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {resources.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-3">
          {contactInfo.map((info) => (
            <div key={info.title} className="text-sm text-white/80">
              <p className="font-semibold text-white">{info.title}</p>
              <p className="mt-1">{info.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} BESCOM. Government of Karnataka.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white">
              Terms of Use
            </a>
            <a href="#" className="hover:text-white">
              Sitemap
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}





























