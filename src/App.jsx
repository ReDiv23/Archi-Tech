import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import EditorCanvas from './components/EditorCanvas';
import ViewOnly from "./pages/ViewOnly";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor" element={<EditorCanvas />} />
          <Route path="/editor/:id" element={<EditorCanvas />} />
          <Route path="/view/:shareId" element={<ViewOnly />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;