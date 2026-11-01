'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useRoom } from '@/lib/room'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function JoinRoomPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const joinRoom = useRoom((s) => s.joinRoom)
  const isLoading = useRoom((s) => s.isLoading)
  const router = useRouter()

  const handleJoin = () => {
    console.log('Join button clicked!', { code, name })
    joinRoom(code, name)
  }

  return (
    <main className="home-shell">
      <Link href="/" className="back-link">
        <ArrowLeft aria-hidden="true" />
        Back
      </Link>
      
      <div className="home-mark">Q</div>
      <div className="home-copy">
        <p className="eyebrow">Quorum</p>
        <h1>Join a room</h1>
      </div>
      
      <div className="home-form">
        <div>
          <label className="field-label" htmlFor="joiner-name">Your name</label>
          <input 
            id="joiner-name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Display name" 
          />
        </div>

        <div>
          <label className="field-label" htmlFor="room-code">Room code</label>
          <input 
            id="room-code"
            aria-label="Room code" 
            maxLength={6} 
            value={code} 
            onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} 
            placeholder="ABC123"
            style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
          />
        </div>

        <Button 
          className="mt-2 h-12 w-full text-base" 
          disabled={code.length !== 6 || !name.trim() || isLoading} 
          onClick={handleJoin}
        >
          {isLoading ? 'Joining...' : 'Join room'}
        </Button>
      </div>
    </main>
  )
}
