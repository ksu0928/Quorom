'use client'

import { CreateRoomPage } from '@/components/create-room'
import { useRoom } from '@/lib/room'
import { QuorumApp } from '@/components/quorum'

export default function CreatePage() {
  const me = useRoom((s) => s.me)
  
  // If already in a room, show the room interface
  if (me.id) {
    return <QuorumApp />
  }
  
  return <CreateRoomPage />
}
