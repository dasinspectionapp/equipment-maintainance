'use client';

const stats = [
  { value: '6.01 M+', label: 'Consumers Served', detail: 'Across BMAZ Area' },
  { value: '14', label: 'No of O & M Divisions', detail: 'Modernised with remote monitoring' },
  { value: '114', label: 'No. of sUB sTATIONS', detail: 'Integrated With SCADA' },
  { value: '1914+', label: 'Feeder Lines', detail: 'Strengthened with automation initiatives' },
];

export default function Stats() {
  return (
    <section className="bg-gradient-to-r from-[#003b73] to-[#005aa9] py-16 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">BESCOM at a glance</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Powering growth with scale and reliability</h2>
          </div>
          <a href="#updates" className="text-sm font-semibold text-white/80 hover:text-white">
            Download annual report →
          </a>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
              <p className="text-3xl font-extrabold text-[#ffda6a]">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/90">{stat.label}</p>
              <p className="mt-3 text-sm text-white/80">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


