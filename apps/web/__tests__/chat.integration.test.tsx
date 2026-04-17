/**
 * Frontend↔backend SSE contract integration test.
 *
 * Calls the real streamChat() async generator against a running backend
 * and verifies the SSE protocol contract end-to-end. Catches schema drift
 * (e.g. `query` vs `message` field renames), JSON parse crashes
 * (e.g. JSON.parse("[DONE]")), and stream termination bugs that unit tests
 * structurally cannot catch — because unit tests mock the parser boundary
 * where these bugs live.
 *
 * Requires backend running at TEST_API_URL (default http://localhost:8000).
 * Gated behind RUN_INTEGRATION env flag so CI without a running backend skips cleanly.
 *
 * Run locally:   RUN_INTEGRATION=true npm test chat.integration
 * Run in CI:     spin up backend in the workflow, then RUN_INTEGRATION=true
 */

import { streamChat, type SSEChunk } from "@/lib/api";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "true";
const TIMEOUT_MS = 30_000;

const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describeIf("chat SSE contract — real backend", () => {
  beforeAll(async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${apiBase}/health`).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Backend not reachable at ${apiBase}/health. Start it with ` +
          `'cd apps/api && uvicorn main:app --reload' or unset RUN_INTEGRATION.`,
      );
    }
  });

  it(
    "streams chunks and terminates cleanly on an on-topic question",
    async () => {
      const chunks: SSEChunk[] = [];
      let caughtError: unknown = null;

      try {
        for await (const chunk of streamChat("Where am I staying in Paris?", [])) {
          chunks.push(chunk);
        }
      } catch (err) {
        caughtError = err;
      }

      // (a) At least one non-done chunk was received
      const nonDoneChunks = chunks.filter((c) => c.type !== "done");
      expect(nonDoneChunks.length).toBeGreaterThan(0);

      // (b) Exactly one done event
      const dones = chunks.filter((c) => c.type === "done");
      expect(dones).toHaveLength(1);

      // (c) No parse / network errors bubbled up
      expect(caughtError).toBeNull();

      // (d) done is the terminal event
      expect(chunks[chunks.length - 1].type).toBe("done");

      // (e) No error chunks emitted
      const errors = chunks.filter((c) => c.type === "error");
      expect(errors).toHaveLength(0);
    },
    TIMEOUT_MS,
  );

  it(
    "does not crash on the [DONE] terminator sentinel",
    async () => {
      // Regression: JSON.parse("[DONE]") used to crash the SSE parser.
      // If the generator completes without throwing, the parser is handling
      // the terminator as a sentinel, not as JSON.
      const run = async () => {
        const chunks: SSEChunk[] = [];
        for await (const chunk of streamChat("List all my bookings", [])) {
          chunks.push(chunk);
        }
        return chunks;
      };

      await expect(run()).resolves.toBeDefined();
    },
    TIMEOUT_MS,
  );

  it(
    "emits well-formed events — every chunk has a string `type` field",
    async () => {
      // Catches schema drift: if the backend starts emitting {event: "..."} or
      // {kind: "..."} instead of {type: "..."}, this fails immediately.
      const chunks: SSEChunk[] = [];

      for await (const chunk of streamChat("What's the Paris hotel?", [])) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(typeof chunk.type).toBe("string");
        expect(chunk.type.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT_MS,
  );

  // Enable once the guardrail classifier ships (currently P2 in tester report).
  it.skip(
    "blocks off-topic questions via the guardrail classifier",
    async () => {
      const chunks: SSEChunk[] = [];

      for await (const chunk of streamChat("What is the capital of France?", [])) {
        chunks.push(chunk);
      }

      // Collect streamed text content from token chunks.
      const combined = chunks
        .filter((c): c is Extract<SSEChunk, { type: "token" }> => c.type === "token")
        .map((c) => c.content)
        .join("")
        .toLowerCase();

      // Canned refusal should mention scope.
      expect(combined).toMatch(/trip|itinerary|booking|budget/);
      // And must not leak the off-topic answer.
      expect(combined).not.toMatch(/paris/);
    },
    TIMEOUT_MS,
  );
});