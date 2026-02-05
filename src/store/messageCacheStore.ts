// ============================================
// Message Cache Store - IndexedDB
// ============================================

import type { Part } from '../types/message'

interface CachedMessageParts {
  sessionId: string
  messageId: string
  parts: Part[]
  updatedAt: number
}

const DB_NAME = 'claude-chat-cache'
const DB_VERSION = 1
const STORE_NAME = 'messageParts'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('bySession', 'sessionId', { unique: false })
        store.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function makeKey(sessionId: string, messageId: string): string {
  return `${sessionId}:${messageId}`
}

export class MessageCacheStore {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDb()
    }
    return this.dbPromise
  }

  async setMessageParts(sessionId: string, messageId: string, parts: Part[]): Promise<void> {
    try {
      const db = await this.getDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const payload = {
        key: makeKey(sessionId, messageId),
        sessionId,
        messageId,
        parts,
        updatedAt: Date.now(),
      }
      store.put(payload)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[MessageCacheStore] Failed to persist parts', error)
      }
    }
  }

  async getMessageParts(sessionId: string, messageId: string): Promise<CachedMessageParts | null> {
    try {
      const db = await this.getDb()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const key = makeKey(sessionId, messageId)
      const request = store.get(key)
      const result = await new Promise<CachedMessageParts | null>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })
      return result
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[MessageCacheStore] Failed to read parts', error)
      }
      return null
    }
  }

  async deleteMessageParts(sessionId: string, messageId: string): Promise<void> {
    try {
      const db = await this.getDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(makeKey(sessionId, messageId))
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[MessageCacheStore] Failed to delete parts', error)
      }
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    try {
      const db = await this.getDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('bySession')
      const request = index.openCursor(IDBKeyRange.only(sessionId))
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[MessageCacheStore] Failed to clear session cache', error)
      }
    }
  }
}

export const messageCacheStore = new MessageCacheStore()
