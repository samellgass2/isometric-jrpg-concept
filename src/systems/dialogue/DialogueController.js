import DialogueFlagStore from "./DialogueFlagStore.js";
import {
  createDialogueTree,
  getDialogueNode,
  isDialogueConditionMet,
  resolveConditionalTarget,
  resolveSpeakerMeta,
} from "./dialoguePrimitives.js";

const DialogueEvents = Object.freeze({
  STARTED: "dialogue:started",
  NODE_CHANGED: "dialogue:node-changed",
  HOOK_TRIGGERED: "dialogue:hook-triggered",
  ENDED: "dialogue:ended",
});

function normalizeId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export default class DialogueController {
  constructor(options = {}) {
    this.flagStore =
      options.flagStore instanceof DialogueFlagStore ? options.flagStore : new DialogueFlagStore(options.flags);
    this.callbackMap = options.callbackMap && typeof options.callbackMap === "object" ? options.callbackMap : {};
    this.listeners = new Map();
    this.state = null;
    this.triggeredHooks = new Set();
  }

  on(eventName, handler) {
    if (typeof handler !== "function") {
      return () => {};
    }

    const eventKey = normalizeId(eventName);
    if (!eventKey) {
      return () => {};
    }

    const handlers = this.listeners.get(eventKey) ?? new Set();
    handlers.add(handler);
    this.listeners.set(eventKey, handlers);
    return () => this.off(eventKey, handler);
  }

  off(eventName, handler) {
    const eventKey = normalizeId(eventName);
    const handlers = this.listeners.get(eventKey);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(eventKey);
    }
  }

  emit(eventName, payload = {}) {
    const eventKey = normalizeId(eventName);
    if (!eventKey) {
      return;
    }

    const handlers = this.listeners.get(eventKey);
    if (!handlers || handlers.size === 0) {
      return;
    }

    handlers.forEach((handler) => handler(payload));
  }

  isActive() {
    return this.state !== null;
  }

  startConversation({ npcId, tree, startNodeId, context = {} }) {
    const normalizedTree = createDialogueTree(tree);
    const resolvedNpcId = normalizeId(npcId) || normalizedTree.npcId || "unknown-npc";
    const firstNodeId = normalizeId(startNodeId) || normalizedTree.startNodeId;

    if (this.isActive()) {
      this.endConversation("interrupted");
    }

    this.state = {
      npcId: resolvedNpcId,
      tree: normalizedTree,
      context: { ...context },
      currentNodeId: firstNodeId,
      history: [],
      lastChoiceId: null,
    };
    this.triggeredHooks.clear();

    this.emit(DialogueEvents.STARTED, this.getSnapshot());
    this.enterNode(firstNodeId, { pushHistory: false });
    return this.getSnapshot();
  }

  getSnapshot() {
    if (!this.state) {
      return null;
    }

    const node = this.getCurrentNode();
    const choices = this.getAvailableChoices();

    return {
      npcId: this.state.npcId,
      treeId: this.state.tree.id,
      nodeId: this.state.currentNodeId,
      node,
      speaker: resolveSpeakerMeta(this.state.tree, node),
      choices,
      lastChoiceId: this.state.lastChoiceId,
      historyDepth: this.state.history.length,
      flags: this.flagStore.snapshot(),
      context: { ...this.state.context },
    };
  }

  getCurrentNode() {
    if (!this.state) {
      return null;
    }

    return getDialogueNode(this.state.tree, this.state.currentNodeId);
  }

  getAvailableChoices() {
    const node = this.getCurrentNode();
    if (!node || !Array.isArray(node.choices)) {
      return [];
    }

    const context = this.createConditionContext();
    return node.choices
      .filter((choice) => isDialogueConditionMet(choice.condition, context))
      .map((choice) => ({ ...choice }));
  }

  canGoBack() {
    return Boolean(this.state && this.state.history.length > 0);
  }

  goBack() {
    if (!this.canGoBack()) {
      return this.getSnapshot();
    }

    const previousNodeId = this.state.history.pop();
    if (!previousNodeId) {
      return this.getSnapshot();
    }

    this.state.currentNodeId = previousNodeId;
    this.emit(DialogueEvents.NODE_CHANGED, this.getSnapshot());
    return this.getSnapshot();
  }

  advance() {
    if (!this.state) {
      return null;
    }

    const node = this.getCurrentNode();
    if (!node) {
      return this.endConversation("invalid-node");
    }

    const choices = this.getAvailableChoices();
    if (choices.length > 0) {
      if (choices.length === 1 && node.autoSelectSingleChoice === true) {
        return this.selectChoice(choices[0].id);
      }
      return this.getSnapshot();
    }

    const targetNodeId = resolveConditionalTarget(node.next, this.createConditionContext());
    if (!targetNodeId) {
      return this.endConversation("completed");
    }

    return this.enterNode(targetNodeId, { pushHistory: true });
  }

  selectChoice(choiceId) {
    if (!this.state) {
      return null;
    }

    const selectedChoiceId = normalizeId(choiceId);
    const choices = this.getAvailableChoices();
    const choice = choices.find((candidate) => normalizeId(candidate.id) === selectedChoiceId);
    if (!choice) {
      return this.getSnapshot();
    }

    const targetNodeId = resolveConditionalTarget(choice.next ?? choice.target, this.createConditionContext());
    this.state.lastChoiceId = selectedChoiceId || null;
    this.triggerHooks(choice.hooks, {
      hookType: "choice",
      nodeId: this.state.currentNodeId,
      choiceId: selectedChoiceId,
    });

    if (!targetNodeId) {
      return this.endConversation("completed");
    }

    return this.enterNode(targetNodeId, { pushHistory: true });
  }

  endConversation(reason = "completed") {
    if (!this.state) {
      return null;
    }

    const snapshot = this.getSnapshot();
    this.emit(DialogueEvents.ENDED, {
      reason,
      ...snapshot,
    });
    this.state = null;
    return null;
  }

  createConditionContext() {
    return {
      flags: this.flagStore.snapshot(),
      flagStore: this.flagStore,
      context: this.state?.context ?? {},
      controller: this,
      conversation: this.state,
    };
  }

  enterNode(nodeId, options = {}) {
    if (!this.state) {
      return null;
    }

    const targetNodeId = normalizeId(nodeId);
    const targetNode = getDialogueNode(this.state.tree, targetNodeId);
    if (!targetNode) {
      return this.endConversation("invalid-node");
    }

    if (options.pushHistory) {
      this.state.history.push(this.state.currentNodeId);
    }

    this.state.currentNodeId = targetNodeId;
    this.triggerHooks(targetNode.hooks, {
      hookType: "node",
      nodeId: targetNodeId,
      choiceId: null,
    });

    const snapshot = this.getSnapshot();
    this.emit(DialogueEvents.NODE_CHANGED, snapshot);
    return snapshot;
  }

  triggerHooks(hooks, source = {}) {
    if (!hooks) {
      return;
    }

    const hookList = Array.isArray(hooks) ? hooks : [hooks];
    hookList.forEach((hook, hookIndex) => {
      const hookId = normalizeId(hook?.id) || `${source.hookType || "hook"}:${source.nodeId || "unknown"}:${hookIndex}`;
      const shouldTriggerOnce = hook?.once === true;
      if (shouldTriggerOnce && this.triggeredHooks.has(hookId)) {
        return;
      }

      if (shouldTriggerOnce) {
        this.triggeredHooks.add(hookId);
      }

      if (typeof hook === "function") {
        hook(this.createHookContext(source, hookId));
        this.emitHookTriggered(source, hookId, { type: "function" });
        return;
      }

      if (!hook || typeof hook !== "object") {
        return;
      }

      if (hook.setFlags && typeof hook.setFlags === "object") {
        this.flagStore.setFlags(hook.setFlags);
      }

      if (Array.isArray(hook.clearFlags)) {
        hook.clearFlags.forEach((flagKey) => this.flagStore.clearFlag(flagKey));
      }

      if (typeof hook.callback === "function") {
        hook.callback(this.createHookContext(source, hookId));
      } else {
        const callbackId = normalizeId(hook.callbackId);
        if (callbackId && typeof this.callbackMap[callbackId] === "function") {
          this.callbackMap[callbackId](this.createHookContext(source, hookId));
        }
      }

      if (hook.emitEvent) {
        const eventName = typeof hook.emitEvent === "string" ? hook.emitEvent : hook.emitEvent.name;
        if (eventName) {
          this.emit(String(eventName), {
            ...this.createHookContext(source, hookId),
            payload: typeof hook.emitEvent === "object" ? hook.emitEvent.payload ?? null : null,
          });
        }
      }

      this.emitHookTriggered(source, hookId, {
        type: "object",
        setFlags: hook.setFlags ? { ...hook.setFlags } : null,
        clearFlags: Array.isArray(hook.clearFlags) ? [...hook.clearFlags] : null,
      });
    });
  }

  createHookContext(source, hookId) {
    return {
      hookId,
      source: { ...source },
      npcId: this.state?.npcId ?? null,
      treeId: this.state?.tree?.id ?? null,
      nodeId: source.nodeId ?? this.state?.currentNodeId ?? null,
      choiceId: source.choiceId ?? null,
      flagStore: this.flagStore,
      flags: this.flagStore.snapshot(),
      context: { ...(this.state?.context ?? {}) },
      controller: this,
    };
  }

  emitHookTriggered(source, hookId, detail = {}) {
    this.emit(DialogueEvents.HOOK_TRIGGERED, {
      hookId,
      ...source,
      detail,
      flags: this.flagStore.snapshot(),
      treeId: this.state?.tree?.id ?? null,
      npcId: this.state?.npcId ?? null,
    });
  }
}

export { DialogueEvents };
