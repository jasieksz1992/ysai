'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { getFirebaseAuth, hasFirebaseConfig } from '@/lib/firebase'
import { useLocalLlm } from '@/hooks/useLocalLlm'
import type { ChatMessage } from '@/hooks/useLocalLlm'

const workspaceStorageKey = 'ysai-local-llm-workspace'
const legacyStorageKey = 'ysai-local-llm-chat-history'
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
- AI photo direction: create high-quality photographic concepts, image prompts, shot lists, style notes, and production-ready descriptions for generated visuals.
- Practical delivery: when coding, provide concise snippets, mention assumptions, and include test or verification steps.`
}

const assistantSkills = ['JavaScript', 'TypeScript', 'React / Next.js', 'UI premium', 'Zdjęcia AI', 'Debugowanie']

type AuthStep = 'idle' | 'email' | 'password'

type StoredChat = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

type StoredProject = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  chats: StoredChat[]
}

type StoredWorkspace = {
  activeProjectId: string
  activeChatId: string
  projects: StoredProject[]
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isConversationMessage = (message: ChatMessage) => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'

const createChat = (title = 'Nowy chat', messages: ChatMessage[] = []): StoredChat => {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages
  }
}

const createProject = (name = 'Nowy projekt', chat = createChat()): StoredProject => {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    chats: [chat]
  }
}

const getChatTitle = (messages: ChatMessage[]) => {
  const firstUserMessage = messages.find(message => message.role === 'user')?.content.trim()
  if (!firstUserMessage) {
    return 'Nowy chat'
  }
  return firstUserMessage.length > 46 ? `${firstUserMessage.slice(0, 46)}…` : firstUserMessage
}

const getProjectName = (projectNumber: number) => `Projekt ${projectNumber}`

const createDefaultWorkspace = (): StoredWorkspace => {
  const chat = createChat()
  const project = createProject('Projekt 1', chat)
  return {
    activeProjectId: project.id,
    activeChatId: chat.id,
    projects: [project]
  }
}

const getActiveProject = (workspace: StoredWorkspace) => workspace.projects.find(project => project.id === workspace.activeProjectId) ?? workspace.projects[0]

const getActiveChat = (workspace: StoredWorkspace) => {
  const activeProject = getActiveProject(workspace)
  return activeProject?.chats.find(chat => chat.id === workspace.activeChatId) ?? activeProject?.chats[0]
}

const normalizeWorkspace = (workspace: StoredWorkspace): StoredWorkspace => {
  const fallback = createDefaultWorkspace()
  const projects = Array.isArray(workspace.projects) ? workspace.projects : []
  const safeProjects = projects
    .filter(project => typeof project.id === 'string' && typeof project.name === 'string' && Array.isArray(project.chats))
    .map(project => {
      const chats = project.chats
        .filter(chat => typeof chat.id === 'string' && typeof chat.title === 'string' && Array.isArray(chat.messages))
        .map(chat => ({
          ...chat,
          messages: chat.messages.filter(isConversationMessage)
        }))
      return {
        ...project,
        chats: chats.length > 0 ? chats : [createChat()]
      }
    })

  if (safeProjects.length === 0) {
    return fallback
  }

  const activeProject = safeProjects.find(project => project.id === workspace.activeProjectId) ?? safeProjects[0]
  const activeChat = activeProject.chats.find(chat => chat.id === workspace.activeChatId) ?? activeProject.chats[0]

  return {
    activeProjectId: activeProject.id,
    activeChatId: activeChat.id,
    projects: safeProjects
  }
}

export default function LocalLlmChat() {
  const [workspace, setWorkspace] = useState<StoredWorkspace>(() => createDefaultWorkspace())
  const [input, setInput] = useState('')
  const [storageLoaded, setStorageLoaded] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [authStep, setAuthStep] = useState<AuthStep>('idle')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
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

  const activeProject = getActiveProject(workspace)
  const activeChat = getActiveChat(workspace)
  const messages = activeChat?.messages ?? []

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setAuthLoaded(true)
      return undefined
    }

    const unsubscribe = onAuthStateChanged(auth, user => {
      setAuthUser(user)
      setAuthLoaded(true)
      if (user) {
        setAuthStep('idle')
        setAuthPassword('')
        setAuthError('')
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    try {
      const savedWorkspace = window.localStorage.getItem(workspaceStorageKey)
      if (savedWorkspace) {
        setWorkspace(normalizeWorkspace(JSON.parse(savedWorkspace) as StoredWorkspace))
        return
      }

      const legacySavedMessages = window.localStorage.getItem(legacyStorageKey)
      if (legacySavedMessages) {
        const parsed = JSON.parse(legacySavedMessages) as ChatMessage[]
        const safeMessages = parsed.filter(isConversationMessage)
        if (safeMessages.length > 0) {
          const chat = createChat(getChatTitle(safeMessages), safeMessages)
          const project = createProject('Projekt 1', chat)
          setWorkspace({ activeProjectId: project.id, activeChatId: chat.id, projects: [project] })
        }
      }
    } catch {
      setWorkspace(createDefaultWorkspace())
    } finally {
      setStorageLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (storageLoaded) {
      window.localStorage.setItem(workspaceStorageKey, JSON.stringify(workspace))
    }
  }, [workspace, storageLoaded])

  useEffect(() => {
    if (hasWebGpu === true && loadState === 'idle') {
      void loadModel()
    }
  }, [hasWebGpu, loadModel, loadState])

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
      return 'Automatycznie uruchamiam asystenta.'
    }
    if (loadState === 'error') {
      return 'Wystąpił błąd podczas uruchamiania asystenta.'
    }
    return 'Your site AI uruchomi się automatycznie.'
  }, [hasWebGpu, loadState])

  const updateActiveChatMessages = (nextMessages: ChatMessage[]) => {
    setWorkspace(currentWorkspace => {
      const now = new Date().toISOString()
      return {
        ...currentWorkspace,
        projects: currentWorkspace.projects.map(project => {
          if (project.id !== currentWorkspace.activeProjectId) {
            return project
          }
          return {
            ...project,
            updatedAt: now,
            chats: project.chats.map(chat => {
              if (chat.id !== currentWorkspace.activeChatId) {
                return chat
              }
              return {
                ...chat,
                title: getChatTitle(nextMessages),
                updatedAt: now,
                messages: nextMessages
              }
            })
          }
        })
      }
    })
  }

  const canWriteMessage = Boolean(authUser)
  const canSend = loadState === 'ready' && input.trim().length > 0 && !isGenerating && canWriteMessage

  const getAuthErrorMessage = (signInError: unknown) => {
    if (!hasFirebaseConfig) {
      return 'Brakuje konfiguracji Firebase. Uzupełnij zmienne NEXT_PUBLIC_FIREBASE_* i wdroż aplikację ponownie.'
    }
    if (signInError instanceof Error) {
      if (signInError.message.includes('auth/invalid-credential') || signInError.message.includes('auth/wrong-password')) {
        return 'Nieprawidłowy e-mail lub hasło.'
      }
      if (signInError.message.includes('auth/user-not-found')) {
        return 'Nie znaleziono użytkownika z tym adresem e-mail.'
      }
      if (signInError.message.includes('auth/too-many-requests')) {
        return 'Za dużo prób logowania. Spróbuj ponownie za chwilę.'
      }
    }
    return 'Nie udało się zalogować przez Firebase. Sprawdź dane i spróbuj ponownie.'
  }

  const requestChatAccess = () => {
    if (!authLoaded || authUser) {
      return
    }
    setAuthError('')
    setAuthStep(currentStep => currentStep === 'idle' ? 'email' : currentStep)
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')

    if (authStep === 'email') {
      if (!authEmail.trim()) {
        setAuthError('Podaj adres e-mail, aby przejść dalej.')
        return
      }
      setAuthStep('password')
      return
    }

    if (!authPassword) {
      setAuthError('Podaj hasło do konta Firebase.')
      return
    }

    const auth = getFirebaseAuth()
    if (!auth) {
      setAuthError(getAuthErrorMessage(new Error('Firebase config missing')))
      return
    }

    setIsSigningIn(true)
    try {
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword)
    } catch (signInError) {
      setAuthError(getAuthErrorMessage(signInError))
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    if (isGenerating) {
      return
    }
    const auth = getFirebaseAuth()
    if (auth) {
      await signOut(auth)
    }
    setAuthStep('idle')
    setAuthPassword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canWriteMessage) {
      requestChatAccess()
      return
    }
    if (!canSend) {
      return
    }
    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim()
    }
    const nextMessages = [...messages, userMessage]
    updateActiveChatMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    try {
      await generate({
        messages: [systemPrompt, ...nextMessages],
        onToken: token => {
          setWorkspace(currentWorkspace => {
            const now = new Date().toISOString()
            return {
              ...currentWorkspace,
              projects: currentWorkspace.projects.map(project => {
                if (project.id !== currentWorkspace.activeProjectId) {
                  return project
                }
                return {
                  ...project,
                  updatedAt: now,
                  chats: project.chats.map(chat => {
                    if (chat.id !== currentWorkspace.activeChatId) {
                      return chat
                    }
                    const updatedMessages = [...chat.messages]
                    const lastMessage = updatedMessages[updatedMessages.length - 1]
                    if (lastMessage?.role === 'assistant') {
                      updatedMessages[updatedMessages.length - 1] = {
                        ...lastMessage,
                        content: lastMessage.content + token
                      }
                    }
                    return {
                      ...chat,
                      updatedAt: now,
                      messages: updatedMessages
                    }
                  })
                }
              })
            }
          })
        }
      })
    } catch {
      setWorkspace(currentWorkspace => ({
        ...currentWorkspace,
        projects: currentWorkspace.projects.map(project => {
          if (project.id !== currentWorkspace.activeProjectId) {
            return project
          }
          return {
            ...project,
            chats: project.chats.map(chat => {
              if (chat.id !== currentWorkspace.activeChatId) {
                return chat
              }
              const updatedMessages = [...chat.messages]
              const lastMessage = updatedMessages[updatedMessages.length - 1]
              if (lastMessage?.role === 'assistant' && !lastMessage.content) {
                updatedMessages[updatedMessages.length - 1] = {
                  role: 'assistant',
                  content: 'Przepraszam, nie udało się przygotować odpowiedzi. Spróbuj ponownie za chwilę.'
                }
              }
              return {
                ...chat,
                messages: updatedMessages
              }
            })
          }
        })
      }))
    }
  }

  const clearChat = () => {
    updateActiveChatMessages([])
  }

  const createNewChat = () => {
    if (isGenerating) {
      return
    }
    const chat = createChat()
    setWorkspace(currentWorkspace => ({
      ...currentWorkspace,
      activeChatId: chat.id,
      projects: currentWorkspace.projects.map(project => {
        if (project.id !== currentWorkspace.activeProjectId) {
          return project
        }
        return {
          ...project,
          updatedAt: chat.createdAt,
          chats: [chat, ...project.chats]
        }
      })
    }))
    setInput('')
  }

  const createNewProject = () => {
    if (isGenerating) {
      return
    }
    const chat = createChat()
    const project = createProject(getProjectName(workspace.projects.length + 1), chat)
    setWorkspace(currentWorkspace => ({
      activeProjectId: project.id,
      activeChatId: chat.id,
      projects: [project, ...currentWorkspace.projects]
    }))
    setInput('')
  }

  const selectProject = (projectId: string) => {
    if (isGenerating) {
      return
    }
    setWorkspace(currentWorkspace => {
      const project = currentWorkspace.projects.find(candidate => candidate.id === projectId)
      if (!project) {
        return currentWorkspace
      }
      return {
        ...currentWorkspace,
        activeProjectId: project.id,
        activeChatId: project.chats[0].id
      }
    })
    setInput('')
  }

  const selectChat = (chatId: string) => {
    if (isGenerating) {
      return
    }
    setWorkspace(currentWorkspace => ({
      ...currentWorkspace,
      activeChatId: chatId
    }))
    setInput('')
  }

  return (
    <main className="app-shell">
      <section className="workspace-card" aria-label="Your site AI workspace">
        <aside className="workspace-sidebar" aria-label="Projekty i zapisane chaty">
          <div className="sidebar-section sidebar-header">
            <p className="eyebrow">Workspace</p>
            <h2>Projekty</h2>
            <button className="button sidebar-button" type="button" onClick={createNewProject} disabled={isGenerating}>
              + Nowy projekt
            </button>
          </div>

          <div className="project-list">
            {workspace.projects.map(project => (
              <button
                className={`project-item ${project.id === activeProject?.id ? 'active' : ''}`}
                key={project.id}
                type="button"
                onClick={() => selectProject(project.id)}
                disabled={isGenerating}
              >
                <span>{project.name}</span>
                <small>{project.chats.length} chat{project.chats.length === 1 ? '' : 'y'}</small>
              </button>
            ))}
          </div>

          <div className="sidebar-section chat-history-header">
            <h3>Chaty w projekcie</h3>
            <button className="button secondary sidebar-button" type="button" onClick={createNewChat} disabled={isGenerating}>
              + Nowy chat
            </button>
          </div>

          <div className="chat-list">
            {activeProject?.chats.map(chat => (
              <button
                className={`chat-item ${chat.id === activeChat?.id ? 'active' : ''}`}
                key={chat.id}
                type="button"
                onClick={() => selectChat(chat.id)}
                disabled={isGenerating}
              >
                <span>{chat.title}</span>
                <small>{chat.messages.length} wiadomości</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-card" aria-label="Your site AI chat">
          <header className="chat-header">
            <div className="header-copy">
              <p className="eyebrow">Premium assistant for web teams</p>
              <h1>Your site AI</h1>
              <p className="subtitle">
                Rozmawiaj o produktach cyfrowych, kodzie i jakości interfejsu. AI startuje automatycznie, a każdy projekt ma własne zapisane chaty.
              </p>
              <div className="skill-list" aria-label="Umiejętności asystenta">
                {assistantSkills.map(skill => (
                  <span className="skill-chip" key={skill}>{skill}</span>
                ))}
              </div>
            </div>
            <div className="header-actions">
              <button className="button secondary" type="button" onClick={loadModel} disabled={loadState === 'loading' || loadState === 'ready' || hasWebGpu === false}>
                {loadState === 'ready' ? 'Gotowy' : loadState === 'loading' ? 'Uruchamianie...' : 'Ponów start AI'}
              </button>
              <button className="button secondary" type="button" onClick={createNewChat} disabled={isGenerating}>
                Nowy chat
              </button>
              {authUser ? (
                <button className="button secondary" type="button" onClick={handleSignOut} disabled={isGenerating}>
                  Wyloguj {authUser.email}
                </button>
              ) : null}
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
              Aktywny kontekst: <strong>{activeProject?.name}</strong> / <strong>{activeChat?.title}</strong>. Długie odpowiedzi są zawijane i przewijane w obrębie wiadomości.
            </div>
            <div className={`notice ${authUser ? '' : 'warning'}`}>
              Dostęp do pisania: {authUser ? <strong>zalogowano jako {authUser.email}</strong> : 'chat jest widoczny, ale przed wysłaniem wiadomości poprosimy o e-mail, a potem hasło Firebase.'}
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
                <span>Zadaj pytanie o JavaScript, TypeScript, React, Next.js albo dopracowanie UI. Asystent startuje sam, a rozmowa zapisze się w aktualnym projekcie.</span>
              </div>
            ) : (
              messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <span className="message-label">{message.role === 'user' ? 'Ty' : 'Your site AI'}</span>
                  <div className="message-content">{message.content || 'Piszę odpowiedź...'}</div>
                </article>
              ))
            )}
            <div ref={endRef} />
          </div>
          {!authUser && authStep !== 'idle' ? (
            <form className="auth-panel" onSubmit={handleAuthSubmit}>
              <div>
                <p className="auth-kicker">Bezpieczny dostęp Firebase</p>
                <h2>{authStep === 'email' ? 'Najpierw podaj e-mail' : 'Teraz wpisz hasło'}</h2>
                <p>
                  Your site AI pozostaje widoczny, ale pisanie w chacie wymaga zalogowania do konta Firebase.
                </p>
              </div>
              <label className="auth-field">
                <span>E-mail</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={event => setAuthEmail(event.target.value)}
                  autoComplete="email"
                  disabled={authStep === 'password' || isSigningIn}
                  placeholder="twoj@email.pl"
                />
              </label>
              {authStep === 'password' ? (
                <label className="auth-field">
                  <span>Hasło</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={event => setAuthPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={isSigningIn}
                    placeholder="Hasło Firebase"
                  />
                </label>
              ) : null}
              {authError ? <div className="notice error">{authError}</div> : null}
              <div className="auth-actions">
                {authStep === 'password' ? (
                  <button className="button secondary" type="button" onClick={() => setAuthStep('email')} disabled={isSigningIn}>
                    Zmień e-mail
                  </button>
                ) : null}
                <button className="button" type="submit" disabled={isSigningIn || !authLoaded}>
                  {authStep === 'email' ? 'Dalej' : isSigningIn ? 'Logowanie...' : 'Zaloguj i odblokuj chat'}
                </button>
              </div>
            </form>
          ) : null}
          <form className="composer" onSubmit={handleSubmit}>
            <div className="input-row">
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onFocus={requestChatAccess}
                placeholder={authUser ? (loadState === 'ready' ? 'Napisz, co chcesz zbudować albo poprawić...' : 'AI uruchamia się automatycznie — poczekaj chwilę...') : 'Kliknij i wpisz wiadomość — przed wysłaniem poprosimy o e-mail, a potem hasło.'}
                disabled={loadState !== 'ready' || isGenerating}
                aria-label="Treść wiadomości"
              />
              {isGenerating ? (
                <button className="button secondary" type="button" onClick={stopGeneration}>
                  Zatrzymaj
                </button>
              ) : (
                <button className="button" type="submit" disabled={authUser ? !canSend : loadState !== 'ready' || input.trim().length === 0}>
                  {authUser ? 'Wyślij' : 'Zaloguj, aby wysłać'}
                </button>
              )}
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}
