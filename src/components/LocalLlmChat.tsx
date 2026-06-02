'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalLlm } from '@/hooks/useLocalLlm'
import type { ChatMessage } from '@/hooks/useLocalLlm'

const storageKey = 'ysai-local-llm-chat-history'
const systemPrompt: ChatMessage = {
  role: 'system',
  content: `You are Your site AI: a premium, practical assistant for users building and improving websites, apps, and digital products.

Communication rules:
- Match the user's language. If the user writes in Polish, answer in clear, natural Polish.
- Be understandable: start with the direct answer, use short sections, bullets, and concrete next steps.
- Avoid vague wording and unnecessary technical jargon; explain terms when they matter.
- Do not mention internal hosting, privacy, local inference, API routes, Firebase static export, backend details, or model/runtime names unless the user explicitly asks about implementation.
- Never write generic marketing/privacy boilerplate to the user; focus on the actual answer and useful next steps.

Core skills:
- JavaScript: write, debug, refactor, and explain modern JS for browsers, Node.js, and UI logic.
- TypeScript: design typed APIs, fix compiler errors, improve types, and explain TS decisions clearly.
- Frontend: help with React, Next.js, component structure, accessibility, forms, and state management.
- UI/UX: propose premium layouts, copy, hierarchy, spacing, and interaction improvements.
- Practical delivery: when coding, provide concise snippets, mention assumptions, and include test or verification steps.`
}

const assistantSkills = ['JavaScript', 'TypeScript', 'React / Next.js', 'UI premium', 'Debugowanie']

export default function LocalLlmChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [storageLoaded, setStorageLoaded] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const {
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
      return 'Ta przeglądarka nie obsługuje wymaganej akceleracji.'
    }
    if (loadState === 'ready') {
      return 'Your site AI jest gotowy do rozmowy.'
    }
    if (loadState === 'loading') {
      return 'Przygotowuję asystenta do pracy.'
    }
    if (loadState === 'error') {
      return 'Wystąpił błąd podczas uruchamiania asystenta.'
    }
    return 'Uruchom asystenta i rozpocznij rozmowę.'
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
            content: 'Przepraszam, nie udało się przygotować odpowiedzi. Spróbuj ponownie za chwilę.'
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
      <section className="chat-card" aria-label="Your site AI chat">
        <header className="chat-header">
          <div className="header-copy">
            <p className="eyebrow">Premium assistant for web teams</p>
            <h1>Your site AI</h1>
            <p className="subtitle">
              Rozmawiaj o produktach cyfrowych, kodzie i jakości interfejsu z asystentem, który odpowiada konkretnie, jasno i praktycznie.
            </p>
            <div className="skill-list" aria-label="Umiejętności asystenta">
              {assistantSkills.map(skill => (
                <span className="skill-chip" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
          <div className="header-actions">
            <button className="button" type="button" onClick={loadModel} disabled={loadState === 'loading' || loadState === 'ready' || hasWebGpu === false}>
              {loadState === 'ready' ? 'Gotowy' : loadState === 'loading' ? 'Uruchamianie...' : 'Uruchom AI'}
            </button>
            <button className="button danger" type="button" onClick={clearChat} disabled={messages.length === 0 || isGenerating}>
              Wyczyść
            </button>
          </div>
        </header>
        <div className="status-panel">
          <div className="status-row">
            <span>{statusText}</span>
            <strong>{Math.round(progress * 100)}%</strong>
          </div>
          <div className="progress-track" aria-label="Postęp uruchamiania asystenta">
            <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="notice">
            Tip: zadawaj pytania z kontekstem, np. „napisz komponent w TypeScript” albo „popraw UX formularza logowania”.
          </div>
          {hasWebGpu === false ? (
            <div className="notice warning">Uruchomienie wymaga nowszej przeglądarki z obsługą akceleracji WebGPU.</div>
          ) : null}
          {loadState === 'loading' ? <div className="notice warning">{progressText}</div> : null}
          {error ? <div className="notice error">Błąd: {error}</div> : null}
        </div>
        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <strong>Gotowy do pracy nad Twoją stroną</strong>
              <span>Zadaj pytanie o JavaScript, TypeScript, React, Next.js albo dopracowanie UI. Asystent odpowie krótko, konkretnie i krok po kroku.</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="message-label">{message.role === 'user' ? 'Ty' : 'Your site AI'}</span>
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
              placeholder={loadState === 'ready' ? 'Napisz, co chcesz zbudować albo poprawić...' : 'Najpierw uruchom Your site AI...'}
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
        </form>
      </section>
    </main>
  )
}
