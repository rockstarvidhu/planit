# Planit 🗺️

**Budget-aware outing planner for India.**  
Enter your location, budget, and vibe — Planit finds real places you can actually afford, with live cost estimates pulled from user reviews.

🔗 **Live Demo:** [planit-v1.vercel.app/](https://planit-v1.vercel.app/)

---

## The Problem

"I have ₹500 and 3 friends. What can we do near me today?"

Google Maps shows you places. It doesn't tell you if you can afford them. Planit does.

---

## Features

- 📍 **Location-aware search** — type your city or use GPS
- 💰 **Real cost estimates** — prices extracted from Google Maps user reviews, not just guessed
- 👥 **Group budgeting** — enter number of people, get per-person and total cost breakdown
- 🚗 **Travel cost calculation** — fuel cost if you have a vehicle, ride-share estimate if not
- 🎯 **Vibe filters** — Adventure, Nature, Food, Fun & Games
- 🔍 **Radius control** — search anywhere from 1km to 25km
- 🎮 **Loading minigame** — playable while the AI builds your plan

---

## Tech Stack

**Frontend**
- React 18
- Tailwind CSS
- Framer Motion
- Deployed on Vercel

**Backend**
- Node.js + Express
- Google Places API (search, details, directions, geocoding, photos)
- Gemini 1.5 Flash (AI place recommendations + price estimation)
- Deployed on Render

---

## How It Works

1. User enters location, budget, people count, and preferences
2. Backend geocodes the location using Google Maps API
3. Gemini AI brainstorms 10 relevant places matching the vibe
4. Each place is validated against Google Places for real coordinates
5. Distance and travel cost are calculated via Google Directions API
6. User reviews are mined for price mentions using regex pattern matching
7. The "most mentioned" price bucket is used as the activity cost estimate
8. Only places that fit within the budget are returned
9. Results are displayed with cost breakdown per place

---

## Local Setup

### Prerequisites
- Node.js 18+
- Google Cloud account with these APIs enabled:
  - Places API
  - Directions API
  - Geocoding API
- Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### Frontend

```bash
git clone https://github.com/rockstarvidhu/planit.git
cd planit
npm install
npm start
```

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in `/backend`:

```env
GOOGLE_API_KEY=your_google_api_key
GEMINI_API_KEY=your_gemini_api_key
```

```bash
npm run dev
```

Backend runs on `http://localhost:5000`

---

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Google Cloud API key with Places, Directions, and Geocoding enabled |
| `GEMINI_API_KEY` | Google AI Studio key for Gemini 1.5 Flash |

---

## Project Structure

```
planit/
├── src/
│   ├── components/
│   │   ├── UserInputForm.jsx      # 3-step input flow
│   │   ├── ItineraryDisplay.jsx   # Results cards
│   │   ├── MapView.jsx            # Map display
│   │   ├── LoadingGame.jsx        # Minigame during generation
│   │   ├── SplashScreen.jsx       # Intro screen
│   │   └── TiltCard.jsx           # Interactive card component
│   └── App.js
├── backend/
│   └── index.js                   # Express server + all API logic
└── README.md
```

---

## Roadmap

- [ ] Location photos from Google Places Photos API
- [ ] Per-person cost display on result cards
- [ ] Save and share itineraries
- [ ] Mobile PWA support
- [ ] User reviews and ratings for suggested spots

---

## License

MIT

---

Built by [@rockstarvidhu](https://github.com/rockstarvidhu)
