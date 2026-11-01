# Quorum Server

Real-time collaborative decision-making platform with AI assistance. The server manages rooms where small groups can propose options, rate them privately, and reach consensus with help from an AI participant.

## Features

- **Real-time collaboration** via Socket.IO
- **Privacy-first rating system** - ratings hidden until reveal phase
- **AI-powered insights** with deterministic fallback
- **Secure reconnection** with hashed resume tokens
- **Host promotion** on disconnect (30-second timeout)
- **In-memory storage** with automatic TTL sweep (4-hour idle)
- **Rate limiting** to prevent abuse
- **TypeScript strict mode** with full type safety

## Architecture

### Monorepo Structure

```
quorum-main/
├── packages/shared/         # Shared schemas, types, constants
│   └── src/
│       ├── constants.ts     # Constants and limits
│       ├── schemas.ts       # Zod validation schemas
│       ├── types.ts         # TypeScript types
│       └── index.ts
├── apps/server/            # Node.js + Express + Socket.IO server
│   └── src/
│       ├── ai/             # AI service integration
│       ├── auth/           # Identity and authentication
│       ├── limits/         # Rate limiting
│       ├── socket/         # Socket.IO handlers
│       ├── state/          # State management and filtering
│       ├── store/          # In-memory storage
│       ├── tests/          # Integration tests
│       └── server.ts       # Main entry point
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

```bash
# From workspace root
pnpm install
```

### Configuration

Copy the example environment file:

```bash
cd apps/server
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Required
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000

# Optional - AI service (uses deterministic fallback if not configured)
AI_API_KEY=your-api-key-here
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-3.5-turbo
```

### Running the Server

Development mode with auto-reload:

```bash
pnpm --filter @quorum/server dev
```

Production mode:

```bash
pnpm --filter @quorum/server start
```

The server will start on the configured PORT (default: 3001).

## Testing

### Unit Tests

Run unit tests (including viewFor privacy tests):

```bash
pnpm --filter @quorum/server test
```

### Integration Tests

Integration tests require the server to be running:

```bash
# Terminal 1: Start server
pnpm --filter @quorum/server dev

# Terminal 2: Run integration tests
pnpm --filter @quorum/server test:integration
```

**Key Tests:**
- `integration.test.ts` - Full flow from lobby → decided with rating privacy verification
- `reconnect.test.ts` - Resume token reconnection and host promotion
- `view-filter.test.ts` - Privacy enforcement at the data layer

## API Reference

### HTTP Endpoints

#### GET /health

Health check endpoint for monitoring and load balancers.

**Response:**
```json
{
  "status": "ok"
}
```

### Socket.IO Events

#### Client → Server

##### room:create

Create a new room and become the host.

**Payload:**
```typescript
{
  title: string,      // 1-100 chars
  name: string        // 1-24 chars
}
```

**Acknowledgment:**
```typescript
{
  code: string,           // 6-char room code
  resumeToken: string     // For reconnection
}
```

##### room:join

Join an existing room or reconnect to a previous session.

**Payload:**
```typescript
{
  code: string,           // 6-char room code
  name: string,           // 1-24 chars
  resumeToken?: string    // Optional - for reconnection
}
```

**Acknowledgment:**
```typescript
{
  resumeToken: string     // Store for reconnection
}
```

##### option:add

Add an option (lobby and options phases only).

**Payload:**
```typescript
{
  title: string           // 1-80 chars
}
```

##### option:remove

Remove an option (lobby and options phases only).

**Payload:**
```typescript
{
  optionId: string
}
```

##### rating:submit

Submit a rating for an option (rating phase only).

**Payload:**
```typescript
{
  optionId: string,
  score: number,          // 1-5
  reason?: string         // Optional, max 200 chars
}
```

##### phase:advance

Advance to the next phase (host only).

**No payload**

**Phase transitions:**
- lobby → options (requires 1+ human participant)
- options → rating (requires 2+ options and 2+ human participants)
- rating → revealed (host only)
- revealed → voting (host only)
- voting → decided (host only)

##### vote:set

Submit approval votes (voting phase only).

**Payload:**
```typescript
{
  optionIds: string[]     // Array of option IDs to approve
}
```

##### ai:suggest

Request AI to suggest options (options phase only, rate limited).

**No payload**

#### Server → Client

##### room:state

Sent whenever room state changes. Contains filtered view based on current phase.

**Payload:**
```typescript
{
  id: string,
  title: string,
  phase: 'lobby' | 'options' | 'rating' | 'revealed' | 'voting' | 'decided',
  hostId: string,
  participants: Participant[],
  options: Option[],
  ratings: Record<string, Record<string, Rating>>,  // Filtered by phase
  votes: Record<string, string[]>,
  analysis: Analysis | null,
  summary: string | null,
  locked: boolean,
  createdAt: number,
  lastActivity: number,
  ratingProgress?: { finished: number, total: number }  // In rating phase only
}
```

##### ai:status

Indicates AI processing status.

**Payload:**
```typescript
{
  line: string            // e.g., "reading ratings", "writing summary", or "" when done
}
```

##### error

Error notification.

**Payload:**
```typescript
{
  code: string,           // ERROR_CODES constant
  message: string
}
```

## Privacy Architecture

### Hidden Ratings (Highest Priority)

The `viewFor` function is the **SINGLE source of truth** for filtering room data sent to clients.

**Privacy Rules:**
- In `rating` phase: Each participant sees ONLY their own ratings
- In `revealed`, `voting`, `decided` phases: All ratings visible
- No code path may emit room data except through `viewFor`

**Enforcement:**
- Unit tests verify serialized JSON never contains other participants' data
- Integration tests use two clients to verify end-to-end privacy
- All socket handlers broadcast through `viewFor`

### Security Features

- **Resume tokens**: 32-byte cryptographically random tokens, hashed with bcrypt (10 rounds)
- **Rate limiting**: 10 rooms per hour per IP
- **Input validation**: All inputs validated with Zod schemas, rejected (not truncated)
- **AI prompt injection hygiene**: User content clearly delimited, system prompt warns to treat as data only
- **No persistent logs**: Rating content not logged, rooms deleted after TTL

## AI Service

### Configuration

The AI service is **optional**. If not configured, the server uses deterministic fallback for all AI features.

**Supported Providers:**
- OpenAI (gpt-3.5-turbo, gpt-4)
- Any OpenAI-compatible API endpoint
- Anthropic (with endpoint/model configuration)

### AI Jobs

1. **Suggest Options** (options phase)
   - Returns 1-3 new option suggestions
   - Deduplicated against existing options
   - Rate limited: 3 calls per room per phase

2. **Analyze Ratings** (revealed phase, automatic)
   - Identifies disagreements between participants
   - Recommends compromise option
   - Computes statistics (mean, spread, verdict)
   - Retries once on failure, falls back to deterministic analysis

3. **Write Summary** (decided phase, automatic)
   - 5-8 sentence summary of decision process
   - Includes outcome, reasoning, main disagreements
   - Falls back to template-based summary

### Deterministic Fallback

All AI features have deterministic fallback implementations:

- **Compromise selection**: Highest mean among options with no rating of 1, tie-break by lowest spread, then option order
- **Verdict determination**: "contested" if spread ≥ 3 or stdDev ≥ 1.2, "low" if mean < 2.5, else "consensus"
- **Analysis**: Identifies contested options, selects compromise using deterministic algorithm
- **Summary**: Template-based summary with statistics

## Limits and Constraints

### Capacity Limits

- **Participants**: 12 per room (AI doesn't count toward limit)
- **Options**: 10 per room
- **Room lifetime**: 4 hours idle TTL, swept every 5 minutes
- **AI calls**: 3 per room per phase

### Input Limits

- **Room title**: 100 characters
- **Option title**: 80 characters
- **Display name**: 1-24 characters
- **Rating reason**: 200 characters
- **Socket message**: 16 KB

### Rate Limits

- **Room creation**: 10 per hour per IP address
- **AI timeout**: 15 seconds per request

## Error Codes

```typescript
ERROR_CODES = {
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  ROOM_LOCKED: 'room_locked',
  INVALID_PHASE: 'invalid_phase',
  NOT_HOST: 'not_host',
  INVALID_INPUT: 'invalid_input',
  RATE_LIMITED: 'rate_limited',
  AI_UNAVAILABLE: 'ai_unavailable',
}
```

## Development

### Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with recommended rules
- **Formatting**: Prettier with default settings

### Project Principles

1. **Server is source of truth**: Clients send intents, receive full filtered snapshots
2. **Privacy by design**: `viewFor` is the only data serialization path
3. **Forward-only phases**: No backwards transitions
4. **Deterministic fallback**: AI failures never block progress
5. **No database**: Rooms live in memory, deleted after TTL

## Troubleshooting

### Server won't start

- Check PORT is not already in use
- Verify Node.js version (18+ required)
- Check ALLOWED_ORIGINS includes your client URL

### AI features not working

- Verify AI_API_KEY is set in .env
- Check AI_ENDPOINT is correct for your provider
- Review server logs for API errors
- System will fall back to deterministic analysis automatically

### Rating privacy concerns

- Run `pnpm test view-filter` to verify privacy enforcement
- Check that all broadcasts go through `viewFor` function
- Review integration tests for end-to-end privacy verification

### Host promotion not working

- Default timeout is 30 seconds after disconnect
- Only connected human participants can become host
- Check server logs for promotion events

## License

MIT
