'use client'

import { useState } from 'react'

export default function About() {
  const [showBenefits, setShowBenefits] = useState(false)

  const serviceAreas = [
    { label: 'Urban Circles', value: 'Bengaluru North, South, East, West' },
    { label: 'Control Centers', value: '1. Integrated Control Center-1 - HSR Layout\n2. Integrated Control Center-2 -Rajainagar' },
    { label: 'No of Consumers', value: '6 Million+' },
    { label: 'System penetration', value: '11kV Lines' },
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

  const benefits = [
    'Visibility of network parameters in field for better control on distribution network by SCADA and advance DMS applications in the system',
    'Increased energy sales and revenue due to reduction in downtime for restoration of power supply &ensuring reliable power.',
    'Improved quality of service management and customer satisfaction.',
    'Better network Management and control over Capex expenditure.',
    'Improved efficiency in distribution network operation results in lower costs.',
  ]

  const packages = [
    {
      slNo: 1,
      pkg: 'PMC',
      awardedLot: 'PMC',
      details: 'Consultancy services for design, tendering, implementation and capacity building',
      contractor: 'M/s KEMA, USA & M/s CPRI, B\'lore'
    },
    {
      slNo: 2,
      pkg: 'I',
      awardedLot: 'Package-I',
      details: 'Establishing 2nos of DAS Master stations, Control Centre Facilities with all IT equipments and Communications System.',
      contractor: 'M/s EFACEC Engenharia-e-Systemas, Portugal'
    },
    {
      slNo: 3,
      pkg: 'I',
      awardedLot: 'Package-IA',
      details: 'Construction of BICC-1 Control Centre building at HSR Layout',
      contractor: 'M/s Amrutha Constructions Pvt Ltd, B\'lore & M/s Mithuna Construction Pvt. Ltd, B\'lore'
    },
    {
      slNo: 4,
      pkg: 'I',
      awardedLot: 'Package-IB',
      details: 'Construction of BICC-2 Control Centre building at Rajajinagar',
      contractor: 'M/s Hombale Construction & estates Pvt ltd, B\'lore'
    },
    {
      slNo: 5,
      pkg: 'II',
      awardedLot: 'Package-IIA',
      details: 'Supply, Installation, commissioning and Integration of Remote terminal units for interfacing with control centre and DAS RMU',
      contractor: 'M/s ABB, ltd., B\'lore'
    },
    {
      slNo: 6,
      pkg: 'II',
      awardedLot: 'Package-IIB',
      details: 'Supply, Installation, commissioning and Integration of Remote terminal units for interfacing with control centre and DAS RMU',
      contractor: 'M/s CGL,Gurgaon'
    },
    {
      slNo: 7,
      pkg: 'II',
      awardedLot: 'Package-IIC',
      details: 'Supply, Installation, commissioning and Integration of Remote terminal units for interfacing with control centre and DAS RMU',
      contractor: 'M/s EFACEC Enganharia-e-Systemas, Portugal'
    },
    {
      slNo: 8,
      pkg: 'III',
      awardedLot: 'Package-IIIA',
      details: 'Supply, Installation, commissioning and Integration of LRS/LBS with control centre',
      contractor: 'M/s P&C Technologies, S. Korea'
    },
    {
      slNo: 9,
      pkg: 'III',
      awardedLot: 'Package-IIIB',
      details: 'Supply, Installation, commissioning and Integration of LRS/LBS with control centre',
      contractor: 'M/s ENTEC Electric Co. Ltd, S. Korea'
    },
    {
      slNo: 10,
      pkg: 'IV',
      awardedLot: 'Package-IVA',
      details: 'Supply, Installation, commissioning and Integration of DAS RMU with control center',
      contractor: 'M/s Schneider Electric Pvt ltd, B\'lore'
    },
    {
      slNo: 11,
      pkg: 'IV',
      awardedLot: 'Package-IVB',
      details: 'Supply, Installation, commissioning and Integration of DAS RMU with control center',
      contractor: 'M/s CGL, Nasik'
    },
    {
      slNo: 12,
      pkg: 'IV',
      awardedLot: 'Package-IVC',
      details: 'Supply, Installation, commissioning and Integration of DAS RMU with control center',
      contractor: 'M/s Siemens ltd, Chennai'
    },
    {
      slNo: 13,
      pkg: 'V',
      awardedLot: 'Package-VA',
      details: '',
      contractor: 'M/s Eswari Electric Pvt Ltd, Chennai'
    },
    {
      slNo: 14,
      pkg: 'V',
      awardedLot: 'Package-VB',
      details: '',
      contractor: 'M/s Schneider Infrastructure ltd, Vadodara'
    },
    {
      slNo: 15,
      pkg: 'VI',
      awardedLot: 'Package-VI',
      details: 'Construction of Overhead lines (HT AB Cable, coyote conductor, spun poles and other accessories) for enhancing OH lines infrastructure in DAS project',
      contractor: 'M/s L&T Ltd, Chennai'
    },
    {
      slNo: 16,
      pkg: 'VII',
      awardedLot: 'Package-VII',
      details: 'Construction of Underground cables for enhancing UG Distribution lines infrastructure in DAS project',
      contractor: 'M/s L&T Ltd, Chennai'
    },
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

            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => setShowBenefits(!showBenefits)}
                className="rounded-lg bg-[#005aa9] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#003b73] focus:outline-none focus:ring-2 focus:ring-[#005aa9] focus:ring-offset-2"
              >
                Know More
              </button>
            </div>

            {showBenefits && (
              <>
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Benefits of DAS</h3>
                  <ul className="mt-4 space-y-3">
                    {benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ffb300]" />
                        <span className="text-sm text-slate-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Details of Construction of Packages</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#005aa9] text-white">
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Sl No.</th>
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Pkg</th>
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Awarded Lot</th>
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Brief Details of Package contract</th>
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Contractor Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.map((pkg) => (
                          <tr key={pkg.slNo} className="bg-white hover:bg-slate-50">
                            <td className="border border-slate-300 px-3 py-2 text-slate-700">{pkg.slNo}</td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700">{pkg.pkg}</td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700">{pkg.awardedLot}</td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700">{pkg.details || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700">{pkg.contractor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
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
                    <p className="mt-2 text-sm font-semibold text-slate-800 whitespace-pre-line">{area.value}</p>
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
