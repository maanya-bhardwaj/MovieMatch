import { useRef, useState } from "react";

export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  rating: number;
}

interface MovieCardProps {
  movie: Movie;
  onLike: () => void;
  onPass: () => void;
}

function MovieCard({
  movie,
  onLike,
  onPass,
}: MovieCardProps) {

  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;


  // --------------------------------------------
  // Start dragging
  // --------------------------------------------

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {

    setDragging(true);

    startX.current = event.clientX;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  };


  // --------------------------------------------
  // Drag movie
  // --------------------------------------------

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {

    if (!dragging) {
      return;
    }

    const difference =
      event.clientX - startX.current;

    setOffsetX(difference);
  };


  // --------------------------------------------
  // Release movie
  // --------------------------------------------

  const handlePointerUp = () => {

    setDragging(false);

    // Swipe right
    if (offsetX > 120) {

      setOffsetX(500);

      setTimeout(() => {
        onLike();
      }, 200);

      return;
    }

    // Swipe left
    if (offsetX < -120) {

      setOffsetX(-500);

      setTimeout(() => {
        onPass();
      }, 200);

      return;
    }

    // Not enough movement
    setOffsetX(0);
  };


  const rotation =
    offsetX / 20;


  return (

    <div className="movie-card-wrapper">

      <div
        className="movie-card"
        style={{
          transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
          transition: dragging
            ? "none"
            : "transform 0.25s ease",
        }}

        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >

        {/* -------------------------------- */}
        {/* Poster */}
        {/* -------------------------------- */}

        {posterUrl ? (

          <img
            src={posterUrl}
            alt={movie.title}
            className="movie-poster"
            draggable={false}
          />

        ) : (

          <div className="movie-poster-placeholder">
            🎬
          </div>

        )}


        {/* -------------------------------- */}
        {/* Movie information */}
        {/* -------------------------------- */}

        <div className="movie-card-content">

          <h2>
            {movie.title}
          </h2>


          <div className="movie-meta">

            <span>
              ⭐ {movie.rating.toFixed(1)}
            </span>

            {movie.release_date && (
              <span>
                {movie.release_date.slice(0, 4)}
              </span>
            )}

          </div>


          <p>
            {movie.overview}
          </p>

        </div>

      </div>


      {/* -------------------------------- */}
      {/* Buttons */}
      {/* -------------------------------- */}

      <div className="movie-actions">

        <button
          className="pass-button"
          onClick={onPass}
        >
          ✕
        </button>


        <button
          className="like-button"
          onClick={onLike}
        >
          ♥
        </button>

      </div>

    </div>
  );
}

export default MovieCard;