'use client'

export default function Services() {
  const services = [
    {
      title: 'Pay Your Bill',
      description: 'Instant payment through UPI, debit/credit card, net banking & BBPS partners.',
      icon: '💳',
      links: ['Quick Pay', 'View Bill History', 'Generate Duplicate Bill'],
    },
    {
      title: 'New Connection / Name Change',
      description: 'Apply, track status, upload supporting documents and schedule inspections.',
      icon: '📝',
      links: ['LT Connection', 'HT Connection', 'Transfer of Ownership'],
    },
    {
      title: 'Outage & Complaints',
      description: 'Register power supply complaints and receive SMS / WhatsApp updates.',
      icon: '⚡',
      links: ['Register Complaint', 'Track Complaint', 'Feeder Information'],
    },
    {
      title: 'Rooftop Solar',
      description: 'Apply for net metering, subsidy schemes and view empanelled vendors.',
      icon: '☀️',
      links: ['Apply Online', 'Policy Guidelines', 'Vendor List'],
    },
    {
      title: 'Energy Audit & Conservation',
      description: 'Access energy saving tips, guidelines and audit programmes for industries.',
      icon: '📊',
      links: ['Energy Audit', 'Awareness Programmes', 'Download Brochures'],
    },
    {
      title: 'Tenders & Procurement',
      description: 'Participate in BESCOM tenders, download bidding documents and clarifications.',
      icon: '📁',
      links: ['Live Tenders', 'Corrigendum', 'Bid Submission'],
    },
  ]

  return (
    <section id="services" className="bg-white py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#005aa9]">Online Services</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Citizen Services at Your Fingertips</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            BESCOM enables seamless digital interactions for consumers, industries and partners, ensuring convenient access to
            payments, applications, approvals and updates.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf1fb] text-2xl">{service.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{service.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{service.description}</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-[#005aa9]">
                {service.links.map((link) => (
                  <li key={link} className="flex items-center gap-2">
                    <span className="text-lg leading-none text-[#ffb300]">•</span>
                    <span className="font-semibold group-hover:text-[#003b73]">{link}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

