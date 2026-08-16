import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";

import "./App.css";
import CreateRoom from "./pages/CreateRoom";
import Room from "./pages/Room";
import Results from "./pages/Results";
const API_URL = import.meta.env.VITE_API_URL;

function Home() {
  const [backendStatus, setBackendStatus] =
    useState("Checking...");

  const [roomCode, setRoomCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "healthy") {
          setBackendStatus("Connected");
        } else {
          setBackendStatus("Backend offline");
        }
      })
      .catch(() => {
        setBackendStatus("Backend offline");
      });
  }, []);

  const joinRoom = async () => {
    if (!joinName.trim()) {
      setJoinError("Please enter your name.");
      return;
    }

    if (!roomCode.trim()) {
      setJoinError("Please enter a room code.");
      return;
    }

    setJoining(true);
    setJoinError("");

    const normalizedCode = roomCode.trim().toUpperCase();
    const normalizedName = joinName.trim();

    try {
      const response = await fetch(
        `${API_URL}/rooms/${normalizedCode}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        setJoinError(data.error);
        return;
      }

      localStorage.setItem(
        "movieMatchUser",
        normalizedName
      );

      navigate(`/room/${normalizedCode}`);
    } catch {
      setJoinError(
        "Could not connect to the server."
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">🎬 MovieMatch</div>

        <div className="backend-status">
          <span
            className={
              backendStatus === "Connected"
                ? "status-dot connected"
                : "status-dot"
            }
          />
          {backendStatus}
        </div>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <div className="badge">
            🍿 Movie night, without the arguments
          </div>

          <h1>
            Find a movie
            <span>everyone wants to watch.</span>
          </h1>

          <p className="subtitle">
            Create a room, invite your friends, and swipe
            through movies together. We'll find the
            perfect match.
          </p>

          <div className="actions">
            <button
              className="primary-button"
              onClick={() => navigate("/create")}
            >
              Create a Room
            </button>

            <div className="join-section">
              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) =>
                  setJoinName(e.target.value)
                }
              />

              <input
                type="text"
                placeholder="Room code"
                value={roomCode}
                onChange={(e) =>
                  setRoomCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                  )
                }
                maxLength={5}
              />

              <button
                className="secondary-button"
                onClick={joinRoom}
                disabled={joining}
              >
                {joining ? "Joining..." : "Join Room"}
              </button>
            </div>

            {joinError && (
              <p className="error-message">
                {joinError}
              </p>
            )}
          </div>
        </div>

        <div className="movie-card-container">
          <div className="movie-card">
            <div className="movie-poster">
              <div className="poster-content">
                <span>🎬</span>
                <h2>Movie Night</h2>
                <p>Everyone's choice.</p>
              </div>
            </div>

            <div className="movie-info">
              <div>
                <h3>Tonight's Pick</h3>
                <p>Swipe right if you'd watch it.</p>
              </div>

              <div className="swipe-buttons">
                <button className="nope">✕</button>
                <button className="like">♥</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route
          path="/room/:roomCode"
          element={<Room />}
        />
        <Route
          path="/room/:roomCode/results"
          element={<Results />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
