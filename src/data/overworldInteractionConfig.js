import { createDialogueTree } from "../systems/dialogue/index.js";
import { KEY_BATTLE_OUTCOME_FLAGS } from "../state/playerProgress.js";

const OVERWORLD_DIALOGUE_FLAGS = Object.freeze({
  RANGER_TUTORIAL_COMPLETE: "dialogue.rangerTutorialComplete",
  MECHANIC_INTRO_COMPLETE: "dialogue.mechanicIntroComplete",
  WORKSHOP_KEY_GRANTED: "quest.workshopKeyGranted",
  WORKSHOP_GATE_UNLOCKED: "quest.workshopGateUnlocked",
  WORKSHOP_PASS_COLLECTED: "quest.workshopPassCollected",
  CANYON_CHECKPOINT_UNLOCKED: "quest.canyonCheckpointUnlocked",
});

const OVERWORLD_NPC_DEFINITIONS = Object.freeze([
  {
    id: "npc-ranger",
    name: "Ranger Sol",
    texture: "npc-ranger",
    bodyColor: 0x3f8f7d,
    accentColor: 0xc5f7d9,
    tileX: 8,
    tileY: 4,
    dialogueEntryPoint: "opening",
    questMetadata: {
      questId: "overworld-training-ambush",
      questOfferNodeId: "task-response",
      completionFlag: OVERWORLD_DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE,
    },
  },
  {
    id: "npc-mechanic",
    name: "Mechanic Ivo",
    texture: "npc-mechanic",
    bodyColor: 0x9d6ac9,
    accentColor: 0xffd58a,
    tileX: 11,
    tileY: 8,
    dialogueEntryPoint: "opening",
    questMetadata: {
      questId: "workshop-gate-access",
      questOfferNodeId: "grant-key",
      completionFlag: OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_KEY_GRANTED,
      unlocksObjectId: "obj-workshop-gate",
      unlockFlag: OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_GATE_UNLOCKED,
    },
  },
]);

const OVERWORLD_NPC_DIALOGUE_TREES = Object.freeze({
  "npc-ranger": createDialogueTree({
    id: "npc-ranger-overworld-dialogue",
    npcId: "npc-ranger",
    speakers: {
      ranger: { name: "Ranger Sol", portraitKey: "npc-ranger" },
      player: { name: "Pathfinder" },
    },
    startNodeId: "opening",
    nodes: {
      opening: {
        id: "opening",
        speakerId: "ranger",
        text: "Trails ahead are rough. Stay inside the marked paths.",
        next: [
          {
            condition: { allFlags: [KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED] },
            target: "drone-patrol-cleared",
          },
          {
            condition: { allFlags: [OVERWORLD_DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE] },
            target: "repeat-advice",
          },
          { target: "offer-guidance" },
        ],
      },
      "drone-patrol-cleared": {
        id: "drone-patrol-cleared",
        speakerId: "ranger",
        text: "Perimeter signal is clean. Level 2 route is now authorized. Keep moving.",
      },
      "repeat-advice": {
        id: "repeat-advice",
        speakerId: "ranger",
        text: "You already have your briefing. Check with Ivo if you need workshop access.",
      },
      "offer-guidance": {
        id: "offer-guidance",
        speakerId: "player",
        text: "Need anything from me before I head out?",
        choices: [
          {
            id: "ask-for-task",
            text: "Any task I should prioritize?",
            next: "task-response",
          },
          {
            id: "leave-now",
            text: "I am ready to move.",
            next: "farewell",
          },
        ],
      },
      "task-response": {
        id: "task-response",
        speakerId: "ranger",
        text: "Clear the training ambush marker first. Then Ivo can authorize the workshop gate.",
        hooks: [
          {
            id: "ranger-task-issued",
            once: true,
            setFlags: {
              [OVERWORLD_DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE]: true,
            },
            emitEvent: {
              name: "quest:ranger-task-issued",
              payload: { questId: "overworld-training-ambush" },
            },
          },
        ],
        next: "farewell",
      },
      farewell: {
        id: "farewell",
        speakerId: "ranger",
        text: "Stay alert out there.",
      },
    },
  }),
  "npc-mechanic": createDialogueTree({
    id: "npc-mechanic-overworld-dialogue",
    npcId: "npc-mechanic",
    speakers: {
      mechanic: { name: "Mechanic Ivo", portraitKey: "npc-mechanic" },
      player: { name: "Pathfinder" },
    },
    startNodeId: "opening",
    nodes: {
      opening: {
        id: "opening",
        speakerId: "mechanic",
        text: "Workshop gate is locked behind field-clearance.",
        next: [
          {
            condition: { allFlags: [OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_GATE_UNLOCKED] },
            target: "already-unlocked",
          },
          {
            condition: { allFlags: [OVERWORLD_DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE] },
            target: "grant-key",
          },
          {
            condition: { allFlags: [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED] },
            target: "canyon-cleared",
          },
          { target: "status-check" },
        ],
      },
      "already-unlocked": {
        id: "already-unlocked",
        speakerId: "mechanic",
        text: "Gate access already granted. Step through when ready.",
      },
      "grant-key": {
        id: "grant-key",
        speakerId: "mechanic",
        text: "Ranger Sol signed your clearance. I just unlocked the workshop gate.",
        hooks: [
          {
            id: "mechanic-grant-workshop-key",
            once: true,
            setFlags: {
              [OVERWORLD_DIALOGUE_FLAGS.MECHANIC_INTRO_COMPLETE]: true,
              [OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_KEY_GRANTED]: true,
              [OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_GATE_UNLOCKED]: true,
            },
            callbackId: "onWorkshopGateUnlocked",
            emitEvent: {
              name: "quest:workshop-gate-unlocked",
              payload: {
                questId: "workshop-gate-access",
                objectId: "obj-workshop-gate",
              },
            },
          },
        ],
        next: "short-farewell",
      },
      "canyon-cleared": {
        id: "canyon-cleared",
        speakerId: "mechanic",
        text: "You cleared Canyon Crossing. Bring me salvage and I will tune your gear.",
      },
      "status-check": {
        id: "status-check",
        speakerId: "player",
        text: "Anything I should know before I leave?",
        choices: [
          {
            id: "ask-upgrades",
            text: "When do upgrades unlock?",
            next: "upgrade-response",
          },
          {
            id: "close-chat",
            text: "No questions for now.",
            next: "short-farewell",
          },
        ],
      },
      "upgrade-response": {
        id: "upgrade-response",
        speakerId: "mechanic",
        text: "Beat the canyon gauntlet first. That gives me enough diagnostics to calibrate.",
        hooks: [
          {
            id: "mechanic-intro-complete",
            once: true,
            setFlags: {
              [OVERWORLD_DIALOGUE_FLAGS.MECHANIC_INTRO_COMPLETE]: true,
            },
            callbackId: "onMechanicIntroComplete",
          },
        ],
        next: "short-farewell",
      },
      "short-farewell": {
        id: "short-farewell",
        speakerId: "mechanic",
        text: "Come back when you need repairs.",
      },
    },
  }),
});

const OVERWORLD_INTERACTABLE_DEFINITIONS = Object.freeze([
  {
    id: "obj-workshop-pass-cache",
    type: "pickup",
    label: "Supply Cache",
    texture: "obj-workshop-pass-cache",
    tileX: 5,
    tileY: 2,
    collectedFlag: OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_PASS_COLLECTED,
    grantsStoryFlags: {
      [OVERWORLD_DIALOGUE_FLAGS.CANYON_CHECKPOINT_UNLOCKED]: true,
    },
    inventoryReward: {
      itemId: "workshop-pass",
      amount: 1,
    },
    promptLocked: "You found a workshop pass in the supply cache.",
    promptUnlocked: "The supply cache is empty.",
    colors: {
      frame: 0x263244,
      lockedFill: 0x6687c9,
      unlockedFill: 0x5f6b7d,
    },
  },
  {
    id: "obj-workshop-gate",
    type: "gate",
    label: "Workshop Gate",
    texture: "obj-workshop-gate",
    tileX: 10,
    tileY: 8,
    unlockFlag: OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_GATE_UNLOCKED,
    promptLocked: "Workshop gate: locked. Ask Mechanic Ivo for access.",
    promptUnlocked: "Workshop gate is unlocked. You can pass through now.",
    colors: {
      frame: 0x263244,
      lockedFill: 0xb24a4a,
      unlockedFill: 0x4a9f63,
    },
  },
  {
    id: "obj-canyon-checkpoint",
    type: "gate",
    label: "Canyon Checkpoint",
    texture: "obj-canyon-checkpoint",
    tileX: 6,
    tileY: 2,
    unlockFlag: OVERWORLD_DIALOGUE_FLAGS.CANYON_CHECKPOINT_UNLOCKED,
    unlockItemId: "workshop-pass",
    unlockItemCount: 1,
    promptLocked: "Checkpoint lock: requires workshop pass from nearby cache.",
    promptUnlocked: "Checkpoint unlocked. The route is now open.",
    colors: {
      frame: 0x2a3541,
      lockedFill: 0x8e4343,
      unlockedFill: 0x4a9f63,
    },
  },
]);

export {
  OVERWORLD_DIALOGUE_FLAGS,
  OVERWORLD_INTERACTABLE_DEFINITIONS,
  OVERWORLD_NPC_DEFINITIONS,
  OVERWORLD_NPC_DIALOGUE_TREES,
};
