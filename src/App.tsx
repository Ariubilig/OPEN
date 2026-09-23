import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import About from './routes/About'
import Feed from './routes/Feed'
import NotFound from './routes/NotFound'
import Story from './routes/Story'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="story/:id" element={<Story />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
