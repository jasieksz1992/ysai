'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalLlm } from '@/hooks/useLocalLlm'
import type { ChatMessage } from '@/hooks/useLocalLlm'

const storageKey = 'ysai-local-llm-chat-history'
const systemPrompt: ChatMessage = {
  role: 'system',
  content: 'You are a helpful local AI assistant. Answer clearly and practically.'
}

export default function LocalLlmChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [storageLoaded, setStorageLoaded] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const {
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
  } = useLocalLlm()

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[]
        const safeMessages = parsed.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
        setMessages(safeMessages)
      }
    } catch {
      setMessages([])
    } finally {
      setStorageLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (storageLoaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(messages))
    }
  }, [messages, storageLoaded])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const statusText = useMemo(() => {
    if (hasWebGpu === false) {
      return 'WebGPU nie jest dostępne w tej przeglądarce.'
    }
    if (loadState === 'ready') {
      return 'Model lokalny jest gotowy.'
    }
    if (loadState === 'loading') {
      return 'Model ładuje się lokalnie w przeglądarce.'
    }
    if (loadState === 'error') {
      return 'Wystąpił błąd podczas pracy z modelem.'
    }
    return 'Kliknij przycisk, aby ręcznie załadować model.'
  }, [hasWebGpu, loadState])

  const canSend = loadState === 'ready' && input.trim().length > 0 && !isGenerating

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSend) {
      return
    }
    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim()
    }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    try {
      await generate({
        messages: [systemPrompt, ...nextMessages],
        onToken: token => {
          setMessages(currentMessages => {
            const updated = [...currentMessages]
            const lastMessage = updated[updated.length - 1]
            if (lastMessage?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + token
              }
            }
            return updated
          })
        }
      })
    } catch {
      setMessages(currentMessages => {
        const updated = [...currentMessages]
        const lastMessage = updated[updated.length - 1]
        if (lastMessage?.role === 'assistant' && !lastMessage.content) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Przepraszam, nie udało się wygenerować odpowiedzi lokalnie.'
          }
        }
        return updated
      })
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <main className="app-shell">
      <section className="chat-card" aria-label="Lokalny czat AI">
        <header className="chat-header">
          <div className="header-copy">
            <p className="eyebrow">WebLLM bez backendu</p>
            <h1>Lokalny Asystent AI</h1>
            <p className="subtitle">
              Darmowy czat z modelem {modelId}, uruchamiany w całości w Twojej przeglądarce i eksportowany jako statyczna strona dla Firebase Hosting.
            </p>
          </div>
          <div className="header-actions">
            <button className="button" type="button" onClick={loadModel} disabled={loadState === 'loading' || loadState === 'ready' || hasWebGpu === false}>
              {loadState === 'ready' ? 'Model załadowany' : loadState === 'loading' ? 'Ładowanie...' : 'Załaduj model'}
            </button>
            <button className="button danger" type="button" onClick={clearChat} disabled={messages.length === 0 || isGenerating}>
              Wyczyść czat
            </button>
          </div>
        </header>
        <div className="status-panel">
          <div className="status-row">
            <span>{statusText}</span>
            <strong>{Math.round(progress * 100)}%</strong>
          </div>
          <div className="progress-track" aria-label="Postęp ładowania modelu">
            <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="notice">
            Prywatność: prompt i odpowiedzi nie są wysyłane do API. Inferencja działa lokalnie w przeglądarce, a historia jest zapisywana tylko w localStorage tego urządzenia.
          </div>
          {hasWebGpu === false ? (
            <div className="notice warning">WebGPU nie jest obsługiwane. Bez WebGPU lokalny model WebLLM nie może zostać uruchomiony.</div>
          ) : null}
          {loadState === 'loading' ? <div className="notice warning">{progressText}</div> : null}
          {error ? <div className="notice error">Błąd: {error}</div> : null}
        </div>
        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <strong>Brak wiadomości</strong>
              <span>Załaduj model, wpisz pytanie i rozpocznij lokalną rozmowę. Pierwsze ładowanie może potrwać dłużej, bo model pobiera się do pamięci podręcznej przeglądarki.</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="message-label">{message.role === 'user' ? 'Ty' : 'Asystent'}</span>
                {message.content || 'Piszę odpowiedź...'}
              </article>
            ))
          )}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={handleSubmit}>
          <div className="input-row">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={loadState === 'ready' ? 'Napisz wiadomość...' : 'Najpierw załaduj lokalny model...'}
              disabled={loadState !== 'ready' || isGenerating}
              aria-label="Treść wiadomości"
            />
            {isGenerating ? (
              <button className="button secondary" type="button" onClick={stopGeneration}>
                Zatrzymaj
              </button>
            ) : (
              <button className="button" type="submit" disabled={!canSend}>
                Wyślij
              </button>
            )}
          </div>
          <p className="helper-text">Aplikacja nie zawiera tras API, akcji serwerowych ani kluczy API. Firebase służy wyłącznie do hostowania statycznych plików z katalogu out.</p>
        </form>
      </section>
    </main>
  )
}
