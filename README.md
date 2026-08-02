# Green Ear

A small, self hosted audio comparison and blind ABX testing app.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Express
- FFmpeg (`ffmpeg-static`)

## Features

- Upload WAV, FLAC, AIFF, or ALAC sources (up to 500 MB by default)
- Transcode to MP3, AAC, and Opus at configurable bitrates
- Audition the lossless reference and every encoded version
- Run randomized, 10 trial blind ABX comparisons
- Automatic server-side session cleanup after 1 hour

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production

```bash
npm run build
npm start
```

Open `http://localhost:3001`.

Environment settings are documented in `.env.example`.

> For public deployment, place the app behind HTTPS and a reverse proxy. Uploaded audio is stored in `data/` for the session lifetime and should be placed on ephemeral/private storage.

### Docker production deployment

The production image is a multi-stage build, runs as the unprivileged `node` user,
and contains only production dependencies and compiled assets. Session data is held
in a named Docker volume and is removed no later than one minute after its one-hour
lifetime (including data left behind by a restarted container).

```bash
docker compose up --build -d
```

The Compose configuration exposes the service only on `127.0.0.1:3001`; put an HTTPS
reverse proxy in front of it for public access. To change the upload limit, edit
`MAX_UPLOAD_MB` in `docker-compose.yml`. Do not publish the port directly to the
internet.
