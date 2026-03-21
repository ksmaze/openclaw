import { beforeEach, describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import * as harness from "./openclaw-tools.subagents.sessions-spawn.test-harness.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

const MAIN_SESSION_KEY = "agent:test:main";

type AnnounceTarget = "channel" | "parent";

function applyAnnounceTargetDefault(announceTarget: AnnounceTarget) {
  harness.setSessionsSpawnConfigOverride({
    session: { mainKey: "main", scope: "per-sender" },
    agents: { defaults: { subagents: { announceTarget } } },
  });
}

async function expectAnnounceTarget(input: {
  callId: string;
  payload: Record<string, unknown>;
  expected: AnnounceTarget;
}) {
  harness.setupSessionsSpawnGatewayMock({});
  const tool = await harness.getSessionsSpawnTool({ agentSessionKey: MAIN_SESSION_KEY });
  const result = await tool.execute(input.callId, input.payload);
  expect(result.details).toMatchObject({ status: "accepted" });

  const childSessionKey =
    typeof result.details === "object" &&
    result.details &&
    "childSessionKey" in result.details &&
    typeof result.details.childSessionKey === "string"
      ? result.details.childSessionKey
      : undefined;
  const { getSubagentRunByChildSessionKey } = await import("./subagent-registry.js");
  const run = childSessionKey ? getSubagentRunByChildSessionKey(childSessionKey) : null;
  expect(run?.announceTarget).toBe(input.expected);
}

describe("sessions_spawn announceTarget defaults", () => {
  beforeEach(() => {
    harness.resetSessionsSpawnConfigOverride();
    resetSubagentRegistryForTests();
    harness.getCallGatewayMock().mockClear();
    applyAnnounceTargetDefault("parent");
  });

  it("applies agents.defaults.subagents.announceTarget when omitted", async () => {
    await expectAnnounceTarget({
      callId: "call-1",
      payload: { task: "hello" },
      expected: "parent",
    });
  });

  it("prefers explicit sessions_spawn.announceTarget over config default", async () => {
    await expectAnnounceTarget({
      callId: "call-2",
      payload: { task: "hello", announceTarget: "channel" },
      expected: "channel",
    });
  });
});
