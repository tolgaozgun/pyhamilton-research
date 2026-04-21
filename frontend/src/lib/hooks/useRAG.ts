import { useState, useCallback } from 'react'
import { apiRepository } from '@/lib/api/repositories'
import type { RAGFile, VectorStore, VectorStoreFile, RAGSearchResult } from '@/types'

export interface UseRAGReturn {
  files: RAGFile[]
  vectorStores: VectorStore[]
  vectorStoreFiles: Record<string, VectorStoreFile[]>
  searchResults: RAGSearchResult[]
  isLoadingFiles: boolean
  isLoadingStores: boolean
  isLoadingStoreFiles: boolean
  isUploading: boolean
  isSearching: boolean
  fetchFiles: () => Promise<void>
  fetchVectorStores: () => Promise<void>
  fetchVectorStoreFiles: (vectorStoreId: string) => Promise<void>
  uploadFile: (file: File) => Promise<RAGFile | null>
  deleteFile: (fileId: string) => Promise<void>
  createVectorStore: (name: string, fileIds?: string[]) => Promise<VectorStore | null>
  deleteVectorStore: (id: string) => Promise<void>
  addFileToVectorStore: (vectorStoreId: string, fileId: string) => Promise<void>
  removeFileFromVectorStore: (vectorStoreId: string, fileId: string) => Promise<void>
  searchVectorStore: (vectorStoreId: string, query: string) => Promise<void>
}

export function useRAG(): UseRAGReturn {
  const [files, setFiles] = useState<RAGFile[]>([])
  const [vectorStores, setVectorStores] = useState<VectorStore[]>([])
  const [vectorStoreFiles, setVectorStoreFiles] = useState<Record<string, VectorStoreFile[]>>({})
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingStores, setIsLoadingStores] = useState(false)
  const [isLoadingStoreFiles, setIsLoadingStoreFiles] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const fetchFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    try {
      const data = await apiRepository.rag.listFiles()
      setFiles(data.files)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [])

  const fetchVectorStores = useCallback(async () => {
    setIsLoadingStores(true)
    try {
      const data = await apiRepository.rag.listVectorStores()
      setVectorStores(data.vector_stores)
    } finally {
      setIsLoadingStores(false)
    }
  }, [])

  const fetchVectorStoreFiles = useCallback(async (vectorStoreId: string) => {
    setIsLoadingStoreFiles(true)
    try {
      const data = await apiRepository.rag.listVectorStoreFiles(vectorStoreId)
      setVectorStoreFiles(prev => ({ ...prev, [vectorStoreId]: data.files }))
    } finally {
      setIsLoadingStoreFiles(false)
    }
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<RAGFile | null> => {
    setIsUploading(true)
    try {
      const uploaded = await apiRepository.rag.uploadFile(file)
      setFiles(prev => [uploaded, ...prev])
      return uploaded
    } catch {
      return null
    } finally {
      setIsUploading(false)
    }
  }, [])

  const deleteFile = useCallback(async (fileId: string) => {
    await apiRepository.rag.deleteFile(fileId)
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  const createVectorStore = useCallback(
    async (name: string, fileIds?: string[]): Promise<VectorStore | null> => {
      try {
        const store = await apiRepository.rag.createVectorStore({ name, fileIds })
        setVectorStores(prev => [store, ...prev])
        return store
      } catch {
        return null
      }
    },
    []
  )

  const deleteVectorStore = useCallback(async (id: string) => {
    await apiRepository.rag.deleteVectorStore(id)
    setVectorStores(prev => prev.filter(s => s.id !== id))
    setVectorStoreFiles(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const addFileToVectorStore = useCallback(
    async (vectorStoreId: string, fileId: string) => {
      const vsFile = await apiRepository.rag.addFileToVectorStore(vectorStoreId, fileId)
      setVectorStoreFiles(prev => ({
        ...prev,
        [vectorStoreId]: [vsFile, ...(prev[vectorStoreId] ?? [])],
      }))
    },
    []
  )

  const removeFileFromVectorStore = useCallback(
    async (vectorStoreId: string, fileId: string) => {
      await apiRepository.rag.removeFileFromVectorStore(vectorStoreId, fileId)
      setVectorStoreFiles(prev => ({
        ...prev,
        [vectorStoreId]: (prev[vectorStoreId] ?? []).filter(f => f.id !== fileId),
      }))
    },
    []
  )

  const searchVectorStore = useCallback(
    async (vectorStoreId: string, query: string) => {
      setIsSearching(true)
      try {
        const data = await apiRepository.rag.searchVectorStore(vectorStoreId, query)
        setSearchResults(data.results)
      } finally {
        setIsSearching(false)
      }
    },
    []
  )

  return {
    files,
    vectorStores,
    vectorStoreFiles,
    searchResults,
    isLoadingFiles,
    isLoadingStores,
    isLoadingStoreFiles,
    isUploading,
    isSearching,
    fetchFiles,
    fetchVectorStores,
    fetchVectorStoreFiles,
    uploadFile,
    deleteFile,
    createVectorStore,
    deleteVectorStore,
    addFileToVectorStore,
    removeFileFromVectorStore,
    searchVectorStore,
  }
}
