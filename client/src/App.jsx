import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Board from "./Board";

function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Collaborative Whiteboard</h1>
      <p>Create or join a board.</p>

      <Link to="/board/test">
        <button>Open Test Board</button>
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board/:id" element={<Board />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;