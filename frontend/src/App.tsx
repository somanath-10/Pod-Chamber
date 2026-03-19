import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Sender } from "./components/Sender"
import { Receiver } from "./components/receiver"
import { LandingPage } from "./LandingPage"
import { Recordings } from "./components/Recordings"

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage/>}/>
        <Route path="/sender/:roomId" element={<Sender/>}/>
        <Route path="/receiver/:roomId" element={<Receiver/>}/>
        <Route path="/recordings" element={<Recordings/>}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
