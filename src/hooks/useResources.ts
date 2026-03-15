import { useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { Resource } from '../lib/types'
import type { NotifyFn } from './useNotifications'
import { saveResource, getResources, deleteResource as fbDelete, storage } from '../lib/firebase'
import { ref as storageRef, getBlob } from 'firebase/storage'

export function useResources(user: User | null, notify: NotifyFn) {
  const [resources, setResources] = useState<Resource[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<Resource[]>([])
  const [uploading, setUploading] = useState(false)

  const loadResources = useCallback(async (subject?: string) => {
    if (!user) return
    try {
      const data = await getResources(subject)
      setResources(data)
    } catch (e) {
      notify('Failed to load resources', 'error')
    }
  }, [user, notify])

  const uploadResource = useCallback(async (
    file: File,
    subject: string
  ): Promise<Resource | null> => {
    if (!user) { notify('Login required to save resources', 'error'); return null }
    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const resource = await saveResource(
        { name: file.name, data: arrayBuffer, mimeType: file.type },
        subject
      )
      setResources(r => [resource, ...r])
      notify(`"${file.name}" saved to resources`, 'success')
      return resource
    } catch (e) {
      notify('Failed to upload resource', 'error')
      return null
    } finally {
      setUploading(false)
    }
  }, [user, notify])

  const deleteResource = useCallback(async (resource: Resource) => {
    try {
      await fbDelete(resource)
      setResources(r => r.filter(x => x.id !== resource.id))
      setKnowledgeBase(kb => kb.filter(x => x.id !== resource.id))
      notify(`"${resource.name}" deleted`, 'info')
    } catch (e) {
      notify('Failed to delete resource', 'error')
    }
  }, [notify])

  const addToKnowledgeBase = useCallback((resource: Resource) => {
    setKnowledgeBase(kb => {
      if (kb.find(x => x.id === resource.id)) return kb
      return [...kb, resource]
    })
  }, [])

  const removeFromKnowledgeBase = useCallback((id: string) => {
    setKnowledgeBase(kb => kb.filter(x => x.id !== id))
  }, [])

  const getBase64 = useCallback(async (resource: Resource): Promise<string> => {
    const sRef = storageRef(storage, resource.storagePath)
    const blob = await getBlob(sRef)
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return btoa(binary)
  }, [])

  return {
    resources, knowledgeBase, uploading,
    loadResources, uploadResource, deleteResource,
    addToKnowledgeBase, removeFromKnowledgeBase, getBase64,
  }
}
