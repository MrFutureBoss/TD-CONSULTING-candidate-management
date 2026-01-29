
import './App.css'
import { Route, Routes } from 'react-router-dom';
import DashboardView from './pages/dashboard/DashboardView';
import HomeLayout from './layouts/HomeLayout';

function App() {

  return (
    <HomeLayout>
      <Routes>
        <Route path="/" element={<DashboardView />} />
      </Routes>
    </HomeLayout>
  )
}

export default App
