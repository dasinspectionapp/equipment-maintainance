'use client';

const featureGroups = [
  {
    title: 'Consumer Centric Governance',
    description:
      'Dedicated grievance cells, call centres, nodal officers and social media handles to offer responsive support.',
    icon: '🤝',
  },
  {
    title: 'Smart & Digital Utility',
    description:
      'Roll-out of smart metering, GIS mapping, SCADA and data analytics to optimise power distribution.',
    icon: '🛰️',
  },
  {
    title: 'Sustainable Energy Push',
    description:
      'Driving rooftop solar, EV charging network, and energy conservation awareness across consumer segments.',
    icon: '🌱',
  },
  {
    title: 'Transparent Operations',
    description:
      'Real-time publication of outages, tenders, supply status and RTI disclosures for public accountability.',
    icon: '🔍',
  },
  {
    title: 'Network Strengthening',
    description:
      'Continuous investment in feeders, transformers, underground cabling and substation modernisation.',
    icon: '🏗️',
  },
  {
    title: 'Capacity Building',
    description:
      'Training programmes and safety initiatives for field staff to ensure high standards of service delivery.',
    icon: '🎓',
  },
];

export default function Features() {
  return (
    <section className="bg-[#f5f7fb] py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#005aa9]">Focus Areas</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Building a Future-Ready Utility</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            BESCOM is transforming the power distribution landscape through technology adoption, sustainability and
            citizen-first programmes backed by robust infrastructure.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featureGroups.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf1fb] text-2xl">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


