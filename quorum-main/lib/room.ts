import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import type { RoomState, ServerToClientEvents, ClientToServerEvents } from '@quorum/shared'

export type Phase = 'lobby' | 'options' | 'rating' | 'revealed' | 'voting' | 'decided'
export type Participant = { id: string; name: string; connected: boolean; isAI: boolean; statusLine?: string }
export type Option = { id: string; title: string; addedBy: string; suggestedByAI: boolean }
export type RoomView = {
  phase: Phase
  room: { code: string; title: string; hostId: string }
  me: { id: string; name: string }
  participants: Participant[]
  options: Option[]
  myRatings: Record<string, { score: 1 | 2 | 3 | 4 | 5; reason?: string }>
  ratingProgress: { finished: number; total: number }
  revealed?: { ratings: Record<string, Record<string, number>>; means: Record<string, number>; spreads: Record<string, number> }
  analysis?: { verdicts: Record<string, string>; disagreements: string[]; compromise?: string; aiUnavailable?: boolean }
  votes?: { counts: Record<string, number>; votedBy: string[] }
  // UI state
  isConnected: boolean
  isLoading: boolean
  aiStatus: string
}

type RoomActions = {
  createRoom: (title: string, name: string) => void
  joinRoom: (code: string, name: string) => void
  addOption: (title: string) => void
  removeOption: (id: string) => void
  startOptions: () => void
  startRating: () => void
  setRating: (optionId: string, score: 1 | 2 | 3 | 4 | 5, reason: string) => void
  revealRatings: () => void
  openVoting: () => void
  vote: (optionIds: string[]) => void
  closeVoting: () => void
  acceptCompromise: () => void
  copyCode: () => void
}

const emptyView = (): RoomView => ({
  phase: 'lobby',
  room: { code: '', title: '', hostId: '' },
  me: { id: '', name: '' },
  participants: [],
  options: [],
  myRatings: {},
  ratingProgress: { finished: 0, total: 0 },
  isConnected: false,
  isLoading: false,
  aiStatus: '',
})

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
let resumeToken: string | null = null

function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    console.log('Creating new socket connection to:', SERVER_URL)
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })
    
    socket.on('connect', () => {
      console.log('Socket connected successfully! Socket ID:', socket?.id)
      useRoom.setState({ isConnected: true })
    })
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      useRoom.setState({ isConnected: false })
    })
    
    socket.on('room:state', (state: RoomState) => {
      useRoom.getState().handleRoomState(state)
    })
    
    socket.on('error', (error) => {
      // Handle different error formats
      const message = error?.message || (typeof error === 'string' ? error : '')
      
      if (message) {
        console.error('Socket error:', error)
        toast.error(message)
      } else {
        // Empty error object - just log without showing to user
        console.log('Socket handshake event (harmless):', error)
      }
    })
    
    socket.on('ai:status', (status) => {
      console.log('AI status:', status.line)
      useRoom.setState({ aiStatus: status.line })
    })
  }
  return socket
}

function mapRoomStateToView(state: RoomState, myId: string): Partial<RoomView> {
  const myRatings: Record<string, { score: 1 | 2 | 3 | 4 | 5; reason?: string }> = {}
  if (state.ratings[myId]) {
    Object.entries(state.ratings[myId]).forEach(([optId, rating]) => {
      myRatings[optId] = {
        score: rating.score as 1 | 2 | 3 | 4 | 5,
        reason: rating.reason,
      }
    })
  }

  const revealed =
    state.phase === 'revealed' || state.phase === 'voting' || state.phase === 'decided'
      ? {
          ratings: Object.fromEntries(
            Object.entries(state.ratings).map(([pId, opts]) => [
              pId,
              Object.fromEntries(Object.entries(opts).map(([oId, r]) => [oId, r.score])),
            ])
          ),
          means: Object.fromEntries(
            (state.analysis?.perOption || []).map((p) => [p.optionId, p.mean])
          ),
          spreads: Object.fromEntries(
            (state.analysis?.perOption || []).map((p) => [p.optionId, p.spread])
          ),
        }
      : undefined

  const analysis = state.analysis
    ? {
        verdicts: Object.fromEntries(
          (state.analysis.perOption || []).map((p) => [p.optionId, p.verdict])
        ),
        disagreements: (state.analysis.disagreements || []).map((d) => d.optionId),
        compromise: state.analysis.compromise?.rationale,
        aiUnavailable: state.analysis.aiUnavailable,
      }
    : undefined

  const voteCounts: Record<string, number> = {}
  const votedBy: string[] = []
  Object.entries(state.votes).forEach(([pId, optIds]) => {
    votedBy.push(pId)
    optIds.forEach((optId) => {
      voteCounts[optId] = (voteCounts[optId] || 0) + 1
    })
  })

  return {
    phase: state.phase,
    room: { code: state.id, title: state.title, hostId: state.hostId },
    participants: state.participants.map((p) => ({
      ...p,
      statusLine: p.isAI ? 'AI participant' : undefined,
    })),
    options: state.options,
    myRatings,
    ratingProgress: state.ratingProgress || { finished: 0, total: 0 },
    revealed,
    analysis,
    votes: { counts: voteCounts, votedBy },
  }
}

export const useRoom = create<RoomView & RoomActions & { handleRoomState: (state: RoomState) => void }>((set, get) => ({
  ...emptyView(),
  
  handleRoomState: (state: RoomState) => {
    const myId = get().me.id
    const updates = mapRoomStateToView(state, myId)
    set(updates)
  },

  createRoom: (title, name) => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('room:create', { title: title.trim(), name: name.trim() }, (response) => {
      set({ isLoading: false })
      if ('error' in response) {
        console.error('Create room error:', response.error)
        toast.error(response.error.message || 'Failed to create room')
        return
      }
      resumeToken = response.resumeToken
      localStorage.setItem('quorum_resume_token', resumeToken)
      set({ me: { id: response.participantId, name: name.trim() }, room: { code: response.code, title: title.trim(), hostId: response.participantId } })
      toast.success('Room created!')
    })
  },

  joinRoom: (code, name) => {
    console.log('joinRoom called with:', { code, name })
    const sock = getSocket()
    console.log('Socket:', sock.id, 'connected:', sock.connected)
    const storedToken = localStorage.getItem('quorum_resume_token')
    set({ isLoading: true })
    sock.emit(
      'room:join',
      { code: code.trim().toUpperCase(), name: name.trim(), resumeToken: storedToken || undefined },
      (response) => {
        console.log('Join room response:', response)
        set({ isLoading: false })
        if ('error' in response) {
          console.error('Join room error:', response.error)
          toast.error(response.error.message || 'Failed to join room')
          return
        }
        resumeToken = response.resumeToken
        localStorage.setItem('quorum_resume_token', resumeToken)
        console.log('Setting state with participantId:', response.participantId, 'code:', code.trim().toUpperCase())
        set({ 
          me: { id: response.participantId, name: name.trim() },
          room: { code: code.trim().toUpperCase(), title: '', hostId: '' }
        })
        toast.success('Joined room!')
      }
    )
  },

  addOption: (title) => {
    const sock = getSocket()
    if (title.trim()) {
      set({ isLoading: true })
      sock.emit('option:add', { title: title.trim() })
      // Loading state will be cleared when room:state arrives
      setTimeout(() => set({ isLoading: false }), 1000)
    }
  },

  removeOption: (id) => {
    const sock = getSocket()
    sock.emit('option:remove', { optionId: id })
  },

  startOptions: () => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('phase:advance')
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  startRating: () => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('phase:advance')
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  setRating: (optionId, score, reason) => {
    const sock = getSocket()
    sock.emit('rating:submit', { optionId, score, reason: reason.trim() || undefined })
  },

  revealRatings: () => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('phase:advance')
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  openVoting: () => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('phase:advance')
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  vote: (optionIds) => {
    const { me, votes, isLoading } = get()
    if (isLoading) return // Prevent double-clicks
    if (votes?.votedBy.includes(me.id)) return

    // Send ONLY this participant's ballot, once — never the aggregate counts
    const unique = Array.from(new Set(optionIds))
    if (unique.length === 0) return

    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('vote:set', { optionIds: unique })
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  closeVoting: () => {
    const sock = getSocket()
    set({ isLoading: true })
    sock.emit('phase:advance')
    setTimeout(() => set({ isLoading: false }), 1000)
  },

  acceptCompromise: () => {
    set({ phase: 'decided' })
  },

  copyCode: () => {
    const code = get().room.code
    if (code) navigator.clipboard?.writeText(code)
  },
}))
