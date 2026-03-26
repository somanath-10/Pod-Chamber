import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { Sender } from "./components/Sender"
import { LandingPage } from "./LandingPage"
import { Recordings } from "./components/Recordings"
import { EmailRequest } from "./components/EmailRequest"

function App() {

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: '600',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1e293b' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#1e293b' } },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage/>}/>
        <Route path="/sender/:roomId" element={<Sender/>}/>
        <Route path="/recordings" element={<Recordings/>}/>
        <Route path="/request-email" element={<EmailRequest/>}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
