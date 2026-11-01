'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useRoom } from '@/lib/room'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function CreateRoomPage() {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [purpose, setPurpose] = useState('')
  const createRoom = useRoom((s) => s.createRoom)
  const isLoading = useRoom((s) => s.isLoading)
  const router = useRouter()

  const handleCreate = () => {
    const title = purpose || 'Team Decision'
    createRoom(title, name)
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
        <h1>Create a room</h1>
      </div>
      
      <div className="home-form">
        <div>
          <label className="field-label" htmlFor="creator-name">Your name</label>
          <input 
            id="creator-name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Display name" 
          />
        </div>

        <div>
          <label className="field-label" htmlFor="team-name">Team</label>
          <input 
            id="team-name" 
            value={team} 
            onChange={(e) => setTeam(e.target.value)} 
            placeholder="Team or group name" 
          />
        </div>

        <div>
          <label className="field-label" htmlFor="meet-purpose">Meet purpose</label>
          <input 
            id="meet-purpose" 
            value={purpose} 
            maxLength={100}
            onChange={(e) => setPurpose(e.target.value)} 
            placeholder="What are you deciding?" 
          />
        </div>

        <Button 
          className="mt-2 h-12 w-full text-base" 
          disabled={!name.trim() || isLoading} 
          onClick={handleCreate}
        >
          {isLoading ? 'Creating...' : 'Create room'}
        </Button>
      </div>
    </main>
  )
}
