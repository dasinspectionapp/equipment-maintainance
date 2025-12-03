'use client';

const notices = [
  {
    title: 'Scheduled outage for Bengaluru North Circle on 15 Nov 2025',
    date: '12 Nov 2025',
    category: 'Service Advisory',
  },
  {
    title: 'Call for applications: Rooftop solar net metering programme Phase IV',
    date: '11 Nov 2025',
    category: 'Renewable',
  },
  {
    title: 'Consumer interaction meet for Indiranagar Sub-Division – 18 Nov 2025',
    date: '10 Nov 2025',
    category: 'Engagement',
  },
];

const tenders = [
  {
    title: 'Procurement of smart meters for urban feeders – tender ID BESCOM/SM/2025-26/01',
    closing: '20 Nov 2025',
  },
  {
    title: 'Turnkey execution of 11kV underground cabling works in RR Nagar Division',
    closing: '25 Nov 2025',
  },
  {
    title: 'Empanelment of EV charging infrastructure partners across BESCOM limits',
    closing: '30 Nov 2025',
  },
];

const highlights = [
  {
    title: 'Outage Alerts',
    description: 'Receive planned, unplanned outage information for your feeder.',
    linkText: 'Sign up for alerts',
    href: '#contact',
  },
];

export default function Announcements() {
  return (
    <section id="updates" className="bg-[#f5f7fb] py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#005aa9]">Updates</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Latest from BESCOM</h2>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Public Notices & Advisories</h3>
                <a href="#updates" className="text-xs font-semibold uppercase tracking-wide text-[#005aa9]">
                  View all
                </a>
              </div>
              <ul className="mt-4 space-y-4">
                {notices.map((notice) => (
                  <li key={notice.title} className="flex flex-col gap-1 rounded-xl bg-[#f6f9ff] p-4 ring-1 ring-[#d8e5ff] transition hover:bg-white hover:shadow">
                    <div className="flex items-center justify-between text-xs text-[#005aa9]">
                      <span className="font-semibold uppercase tracking-wide">{notice.category}</span>
                      <span>{notice.date}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{notice.title}</p>
                    <button className="self-start text-xs font-semibold text-[#005aa9] hover:text-[#003b73]">
                      Read details →
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Tender Highlights</h3>
                <a href="#updates" className="text-xs font-semibold uppercase tracking-wide text-[#005aa9]">
                  All tenders
                </a>
              </div>
              <ul className="mt-4 space-y-4">
                {tenders.map((tender) => (
                  <li key={tender.title} className="rounded-xl border border-dashed border-[#c2d6ff] bg-[#fdfefe] p-4">
                    <p className="text-sm font-semibold text-slate-800">{tender.title}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                      Closing on <span className="font-semibold text-[#005aa9]">{tender.closing}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">{highlight.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{highlight.description}</p>
                <a href={highlight.href} className="mt-4 inline-flex items-center text-sm font-semibold text-[#005aa9] hover:text-[#003b73]">
                  {highlight.linkText}
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

