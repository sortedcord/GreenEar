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
- Automatic server-side session cleanup after 24 hours

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
