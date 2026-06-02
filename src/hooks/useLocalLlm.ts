'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatCompletionMessageParam, MLCEngineInterface } from '@mlc-ai/web-llm'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type GenerateOptions = {
  messages: ChatMessage[]
  onToken: (token: string) => void
}

const defaultModelId = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

export function useLocalLlm() {
  const engineRef = useRef<MLCEngineInterface | null>(null)
  const [modelId] = useState(defaultModelId)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('Model nie został jeszcze załadowany.')
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasWebGpu, setHasWebGpu] = useState<boolean | null>(null)

  useEffect(() => {
    setHasWebGpu(typeof navigator !== 'undefined' && 'gpu' in navigator)
  }, [])

  const loadModel = useCallback(async () => {
    if (loadState === 'loading' || loadState === 'ready') {
      return
    }
    if (hasWebGpu === false) {
      setError('Twoja przeglądarka nie obsługuje wymaganej akceleracji WebGPU. Spróbuj aktualnej wersji Chrome, Edge albo innej nowoczesnej przeglądarki.')
      setLoadState('error')
      return
    }
    setError('')
    setLoadState('loading')
    setProgress(0)
    setProgressText('Przygotowywanie silnika AI...')
    try {
      const webllm = await import('@mlc-ai/web-llm')
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: report => {
          setProgress(Math.max(0, Math.min(1, report.progress)))
          setProgressText(report.text || 'Ładowanie lokalnego modelu...')
        }
      })
      engineRef.current = engine
      setProgress(1)
      setProgressText('Model jest gotowy do rozmowy.')
      setLoadState('ready')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Nie udało się załadować modelu.'
      setError(message)
      setProgressText('Ładowanie modelu nie powiodło się.')
      setLoadState('error')
    }
  }, [hasWebGpu, loadState, modelId])

  const generate = useCallback(async ({ messages, onToken }: GenerateOptions) => {
    if (!engineRef.current || isGenerating) {
      return ''
    }
    setError('')
    setIsGenerating(true)
    let response = ''
    try {
      const stream = await engineRef.current.chat.completions.create({
        messages: messages as ChatCompletionMessageParam[],
        stream: true,
        temperature: 0.7,
        max_tokens: 768
      })
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta.content || ''
        if (token) {
          response += token
          onToken(token)
        }
      }
      return response
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : 'Nie udało się wygenerować odpowiedzi.'
      setError(message)
      throw generateError
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating])

  const stopGeneration = useCallback(async () => {
    if (!engineRef.current) {
      return
    }
    try {
      await engineRef.current.interruptGenerate()
    } catch (stopError) {
      const message = stopError instanceof Error ? stopError.message : 'Nie udało się zatrzymać generowania.'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return {
    modelId,
    loadState,
    progress,
    progressText,
    error,
    isGenerating,
    hasWebGpu,
    loadModel,
    generate,
    stopGeneration
  }
}
