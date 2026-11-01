# Quorum

A real-time collaborative decision-making platform with structured workflows and AI-powered analysis. Quorum helps teams make better decisions together through transparent, democratic processes.

## Overview

Quorum transforms group decision-making from endless debates into structured, time-boxed workflows. Teams progress through six distinct phases: gathering participants, proposing options, private rating, collaborative analysis, approval voting, and final decision.

## Key Features

### Structured Decision Process
- **6-Phase Workflow**: Lobby → Options → Rating → Revealed → Voting → Decided
- **Privacy-First Rating**: Individual ratings remain private until the reveal phase
- **Approval Voting**: Democratic system where participants select all acceptable options
- **Real-Time Collaboration**: All participants see updates instantly via Socket.IO

### AI-Powered Analysis
- **Statistical Analysis**: Automatic calculation of means, spreads, and disagreement detection
- **Optional AI Enhancement**: Natural language analysis and suggestions (works without API key)
- **Deterministic Fallback**: Full functionality without AI configuration

### Modern UX
- **Google Meet-Inspired Interface**: Clean, familiar design with floating control bars
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support
- **Real-Time Status**: Live connection indicators and participant presence

## Tech Stack

### Frontend
- **Next.js 14** with App Router and Turbopack
- **React 18** with TypeScript
- **Zustand** for state management
- **Socket.IO Client** for real-time communication
- **Tailwind CSS** with custom Meet-style design system
- **shadcn/ui** component library

### Backend
- **Node.js** with Express
- **Socket.IO** for WebSocket communication
- **TypeScript** with strict mode
- **Zod** for runtime validation
- **In-memory storage** with reconnection support

### Infrastructure
- **pnpm Workspaces** monorepo structure
- **Docker** support included
- **ESLint** and **Prettier** for code quality

## Project Structure

```
quorum-main/
├── apps/
│   ├── server/              # Socket.IO backend server
│   │   ├── src/
│   │   │   ├── ai/          # AI integration and fallback
│   │   │   ├── auth/        # Authentication and reconnection
│   │   │   ├── limits/      # Rate limiting
│   │   │   ├── socket/      # Socket.IO handlers
│   │   │   ├── state/       # Room state management
│   │   │   └── store/       # In-memory data store
│   │   └── package.json
│   └── quorum-main/         # Next.js frontend
│       ├── app/             # Next.js app directory
│       ├── components/      # React components
│       ├── lib/             # Utilities and Zustand store
│       └── public/          # Static assets
├── packages/
│   └── shared/              # Shared TypeScript types and schemas
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites
- **Node.js** 18+ and **pnpm** installed
- No API key required (AI features work with deterministic fallback)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kushkar8/Quorum.git
cd Quorum
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:

**Frontend** (`quorum-main/.env.local`):
```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

**Backend** (`apps/server/.env`):
```env
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Optional: AI features (leave empty for deterministic fallback)
# AI_API_KEY=your-openai-key
# AI_ENDPOINT=https://api.openai.com/v1/chat/completions
# AI_MODEL=gpt-3.5-turbo
```

### Running the Application

Start both servers in separate terminals:

**Terminal 1 - Backend:**
```bash
cd apps/server
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd quorum-main
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Usage Workflow

### 1. Create a Room
- Enter your name on the landing page
- Click "Create room" to generate a unique 6-character room code
- Share the code with your team

### 2. Gather Participants (Lobby Phase)
- Team members join using the room code
- Host sees all participants with avatar tiles
- Host clicks "Start options" when ready

### 3. Propose Options (Options Phase)
- All participants can add decision options
- Minimum 2 options required to proceed
- Host clicks "Start rating" to continue

### 4. Private Rating (Rating Phase)
- Each participant rates options on a 1-5 scale
- Optional reasoning for each rating
- Ratings remain private until reveal
- Host clicks "Reveal ratings" when all are finished

### 5. Analysis & Discussion (Revealed Phase)
- Rating matrix shows all scores
- Statistical analysis highlights consensus and disagreements
- AI provides natural language summary (or deterministic analysis)
- Host clicks "Open voting" to proceed

### 6. Approval Voting (Voting Phase)
- Participants select all options they can support
- Live vote counts visible to all
- Host clicks "Close voting" when complete

### 7. Final Decision (Decided Phase)
- Winner announced based on approval votes
- Complete summary with all statistics
- Export results as Markdown

## Configuration

### AI Features (Optional)

Quorum works perfectly without an AI API key using statistical analysis. To enable enhanced AI features:

1. Get an OpenAI API key from https://platform.openai.com
2. Add to `apps/server/.env`:
```env
AI_API_KEY=sk-your-key-here
AI_MODEL=gpt-3.5-turbo
```

**With AI Key:**
- Natural language analysis and verdicts
- AI-suggested options
- Contextual compromise explanations

**Without AI Key:**
- Statistical analysis (mean, spread, disagreements)
- Deterministic compromise selection
- All core features fully functional

### Rate Limiting

AI features include built-in rate limiting:
- 3 calls per room per phase
- Prevents API abuse
- Automatic fallback to statistical analysis

## Development

### Available Scripts

**Frontend:**
```bash
pnpm dev      # Development server
pnpm build    # Production build
pnpm start    # Production server
```

**Backend:**
```bash
pnpm dev      # Development with auto-reload
pnpm test     # Run tests
pnpm lint     # Lint code
```

### Testing

Run integration tests:
```bash
cd apps/server
pnpm test:integration
```

### Code Quality

```bash
pnpm lint       # Check for issues
pnpm format     # Format code with Prettier
```

## Architecture

### State Management
- **Zustand** on frontend for local state
- **In-memory store** on backend with room-based isolation
- **Socket.IO** for real-time state synchronization

### Privacy Architecture
- Rating data filtered server-side using `viewFor()` function
- Participants only see their own ratings until reveal
- Host permissions enforced server-side

### Reconnection
- Token-based reconnection system
- Automatic state restoration
- Graceful handling of disconnections

### Security
- CORS configuration for allowed origins
- Input validation with Zod schemas
- Rate limiting on AI endpoints
- Host-only actions enforced server-side

## Deployment

### Docker Support

```bash
docker-compose up
```

### Environment Variables for Production

Ensure all environment variables are properly configured for your production environment, including CORS origins and API endpoints.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion preferences respected

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- UI/UX inspired by Google Meet and Zoom
- Built with modern React and Next.js best practices
- Socket.IO for reliable real-time communication

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Made with care for better team decisions**
