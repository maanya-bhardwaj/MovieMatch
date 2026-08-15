from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import random
import string
import httpx

load_dotenv()

TMDB_API_TOKEN = os.getenv("TMDB_API_TOKEN")

GENRE_IDS = {
    "Action": 28,
    "Adventure": 12,
    "Animation": 16,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Family": 10751,
    "Fantasy": 14,
    "Horror": 27,
    "Mystery": 9648,
    "Romance": 10749,
    "Science Fiction": 878,
    "Sci-Fi": 878,
    "Thriller": 53,
}

app = FastAPI(title="MovieMatch API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# IN-MEMORY STORAGE
# ==================================================

rooms = {}
votes = {}
room_connections = {}

# votes[room_code][user_name][movie_id] = "like" / "pass"


# ==================================================
# REQUEST MODELS
# ==================================================

class CreateRoomRequest(BaseModel):
    name: str
    genre: str


class JoinRoomRequest(BaseModel):
    name: str


class SwipeRequest(BaseModel):
    name: str
    movie_id: int
    vote: str


# ==================================================
# HELPERS
# ==================================================

def generate_room_code():
    characters = string.ascii_uppercase + string.digits

    while True:
        code = "".join(random.choices(characters, k=5))
        if code not in rooms:
            return code


def room_exists(room_code: str):
    return room_code.upper() in rooms


async def broadcast(room_code: str, message: dict):
    """Send a message to every connected client in a room."""
    connections = room_connections.get(room_code, [])

    disconnected = []

    for connection in connections:
        try:
            await connection.send_json(message)
        except Exception:
            disconnected.append(connection)

    for connection in disconnected:
        if connection in connections:
            connections.remove(connection)


def get_room_progress(room_code: str):
    room = rooms[room_code]
    members = room["members"]
    room_votes = votes.get(room_code, {})

    total_movies = len(room.get("movies", []))

    progress = {}

    for member in members:
        name = member["name"]
        progress[name] = len(room_votes.get(name, {}))

    all_finished = (
        total_movies > 0
        and len(members) > 0
        and all(
            progress.get(member["name"], 0) >= total_movies
            for member in members
        )
    )

    return {
        "room_code": room_code,
        "total_movies": total_movies,
        "progress": progress,
        "all_finished": all_finished,
    }


# ==================================================
# BASIC ROUTES
# ==================================================

@app.get("/")
def root():
    return {"message": "MovieMatch API is running!"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# ==================================================
# CREATE ROOM
# ==================================================

@app.post("/rooms")
def create_room(request: CreateRoomRequest):
    name = request.name.strip()
    genre = request.genre.strip()

    if not name:
        return {"error": "Name is required"}

    if not genre:
        return {"error": "Genre is required"}

    room_code = generate_room_code()

    rooms[room_code] = {
        "code": room_code,
        "genre": genre,
        "members": [
            {
                "name": name,
                "is_host": True,
            }
        ],
        "status": "waiting",
        "movies": [],
    }

    votes[room_code] = {}

    return rooms[room_code] | {"room_code": room_code}


# ==================================================
# JOIN ROOM
# ==================================================

@app.post("/rooms/{room_code}/join")
async def join_room(room_code: str, request: JoinRoomRequest):
    room_code = room_code.upper()
    name = request.name.strip()

    if room_code not in rooms:
        return {"error": "Room not found"}

    if not name:
        return {"error": "Name is required"}

    for member in rooms[room_code]["members"]:
        if member["name"].lower() == name.lower():
            return {"error": "A player with this name is already in the room"}

    rooms[room_code]["members"].append(
        {
            "name": name,
            "is_host": False,
        }
    )

    await broadcast(
        room_code,
        {
            "type": "room_updated",
            "room": rooms[room_code],
        },
    )

    return rooms[room_code]


# ==================================================
# GET ROOM
# ==================================================

@app.get("/rooms/{room_code}")
def get_room(room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        return {"error": "Room not found"}

    return rooms[room_code]


# ==================================================
# GET MOVIES FROM TMDB
# ==================================================

@app.get("/rooms/{room_code}/movies")
async def get_movies(room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        return {"error": "Room not found"}

    room = rooms[room_code]

    # All users in a room receive the same movie list.
    if room.get("movies"):
        return {
            "genre": room["genre"],
            "movies": room["movies"],
        }

    genre_id = GENRE_IDS.get(room["genre"])

    if not genre_id:
        return {"error": f"Unsupported genre: {room['genre']}"}

    if not TMDB_API_TOKEN:
        return {"error": "TMDB API token is not configured"}

    url = "https://api.themoviedb.org/3/discover/movie"

    params = {
        "language": "en-US",
        "page": 1,
        "sort_by": "popularity.desc",
        "include_adult": "false",
        "include_video": "false",
        "with_genres": genre_id,
    }

    headers = {
        "Authorization": f"Bearer {TMDB_API_TOKEN}",
        "accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=headers,
            )
    except httpx.HTTPError:
        return {"error": "Could not connect to TMDB"}

    if response.status_code != 200:
        return {
            "error": "Could not fetch movies from TMDB",
            "status_code": response.status_code,
        }

    data = response.json()
    movies = []

    for movie in data.get("results", []):
        movies.append(
            {
                "id": movie.get("id"),
                "title": movie.get("title", "Untitled"),
                "overview": movie.get("overview", ""),
                "poster_path": movie.get("poster_path"),
                "backdrop_path": movie.get("backdrop_path"),
                "release_date": movie.get("release_date", ""),
                "rating": movie.get("vote_average", 0),
            }
        )

    # Store the list so every participant votes on the exact same movies.
    room["movies"] = movies
    room["status"] = "swiping"

    await broadcast(
        room_code,
        {
            "type": "movies_ready",
            "room": room,
        },
    )

    return {
        "genre": room["genre"],
        "movies": movies,
    }


# ==================================================
# RECORD MOVIE SWIPE
# ==================================================

@app.post("/rooms/{room_code}/swipe")
async def record_swipe(room_code: str, request: SwipeRequest):
    room_code = room_code.upper()

    if room_code not in rooms:
        return {"error": "Room not found"}

    if request.vote not in ["like", "pass"]:
        return {"error": "Vote must be 'like' or 'pass'"}

    room = rooms[room_code]

    member = next(
        (
            member
            for member in room["members"]
            if member["name"].lower() == request.name.strip().lower()
        ),
        None,
    )

    if not member:
        return {"error": "User is not in this room"}

    if not room.get("movies"):
        return {"error": "Movies have not been loaded yet"}

    valid_movie_ids = {movie["id"] for movie in room["movies"]}

    if request.movie_id not in valid_movie_ids:
        return {"error": "Movie is not part of this room"}

    user_name = member["name"]

    if room_code not in votes:
        votes[room_code] = {}

    if user_name not in votes[room_code]:
        votes[room_code][user_name] = {}

    votes[room_code][user_name][request.movie_id] = request.vote

    progress = get_room_progress(room_code)

    if progress["all_finished"]:
        room["status"] = "finished"

    await broadcast(
        room_code,
        {
            "type": "progress_updated",
            "progress": progress,
        },
    )

    if progress["all_finished"]:
        await broadcast(
            room_code,
            {
                "type": "all_finished",
                "progress": progress,
            },
        )

    return {
        "success": True,
        "room_code": room_code,
        "name": user_name,
        "movie_id": request.movie_id,
        "vote": request.vote,
        **progress,
    }


# ==================================================
# GET MATCHES
# ==================================================

@app.get("/rooms/{room_code}/matches")
def get_matches(room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        return {"error": "Room not found"}

    room = rooms[room_code]
    room_votes = votes.get(room_code, {})

    if not room_votes:
        return {
            "room_code": room_code,
            "matches": [],
            "message": "No votes yet",
        }

    total_members = len(room["members"])
    movie_lookup = {
        movie["id"]: movie
        for movie in room.get("movies", [])
    }

    movie_votes = {}

    for user_name, user_votes in room_votes.items():
        for movie_id, vote in user_votes.items():
            if movie_id not in movie_votes:
                movie_votes[movie_id] = {
                    "likes": 0,
                    "passes": 0,
                    "liked_by": [],
                }

            if vote == "like":
                movie_votes[movie_id]["likes"] += 1
                movie_votes[movie_id]["liked_by"].append(user_name)
            else:
                movie_votes[movie_id]["passes"] += 1

    matches = []

    for movie_id, data in movie_votes.items():
        movie = movie_lookup.get(int(movie_id))

        if not movie:
            continue

        likes = data["likes"]
        score = (likes / total_members) * 100 if total_members else 0

        matches.append(
            {
                "movie_id": int(movie_id),
                "title": movie["title"],
                "overview": movie["overview"],
                "poster_path": movie["poster_path"],
                "backdrop_path": movie["backdrop_path"],
                "release_date": movie["release_date"],
                "rating": movie["rating"],
                "likes": likes,
                "passes": data["passes"],
                "total_members": total_members,
                "match_score": round(score, 1),
                "liked_by": data["liked_by"],
                "unanimous": likes == total_members,
            }
        )

    matches.sort(
        key=lambda movie: (
            movie["unanimous"],
            movie["match_score"],
            movie["rating"],
        ),
        reverse=True,
    )

    return {
        "room_code": room_code,
        "total_members": total_members,
        "matches": matches,
    }


# ==================================================
# GET SWIPE PROGRESS
# ==================================================

@app.get("/rooms/{room_code}/progress")
def get_progress(room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        return {"error": "Room not found"}

    return get_room_progress(room_code)


# ==================================================
# WEBSOCKET
# ==================================================

@app.websocket("/ws/{room_code}")
async def room_websocket(websocket: WebSocket, room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    if room_code not in room_connections:
        room_connections[room_code] = []

    room_connections[room_code].append(websocket)

    try:
        await websocket.send_json(
            {
                "type": "room_state",
                "room": rooms[room_code],
            }
        )

        await websocket.send_json(
            {
                "type": "progress_updated",
                "progress": get_room_progress(room_code),
            }
        )

        while True:
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        if room_code in room_connections:
            if websocket in room_connections[room_code]:
                room_connections[room_code].remove(websocket)

            if not room_connections[room_code]:
                del room_connections[room_code]
