import assert from "node:assert/strict";
import {
  DialogueController,
  DialogueEvents,
  DialogueFlagStore,
  createDialogueTree,
} from "../src/systems/dialogue/index.js";

const tree = createDialogueTree({
  id: "test-npc-dialogue",
  npcId: "npc-test",
  speakers: {
    guide: { name: "Guide" },
    player: { name: "Player" },
  },
  startNodeId: "start",
  nodes: {
    start: {
      id: "start",
      speakerId: "guide",
      text: "Welcome back.",
      next: [
        { condition: { allFlags: ["quest.accepted"] }, target: "post-quest" },
        { target: "offer-quest" },
      ],
    },
    "offer-quest": {
      id: "offer-quest",
      speakerId: "player",
      text: "Do you have work for me?",
      choices: [
        {
          id: "accept",
          text: "I can help.",
          next: "quest-details",
          hooks: [
            {
              id: "quest-accept-hook",
              once: true,
              setFlags: {
                "quest.accepted": true,
              },
              emitEvent: {
                name: "quest:accepted",
                payload: { questId: "quest-alpha" },
              },
              callbackId: "onQuestAccepted",
            },
          ],
        },
        {
          id: "decline",
          text: "Not right now.",
          next: "goodbye",
        },
      ],
    },
    "quest-details": {
      id: "quest-details",
      speakerId: "guide",
      text: "Clear the eastern path and report back.",
      next: "goodbye",
    },
    "post-quest": {
      id: "post-quest",
      speakerId: "guide",
      text: "You already accepted the task. Good luck.",
      next: "goodbye",
    },
    goodbye: {
      id: "goodbye",
      speakerId: "guide",
      text: "Safe travels.",
    },
  },
});

let callbackInvocations = 0;
const flagStore = new DialogueFlagStore();
const controller = new DialogueController({
  flagStore,
  callbackMap: {
    onQuestAccepted: () => {
      callbackInvocations += 1;
    },
  },
});

const eventLog = {
  nodeChanges: [],
  hookEvents: [],
  questAccepted: [],
  ended: [],
};

controller.on(DialogueEvents.NODE_CHANGED, (payload) => eventLog.nodeChanges.push(payload.nodeId));
controller.on(DialogueEvents.HOOK_TRIGGERED, (payload) => eventLog.hookEvents.push(payload.hookId));
controller.on("quest:accepted", (payload) => eventLog.questAccepted.push(payload.payload?.questId ?? null));
controller.on(DialogueEvents.ENDED, (payload) => eventLog.ended.push(payload.reason));

const startSnapshot = controller.startConversation({ npcId: "npc-test", tree });
assert.equal(startSnapshot.nodeId, "start");
assert.equal(startSnapshot.speaker.name, "Guide");
assert.equal(controller.isActive(), true);

const afterAdvance = controller.advance();
assert.equal(afterAdvance.nodeId, "offer-quest");
assert.equal(afterAdvance.choices.length, 2);

const afterAcceptChoice = controller.selectChoice("accept");
assert.equal(afterAcceptChoice.nodeId, "quest-details");
assert.equal(flagStore.getFlag("quest.accepted"), true);
assert.equal(callbackInvocations, 1);
assert.deepEqual(eventLog.questAccepted, ["quest-alpha"]);
assert.ok(eventLog.hookEvents.includes("quest-accept-hook"));

const afterQuestAdvance = controller.advance();
assert.equal(afterQuestAdvance.nodeId, "goodbye");

const afterFirstBack = controller.goBack();
assert.equal(afterFirstBack.nodeId, "quest-details");

const afterSecondBack = controller.goBack();
assert.equal(afterSecondBack.nodeId, "offer-quest");

const afterDeclineChoice = controller.selectChoice("decline");
assert.equal(afterDeclineChoice.nodeId, "goodbye");

controller.advance();
assert.equal(controller.isActive(), false);
assert.ok(eventLog.ended.includes("completed"));

const secondConversation = controller.startConversation({ npcId: "npc-test", tree });
assert.equal(secondConversation.nodeId, "start");

const conditionalBranch = controller.advance();
assert.equal(conditionalBranch.nodeId, "post-quest");

controller.endConversation("manual-close");
assert.ok(eventLog.ended.includes("manual-close"));

console.log("Dialogue system test passed.");
