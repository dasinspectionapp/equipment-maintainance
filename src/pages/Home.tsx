import ImageCarousel from '../components/ImageCarousel'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Stats from '../components/Stats'
import CTA from '../components/CTA'
import About from '../components/About'

import Announcements from '../components/Announcements'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f1f5fb] pt-[8rem] lg:pt-[10.5rem]">
      <div className="-mt-16 lg:-mt-20">
        <ImageCarousel />
      </div>
      <Announcements />
      <Hero />
      <Features />
      <Stats />
      <About />
      <CTA />
    </main>
  )
}





























