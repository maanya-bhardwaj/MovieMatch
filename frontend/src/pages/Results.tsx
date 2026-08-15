import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Match {
  movie_id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  rating: number;
  likes: number;
  passes: number;
  total_members: number;
  match_score: number;
  liked_by: string[];
  unanimous: boolean;
}

interface ProgressData {
  total_movies: number;
  progress: Record<string, number>;
  all_finished: boolean;
}

function Results() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<Match[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResults = async () => {
    if (!roomCode) return;

    try {
      const [matchResponse, progressResponse] =
        await Promise.all([
          fetch(
            `http://127.0.0.1:8000/rooms/${roomCode}/matches`
          ),
          fetch(
            `http://127.0.0.1:8000/rooms/${roomCode}/progress`
          ),
        ]);

      const matchData = await matchResponse.json();
      const progressData = await progressResponse.json();

      if (matchData.error) {
        setError(matchData.error);
        return;
      }

      setMatches(matchData.matches || []);
      setProgress(progressData);
    } catch (err) {
      console.error(err);
      setError("Could not load your results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/${roomCode}`
    );

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (
        data.type === "progress_updated" ||
        data.type === "all_finished"
      ) {
        setProgress(data.progress);
        fetchResults();
      }
    };

    return () => socket.close();
  }, [roomCode]);

  if (loading) {
    return (
      <div className="room-page">
        <div className="room-loading">
          Calculating your movie matches...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-page">
        <div className="room-error">
          <h1>Something went wrong</h1>
          <p>{error}</p>
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

  const topMatch = matches[0];

  return (
    <div className="room-page">
      <div className="room-container">
        <div className="room-header">
          <button
            className="back-button"
            onClick={() => navigate(`/room/${roomCode}`)}
          >
            ← Back to Room
          </button>

          <div className="logo">🎬 MovieMatch</div>

          <div className="room-live-status">
            <span className="status-dot connected" />
            Results
          </div>
        </div>

        <div className="room-main results-main">
          <div className="room-badge">🍿 The verdict is in</div>

          <h1>Your group's picks.</h1>

          <p className="room-subtitle">
            Movies are ranked by how many people in the
            room liked them.
          </p>

          {!progress?.all_finished && (
            <div className="movie-loading">
              <h3>Still waiting for everyone</h3>
              <p>
                Results will update automatically as people
                finish swiping.
              </p>
            </div>
          )}

          {progress?.all_finished && topMatch && (
            <div className="top-match-card">
              {topMatch.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w780${topMatch.poster_path}`}
                  alt={topMatch.title}
                />
              ) : (
                <div className="top-match-placeholder">
                  🎬
                </div>
              )}

              <div className="top-match-content">
                <span className="movie-eyebrow">
                  🏆 TOP MATCH
                </span>

                <h2>{topMatch.title}</h2>

                <div className="match-score">
                  {topMatch.match_score}% match
                </div>

                <p>{topMatch.overview}</p>

                <small>
                  {topMatch.likes}/{topMatch.total_members} people
                  liked this movie
                </small>
              </div>
            </div>
          )}

          <div className="results-list">
            <div className="movie-section-header">
              <span className="movie-eyebrow">
                🎯 GROUP RANKING
              </span>
              <h2>Everyone's picks</h2>
            </div>

            {matches.length === 0 ? (
              <div className="movie-loading">
                No shared picks yet.
              </div>
            ) : (
              matches.map((movie, index) => (
                <div className="result-card" key={movie.movie_id}>
                  <div className="result-rank">
                    #{index + 1}
                  </div>

                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                      alt={movie.title}
                    />
                  ) : (
                    <div className="result-poster-placeholder">
                      🎬
                    </div>
                  )}

                  <div className="result-info">
                    <div>
                      {movie.unanimous && (
                        <span className="unanimous-badge">
                          Everyone liked it
                        </span>
                      )}

                      <h3>{movie.title}</h3>

                      <p>
                        {movie.release_date
                          ? movie.release_date.slice(0, 4)
                          : "—"}{" "}
                        · ⭐ {movie.rating.toFixed(1)}
                      </p>
                    </div>

                    <strong>
                      {movie.match_score}% match
                    </strong>

                    <span>
                      ❤️ {movie.likes} liked · ✕ {movie.passes} passed
                    </span>

                    {movie.liked_by.length > 0 && (
                      <small>
                        Liked by {movie.liked_by.join(", ")}
                      </small>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            className="start-button"
            onClick={() => navigate("/")}
          >
            Start Another Movie Night →
          </button>
        </div>
      </div>
    </div>
  );
}

export default Results;
