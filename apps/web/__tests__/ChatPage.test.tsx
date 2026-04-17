import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Navigation from "@/components/Navigation"
import ChatPage from "@/app/chat/page"
import { streamChat } from "@/lib/api"
import type { SSEChunk } from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  usePathname: () => "/chat",
}))

jest.mock("@/lib/api", () => ({
  streamChat: jest.fn(),
}))

const mockStreamChat = streamChat as jest.MockedFunction<typeof streamChat>

// ── Fixtures ───────────────────────────────────────────────────────────────────

async function* makeStream(chunks: SSEChunk[]): AsyncGenerator<SSEChunk> {
  for (const chunk of chunks) {
    yield chunk
  }
}

const ANSWER_STREAM: SSEChunk[] = [
  { type: "token", content: "You are " },
  { type: "token", content: "at Hotel Metropole." },
  { type: "sources", sources: [{ label: "Jun 27 — Interlaken", date: "2026-06-27" }] },
  { type: "done" },
]

beforeEach(() => {
  jest.clearAllMocks()
})

// ── 1: Suggested questions in empty state ──────────────────────────────────────

it("shows suggested questions in empty state", () => {
  render(<ChatPage />)
  const buttons = screen.getAllByRole("button", { name: /\?/ })
  expect(buttons.length).toBeGreaterThanOrEqual(3)
})

// ── 2: Clicking suggestion sends it ───────────────────────────────────────────

it("clicking a suggested question calls streamChat", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  const [firstQuestion] = screen.getAllByRole("button", { name: /\?/ })
  await userEvent.click(firstQuestion)
  await waitFor(() => {
    expect(mockStreamChat).toHaveBeenCalledTimes(1)
  })
})

// ── 3: Suggested questions hidden after first message ─────────────────────────

it("hides suggested questions once a message has been sent", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  const starters = screen.getAllByRole("button", { name: /\?/ })
  await userEvent.click(starters[0])
  await waitFor(() => {
    // starter chips are rendered only in the empty state — they should be gone
    expect(screen.queryAllByRole("button", { name: /\?/ })).toHaveLength(0)
  })
})

// ── 4: Typing indicator shown while streaming ──────────────────────────────────

it("shows typing indicator while stream is blocked", async () => {
  let resolveStream!: () => void
  async function* slowStream(): AsyncGenerator<SSEChunk> {
    await new Promise<void>((res) => {
      resolveStream = res
    })
    yield { type: "done" }
  }
  mockStreamChat.mockReturnValue(slowStream())
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  expect(screen.getByTestId("typing-indicator")).toBeInTheDocument()
  act(() => {
    resolveStream()
  })
  await waitFor(() =>
    expect(screen.queryByTestId("typing-indicator")).not.toBeInTheDocument(),
  )
})

// ── 5: Tokens accumulate into assistant message ────────────────────────────────

it("accumulates streamed tokens into the assistant message", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Where are we staying?")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  await waitFor(() => {
    expect(screen.getByText("You are at Hotel Metropole.")).toBeInTheDocument()
  })
})

// ── 6: Input disabled while streaming ─────────────────────────────────────────

it("disables the text input while streaming", async () => {
  let resolveStream!: () => void
  async function* slowStream(): AsyncGenerator<SSEChunk> {
    await new Promise<void>((res) => {
      resolveStream = res
    })
    yield { type: "done" }
  }
  mockStreamChat.mockReturnValue(slowStream())
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  expect(screen.getByRole("textbox")).toBeDisabled()
  act(() => {
    resolveStream()
  })
  await waitFor(() => expect(screen.getByRole("textbox")).not.toBeDisabled())
})

// ── 7: Input re-enabled after stream completes ────────────────────────────────

it("re-enables input after stream completes", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  await waitFor(() => {
    expect(screen.getByRole("textbox")).not.toBeDisabled()
  })
})

// ── 8: Send button disabled while streaming ────────────────────────────────────

it("disables send button while streaming", async () => {
  let resolveStream!: () => void
  async function* slowStream(): AsyncGenerator<SSEChunk> {
    await new Promise<void>((res) => {
      resolveStream = res
    })
    yield { type: "done" }
  }
  mockStreamChat.mockReturnValue(slowStream())
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  act(() => {
    resolveStream()
  })
  // confirm streaming stopped (input re-enabled is the reliable signal)
  await waitFor(() => expect(screen.getByRole("textbox")).not.toBeDisabled())
})

// ── 9: Citations appear below AI response ─────────────────────────────────────

it("shows citation labels below assistant message when sources are present", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Where on Jun 27?")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  await waitFor(() => {
    expect(screen.getByText("Jun 27 — Interlaken")).toBeInTheDocument()
  })
})

// ── 10: No citations section when sources empty ───────────────────────────────

it("does not render citations section when sources array is empty", async () => {
  const noSourceStream: SSEChunk[] = [
    { type: "token", content: "Great question!" },
    { type: "sources", sources: [] },
    { type: "done" },
  ]
  mockStreamChat.mockReturnValue(makeStream(noSourceStream))
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "How are you?")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  await waitFor(() => {
    expect(screen.queryByTestId("citations")).not.toBeInTheDocument()
  })
})

// ── 11: Error banner on stream failure ────────────────────────────────────────

it("shows an error alert when the stream throws", async () => {
  async function* errorStream(): AsyncGenerator<SSEChunk> {
    throw new Error("Network error")
  }
  mockStreamChat.mockReturnValue(errorStream())
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello")
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})

// ── 12: Enter key submits ─────────────────────────────────────────────────────

it("submits the message when Enter is pressed", async () => {
  mockStreamChat.mockReturnValue(makeStream(ANSWER_STREAM))
  render(<ChatPage />)
  await userEvent.type(screen.getByRole("textbox"), "Hello{Enter}")
  await waitFor(() => {
    expect(mockStreamChat).toHaveBeenCalledTimes(1)
  })
})

// ── 13: Empty input does not submit ───────────────────────────────────────────

it("does not call streamChat when input is empty and send is clicked", async () => {
  render(<ChatPage />)
  await userEvent.click(screen.getByRole("button", { name: /send/i }))
  expect(mockStreamChat).not.toHaveBeenCalled()
})

// ── 14: Send button disabled when input empty ─────────────────────────────────

it("send button is disabled when the input field is empty", () => {
  render(<ChatPage />)
  expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
})

// ── 15: Navigation Chat tab links to /chat ────────────────────────────────────

it("navigation Chat tab is a real link pointing to /chat", () => {
  render(<Navigation />)
  // Both desktop and mobile render a Chat link — check all of them
  const chatLinks = screen.getAllByRole("link", { name: /chat/i })
  expect(chatLinks.length).toBeGreaterThanOrEqual(1)
  expect(chatLinks[0]).toHaveAttribute("href", "/chat")
})
