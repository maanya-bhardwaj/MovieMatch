import { useState } from "react";
import { useNavigate } from "react-router-dom";

const genres = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Horror",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

function CreateRoom() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createRoom = async () => {
    const normalizedName = name.trim();

    if (!normalizedName) {
      setError("Please enter your name.");
      return;
    }

    if (!genre) {
      setError("Please choose a genre.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/rooms",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
            genre,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "Failed to create room."
        );
      }

      // The Room page uses this to identify the
      // person making each swipe.
      localStorage.setItem(
        "movieMatchUser",
        normalizedName
      );

      navigate(`/room/${data.room_code}`);
    } catch (err) {
      console.error(err);
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-room-page">
      <div className="create-room-card">
        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>

        <div className="badge">
          🎬 Create a Movie Room
        </div>

        <h1>
          What are we
          <span> watching?</span>
        </h1>

        <p className="subtitle">
          Pick a genre, invite your friends, and let
          MovieMatch do the arguing.
        </p>

        <div className="form-section">
          <label>Your name</label>

          <input
            type="text"
            placeholder="e.g. Maanya"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label>Choose a genre</label>

          <div className="genre-grid">
            {genres.map((item) => (
              <button
                type="button"
                key={item}
                className={
                  genre === item
                    ? "genre-button selected"
                    : "genre-button"
                }
                onClick={() => setGenre(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="create-button"
            onClick={createRoom}
            disabled={loading}
          >
            {loading
              ? "Creating room..."
              : "Create Movie Room →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRoom;
