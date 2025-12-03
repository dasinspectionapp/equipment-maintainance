import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

function Layout() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/signin' || location.pathname === '/signup'

  return (
    <div className="min-h-screen flex flex-col">
      {!isAuthPage && <Header />}
      <main className={`flex-grow ${!isAuthPage && 'pt-20'}`}>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
    </div>
  )
}

export default Layout





























