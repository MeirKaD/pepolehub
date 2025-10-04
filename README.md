# PeopleHub

Open-source LinkedIn people search engine powered by AI and real-time data.

## ✨ Features

- 🔍 **Natural Language Search** - Search for professionals using plain English (e.g., "10 AI Engineers in Israel")
- 🤖 **AI-Powered Query Parsing** - Google Gemini 2.0 Flash interprets your search intent
- 💾 **Smart Caching** - 30-day profile caching with automatic freshness checks
- 🌍 **Geolocation Support** - Country-specific search results
- 📊 **Expandable Profiles** - View detailed experience, education, and languages
- 🔄 **Auto-Refresh** - Previous searches page auto-updates every 30 seconds
- 🎨 **Beautiful UI** - Glassmorphism design with 3D magnifying glass animations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works)
- [Bright Data](https://brightdata.com) account with API token
- [Google AI Studio](https://makersuite.google.com) API key (Gemini)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/peoplehub
cd peoplehub
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
- `DATABASE_URL`: Supabase PostgreSQL connection string (Connection Pooling)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `BRIGHTDATA_API_TOKEN`: Your Bright Data API token
- `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google AI API key (Gemini)

4. **Set up database**
```bash
npx prisma generate
npx prisma db push
```

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📚 Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **3D Graphics:** React Three Fiber, @react-three/drei
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** Supabase PostgreSQL
- **AI:** Google Gemini 2.0 Flash (query parsing)
- **Data Source:** Bright Data API (LinkedIn & Google Search scraping)
- **Caching:** Database-level with 30-day freshness

## 🏗️ Project Structure

```
peoplehub/
├── prisma/
│   └── schema.prisma          # Database schema (Person & Search models)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/        # Main search endpoint
│   │   │   ├── profiles/      # Recent profiles API
│   │   │   └── proxy-image/   # Image proxy for LinkedIn avatars
│   │   ├── search/            # Search results page
│   │   ├── previous/          # Previous searches page
│   │   └── page.tsx           # Homepage with 3D animations
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── Navigation.tsx     # Glassmorphism navbar
│   │   ├── PersonCard.tsx     # Expandable profile card
│   │   ├── SearchBar.tsx      # Search input component
│   │   ├── FloatingOrbs.tsx   # 3D magnifying glasses
│   │   └── LoadingState.tsx   # Skeleton loader
│   ├── lib/
│   │   ├── brightdata/        # Bright Data API integration
│   │   ├── cache/             # Database caching layer
│   │   └── search/            # AI query parsing (Gemini)
│   └── types/
│       └── linkedin.ts        # LinkedIn profile types
├── tests/                     # Test scripts
└── package.json
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma generate` - Generate Prisma Client
- `npx prisma db push` - Push schema changes to database
- `npx prisma studio` - Open Prisma Studio

### Test Scripts

- `npx tsx src/tests/test-parser.ts` - Test AI query parsing
- `npx tsx src/tests/test-search-flow.ts` - Test search → Google → LinkedIn flow
- `npx tsx src/tests/test-cache.ts` - Test caching layer
- `npx tsx src/tests/test-recent-api.ts` - Test /api/profiles/recent endpoint

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.
