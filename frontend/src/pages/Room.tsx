import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MovieCard, { Movie } from "../components/MovieCard";
const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = API_URL.replace("https://", "wss://");
interface Member {
  name: string;
  is_host: boolean;
}

interface RoomData {
  code: string;
  genre: string;
  members: Member[];
  status: string;
  movies?: Movie[];
}

interface ProgressData {
  room_code: string;
  total_movies: number;
  progress: Record<string, number>;
  all_finished: boolean;
}

function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [movieIndex, setMovieIndex] = useState(0);
  const [moviesLoading, setMoviesLoading] = useState(true);

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  // ==================================================
  // CURRENT USER
  // ==================================================

  useEffect(() => {
    const savedUser = localStorage.getItem("movieMatchUser");

    if (savedUser) {
      setCurrentUser(savedUser);
    }
  }, []);

  // ==================================================
  // FETCH ROOM
  // ==================================================

  useEffect(() => {
    if (!roomCode) return;

    const fetchRoom = async () => {
      try {
        const response = await fetch(
          `${API_URL}/rooms/${roomCode}`
        );

        const data = await response.json();

        if (data.error) {
          setError("Room not found.");
          return;
        }

        setRoom(data);
      } catch {
        setError("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode]);

  // ==================================================
  // FETCH MOVIES
  // ==================================================

  useEffect(() => {
    if (!roomCode) return;

    const fetchMovies = async () => {
      try {
        setMoviesLoading(true);

        const response = await fetch(
          `${API_URL}/rooms/${roomCode}/movies`
        );

        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setMovies(data.movies || []);
        setMovieIndex(0);
      } catch (err) {
        console.error("Could not fetch movies:", err);
        setError("Could not load movies.");
      } finally {
        setMoviesLoading(false);
      }
    };

    fetchMovies();
  }, [roomCode]);

  // ==================================================
  // FETCH INITIAL PROGRESS
  // ==================================================

  useEffect(() => {
    if (!roomCode) return;

    const fetchProgress = async () => {
      try {
        const response = await fetch(
          `${API_URL}/rooms/${roomCode}/progress`
        );

        const data = await response.json();

        if (!data.error) {
          setProgress(data);
        }
      } catch (err) {
        console.error("Could not fetch progress:", err);
      }
    };

    fetchProgress();
  }, [roomCode]);

  // ==================================================
  // WEBSOCKET
  // ==================================================

  useEffect(() => {
    if (!roomCode) return;

    const socket = new WebSocket(
      `${WS_URL}/ws/${roomCode}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      console.log("WebSocket message:", data);

      if (
        data.type === "room_state" ||
        data.type === "room_updated" ||
        data.type === "movies_ready"
      ) {
        setRoom(data.room);
      }

      if (data.type === "progress_updated") {
        setProgress(data.progress);
      }

      if (data.type === "all_finished") {
        setProgress(data.progress);
        navigate(`/room/${roomCode}/results`);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, navigate]);

  // ==================================================
  // SAVE SWIPE
  // ==================================================

  const submitSwipe = async (vote: "like" | "pass") => {
    if (!roomCode || !currentUser || submitting) return;

    if (movieIndex >= movies.length) return;

    const movie = movies[movieIndex];

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_URL}/rooms/${roomCode}/swipe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: currentUser,
            movie_id: movie.id,
            vote,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        console.error("Swipe error:", data.error);
        return;
      }

      setProgress({
        room_code: data.room_code,
        total_movies: data.total_movies,
        progress: data.progress,
        all_finished: data.all_finished,
      });

      setMovieIndex((previous) => previous + 1);

      if (data.all_finished) {
        navigate(`/room/${roomCode}/results`);
      }
    } catch (err) {
      console.error("Could not save swipe:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = () => submitSwipe("like");
  const handlePass = () => submitSwipe("pass");

  // ==================================================
  // COPY ROOM CODE
  // ==================================================

  const copyRoomCode = async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      alert("Room code copied!");
    } catch {
      alert(`Room code: ${roomCode}`);
    }
  };

  // ==================================================
  // LOADING / ERROR
  // ==================================================

  if (loading) {
    return (
      <div className="room-page">
        <div className="room-loading">Loading your room...</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="room-page">
        <div className="room-error">
          <h1>Room not found</h1>
          <p>{error || "This room doesn't exist."}</p>
          <button
            className="create-button"
            onClick={() => navigate("/")}
          >
            Back to MovieMatch
          </button>
        </div>
      </div>
    );
  }

  const myProgress = progress?.progress?.[currentUser] || 0;
  const totalMovies = progress?.total_movies || movies.length || 0;
  const progressPercent =
    totalMovies > 0
      ? Math.min((myProgress / totalMovies) * 100, 100)
      : 0;

  const finishedMySwipes = movieIndex >= movies.length;

  return (
    <div className="room-page">
      <div className="room-container">

        {/* HEADER */}
        <div className="room-header">
          <button
            className="back-button"
            onClick={() => navigate("/")}
          >
            ← Leave Room
          </button>

          <div className="logo">🎬 MovieMatch</div>

          <div className="room-live-status">
            <span
              className={
                connected
                  ? "status-dot connected"
                  : "status-dot"
              }
            />
            {connected ? "Live" : "Connecting..."}
          </div>
        </div>

        {/* MAIN */}
        <div className="room-main">

          <div className="room-badge">🍿 Movie Night</div>

          <h1>Your movie room</h1>

          <p className="room-subtitle">
            Everyone swipes independently. We'll find the
            movies your group agrees on.
          </p>

          {/* ROOM CODE */}
          <div className="room-code-card">
            <p>ROOM CODE</p>
            <h2>{room.code}</h2>

            <button
              className="copy-button"
              onClick={copyRoomCode}
            >
              Copy Room Code
            </button>
          </div>

          {/* ROOM INFO */}
          <div className="room-info">
            <div className="info-card">
              <span>🎭</span>
              <div>
                <small>GENRE</small>
                <strong>{room.genre}</strong>
              </div>
            </div>

            <div className="info-card">
              <span>👥</span>
              <div>
                <small>PLAYERS</small>
                <strong>{room.members.length}</strong>
              </div>
            </div>
          </div>

          {/* MEMBERS */}
          <div className="members-section">
            <h3>Friends in the room</h3>

            <div className="members-list">
              {room.members.map((member, index) => {
                const memberProgress =
                  progress?.progress?.[member.name] || 0;

                return (
                  <div className="member" key={index}>
                    <div className="avatar">
                      {member.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="member-info">
                      <span>
                        {member.name}
                        {member.name === currentUser
                          ? " (You)"
                          : ""}
                      </span>

                      {member.is_host && (
                        <small>Host</small>
                      )}

                      {totalMovies > 0 && (
                        <small>
                          {memberProgress}/{totalMovies} swiped
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}

              {room.members.length < 2 && (
                <div className="waiting-member">
                  <div className="waiting-dots">...</div>
                  <span>Waiting for friends to join</span>
                </div>
              )}
            </div>
          </div>

          {/* PROGRESS */}
          <div className="movie-section">
            <div className="movie-section-header">
              <span className="movie-eyebrow">
                🎬 MOVIE NIGHT
              </span>

              <h2>Pick a movie</h2>

              <p>
                Swipe right if you'd watch it.
                Swipe left if you'd pass.
              </p>
            </div>

            <div className="progress-wrapper">
              <div className="progress-label">
                <span>Your progress</span>
                <strong>
                  {myProgress}/{totalMovies || "—"}
                </strong>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {moviesLoading ? (
              <div className="movie-loading">
                Finding movies for your group...
              </div>
            ) : movies.length === 0 ? (
              <div className="movie-loading">
                No movies found for this genre.
              </div>
            ) : finishedMySwipes ? (
              <div className="movie-finished">
                <div className="movie-finished-icon">🎉</div>

                <h2>You're done!</h2>

                <p>
                  Waiting for everyone else to finish
                  their swipes.
                </p>

                {progress?.all_finished && (
                  <button
                    className="start-button"
                    onClick={() =>
                      navigate(`/room/${roomCode}/results`)
                    }
                  >
                    See Results →
                  </button>
                )}
              </div>
            ) : (
              <MovieCard
                movie={movies[movieIndex]}
                onLike={handleLike}
                onPass={handlePass}
              />
            )}
          </div>

          {/* STATUS */}
          <p className="start-hint">
            {submitting
              ? "Saving your choice..."
              : connected
                ? "Your choices are synced live with the room."
                : "Reconnecting to the room..."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Room;
