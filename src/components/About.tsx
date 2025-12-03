'use client'

export default function About() {
  const serviceAreas = [
    { label: 'Urban Circles', value: 'Bengaluru North, South, East, West' },
    { label: 'Control Centers', value: '1. BICC1- HSR Layout 2. BICC2-Rajainagar' },
    { label: 'No of Consumers', value: '6 Million+' },
    { label: 'System penetration', value: 'Trunk Lines' },
  ]

  const commitments = [
    'To automate Distribution network for remote monitoring, supervisory control and operation of the 11kV network in Bangalore City.',
    'Providing assured quality and reliability of power supply.',
    'To improve quality of service management and customers satisfaction.',
    'To avoid loss of time for fault location and restoration due to manual operation.',
    'To integrate all IT related activities.',
    'To improve Network Control management.',
    'Optimum power factor, reduction in losses.',
    
  ]

  return (
    <section id="about" className="bg-white py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#005aa9]">About DAS</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              Distribution Automation System – DAS
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
            The DAS project in BESCOM is to automate the 11kV Distribution network for remote monitoring, control and operation of the 11kV network in the Bangalore City.
            The implementation of Distribution Automation in the Bangalore City will enhance reliability and quality of power supply.
            The revenue realization will improve due to the reduction in down time for fault location and quick restoration achieved through 
            the Distribution Automation system comprising of SCADA and Advance DMS application software.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
              <h3 className="text-lg font-semibold text-slate-900">Objectives</h3>
              <ul className="mt-4 space-y-3">
                {commitments.map((commitment) => (
                  <li key={commitment} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ffb300]" />
                    <span className="text-sm text-slate-600">{commitment}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#005aa9] to-[#003b73] p-6 text-white shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Vision</p>
              <p className="mt-2 text-lg font-semibold leading-7">
                To be a benchmark distribution utility delivering safe, reliable, affordable electricity and sustainable energy
                solutions to every consumer.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/70">Mission</p>
              <p className="mt-2 text-sm text-white/90">
                Enhance customer satisfaction through technology-enabled services, strengthen network resilience, and champion energy
                conservation through collaborative partnerships.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Service Footprint</h3>
              <div className="mt-4 grid gap-4">
                {serviceAreas.map((area) => (
                  <div key={area.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#005aa9]">{area.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{area.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
