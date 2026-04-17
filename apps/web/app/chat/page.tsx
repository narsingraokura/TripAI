"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { streamChat } from "@/lib/api"
import type { ChatMessage, ChatSource } from "@/lib/api"

type UIMessage = {
  role: "user" | "assistant"
  content: string
  sources?: ChatSource[]
}

const STARTERS = [
  "What hotel are we staying at on Jun 26?",
  "What's the plan for the kids on Jul 1?",
  "Are we under budget so far?",
]

function TypingIndicator() {
  return (
    <div data-testid="typing-indicator" className="flex items-center gap-1 bg-slate-100 rounded-2xl px-4 py-3">
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      const history: ChatMessage[] = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      setMessages((prev) => [...prev, { role: "user", content: trimmed }])
      setInput("")
      setError(null)
      setIsStreaming(true)
      setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }])

      try {
        for await (const chunk of streamChat(trimmed, history)) {
          if (chunk.type === "token") {
            setMessages((prev) => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.content += chunk.content
              updated[updated.length - 1] = last
              return updated
            })
          } else if (chunk.type === "sources") {
            setMessages((prev) => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.sources = chunk.sources
              updated[updated.length - 1] = last
              return updated
            })
          }
        }
      } catch {
        setError("Something went wrong. Please try again.")
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, isStreaming],
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      void send(input)
    },
    [send, input],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        void send(input)
      }
    },
    [send, input],
  )

  const showTypingIndicator =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === ""

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)]">
      {/* message history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-slate-500 text-sm">Ask anything about your trip</p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => void send(q)}
                  className="text-sm text-left bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-3 rounded-xl border border-slate-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isLastStreaming =
                isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.content === ""
              if (isLastStreaming) return null
              return (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div data-testid="citations" className="mt-2 flex flex-wrap gap-1.5">
                        {msg.sources.map((s) => (
                          <span
                            key={s.date}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              msg.role === "user"
                                ? "bg-white/20 text-white"
                                : "bg-white text-slate-600 border border-slate-200"
                            }`}
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {showTypingIndicator && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
          </>
        )}
      </div>

      {/* error banner */}
      {error !== null && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-4 py-3"
      >
        <input
          type="text"
          role="textbox"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your trip…"
          disabled={isStreaming}
          aria-label="Message input"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim() || isStreaming}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
