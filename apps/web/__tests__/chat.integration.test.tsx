/**
 * Frontend↔backend SSE contract integration test.
 *
 * Calls the real streamChat() against a running backend and verifies the
 * SSE protocol contract end-to-end. Catches schema drift (e.g. `query`
 * vs `message` field renames), JSON parse crashes (e.g. `JSON.parse("[DONE]")`),
 * and stream termination bugs that unit tests structurally cannot catch —
 * because unit tests mock the parser boundary where these bugs live.
 *
 * Requires backend running at TEST_API_URL (default http://localhost:8000).
 * Skip when backend is unavailable via RUN_INTEGRATION=false.
 *
 * Run locally:   RUN_INTEGRATION=true npm test chat.integration
 * Run in CI:     spin up backend in the workflow, then RUN_INTEGRATION=true
 */

import { streamChat } from "@/lib/api";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "true";
const TEST_API_URL = process.env.TEST_API_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 30_000;

type ChatEvent = { type: string; content?: string; [k: string]: unknown };

const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describeIf("chat SSE contract — real backend", () => {
  beforeAll(async () => {
    // Fail fast and loud if the backend isn't reachable. Silent skips
    // are how integration tests decay into decoration.
    const res = await fetch(`${TEST_API_URL}/health`).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Backend not reachable at ${TEST_API_URL}. Start it with ` +
          `'cd apps/api && uvicorn main:app --reload' or set RUN_INTEGRATION=false.`
      );
    }
  });

  it(
    "streams tokens and terminates cleanly on an on-topic question",
    async () => {
      const events: ChatEvent[] = [];
      let caughtError: unknown = null;

      try {
        await streamChat({
          message: "Where am I staying in Paris?",
          onEvent: (event: ChatEvent) => events.push(event),
        });
      } catch (err) {
        caughtError = err;
      }

      // (a) At least one text token was received
      const tokens = events.filter((e) => e.type === "text");
      expect(tokens.length).toBeGreaterThan(0);

      // (b) Exactly one done event
      const dones = events.filter((e) => e.type === "done");
      expect(dones).toHaveLength(1);

      // (c) No JSON parse errors bubbled up
      expect(caughtError).toBeNull();

      // (d) done is the terminal event
      expect(events[events.length - 1].type).toBe("done");
    },
    TIMEOUT_MS
  );

  it(
    "does not crash on the [DONE] terminator sentinel",
    async () => {
      // Regression test for the round-1/2 bug: JSON.parse("[DONE]") crashed
      // the SSE consumer. If streamChat() resolves without throwing, the
      // parser is handling the terminator as a sentinel, not JSON.
      await expect(
        streamChat({
          message: "List all my bookings",
          onEvent: () => {},
        })
      ).resolves.not.toThrow();
    },
    TIMEOUT_MS
  );

  it(
    "emits well-formed events — every event has a string `type` field",
    async () => {
      // Catches schema drift: if the backend starts emitting `{"event": "text"}`
      // or `{"kind": "text"}`, this fails immediately.
      const events: ChatEvent[] = [];

      await streamChat({
        message: "What's the Paris hotel?",
        onEvent: (event: ChatEvent) => events.push(event),
      });

      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(typeof event.type).toBe("string");
        expect(event.type.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT_MS
  );

  // Enable once the guardrail classifier ships (current P2).
  it.skip(
    "blocks off-topic questions via the guardrail classifier",
    async () => {
      const events: ChatEvent[] = [];

      await streamChat({
        message: "What is the capital of France?",
        onEvent: (event: ChatEvent) => events.push(event),
      });

      const combined = events
        .filter((e) => e.type === "text")
        .map((e) => e.content ?? "")
        .join("")
        .toLowerCase();

      // Canned refusal mentions scope
      expect(combined).toMatch(/trip|itinerary|booking|budget/);
      // Does NOT leak the off-topic answer
      expect(combined).not.toMatch(/paris/);
    },
    TIMEOUT_MS
  );
});