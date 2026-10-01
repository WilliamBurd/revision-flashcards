import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AddCard from './pages/AddCard'
import Browse from './pages/Browse'
import EditCard from './pages/EditCard'
import Home from './pages/Home'
import Review from './pages/Review'
import SetPage from './pages/SetPage'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Login from './pages/Login'
import { useAccount } from './sync/AccountProvider'

export default function App() {
  const { configured, loading, session } = useAccount()
  if (loading) return null
  // With a cloud account set up, everyone signs in once per device.
  if (configured && !session) return <Login />

  return (
    <Routes>
      {/* Review is full screen, without the navigation. */}
      <Route path="/review" element={<Review />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<AddCard />} />
        <Route path="/sets/:id" element={<SetPage />} />
        <Route path="/notes/:id/edit" element={<EditCard />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
