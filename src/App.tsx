
import './App.css'
import { Route, Routes } from 'react-router-dom';
import DashboardView from './pages/dashboard/DashboardView';
import HomeLayout from './layouts/HomeLayout';
import LoginView from './pages/login/LoginView';
import RegisterView from './pages/register/RegisterView';

function App() {

  return (
    <HomeLayout>
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/login" element={<LoginView/>} />
        <Route path="/register" element={<RegisterView/>} />
      </Routes>
    </HomeLayout>
  )
}

export default App
