import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { BackgroundProvider } from './context/BackgroundContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import NavBar from './components/NavBar.jsx'
import Background from './components/Background.jsx'
import Home from './pages/Home.jsx'
import ChatPage from './pages/ChatPage.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import DeleteAccount from './pages/DeleteAccount.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BackgroundProvider>
        <Background />
        <BrowserRouter>
          <NavBar />
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <ChatPage />
                </RequireAuth>
              }
            />
            <Route
              path="/change-password"
              element={
                <RequireAuth>
                  <ChangePassword />
                </RequireAuth>
              }
            />
            <Route
              path="/delete-account"
              element={
                <RequireAuth>
                  <DeleteAccount />
                </RequireAuth>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </BrowserRouter>
      </BackgroundProvider>
    </AuthProvider>
  )
}
