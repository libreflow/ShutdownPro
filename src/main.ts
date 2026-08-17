import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

type ScheduledAction = "shutdown" | "restart";
type ScheduleMode = "relative" | "absolute";

const SHUTDOWN_ENDS_AT_KEY = "shutdownEndsAt";
const NO_SHUTDOWN_MESSAGE = "Aucune extinction n'était programmée.";
const MAX_DELAY_MINUTES = 24 * 60;

let delaySelectWrapEl: HTMLElement | null;
let delaySelectBtnEl: HTMLButtonElement | null;
let delaySelectValueEl: HTMLElement | null;
let delaySelectListEl: HTMLElement | null;
let delaySelectOptionEls: HTMLLIElement[] = [];
let customRowEl: HTMLElement | null;
let customInputEl: HTMLInputElement | null;
let timeRowEl: HTMLElement | null;
let timeInputEl: HTMLInputElement | null;
let startBtnEl: HTMLButtonElement | null;
let cancelBtnEl: HTMLButtonElement | null;
let statusEl: HTMLElement | null;
let statusLabelEl: HTMLElement | null;
let statusTimerEl: HTMLElement | null;
let actionShutdownBtnEl: HTMLButtonElement | null;
let actionRestartBtnEl: HTMLButtonElement | null;
let modeRelativeBtnEl: HTMLButtonElement | null;
let modeAbsoluteBtnEl: HTMLButtonElement | null;
let autostartCheckboxEl: HTMLInputElement | null;

let selectedDelayValue = "300";
let countdownInterval: number | null = null;
let scheduleEndsAt: number | null = null;
let scheduledAction: ScheduledAction = "shutdown";
let selectedAction: ScheduledAction = "shutdown";
let selectedMode: ScheduleMode = "relative";

function actionWording(action: ScheduledAction) {
  return action === "restart"
    ? { noun: "Redémarrage", scheduledWord: "programmé", inProgress: "Redémarrage en cours…" }
    : { noun: "Extinction", scheduledWord: "programmée", inProgress: "Extinction en cours…" };
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [h, m, s].map((n) => String(n).padStart(2, "0"));
  return h > 0 ? parts.join(":") : parts.slice(1).join(":");
}

const WARN_THRESHOLD_SECONDS = 300;
const CRITICAL_THRESHOLD_SECONDS = 60;

function setStatus(message: string, isError = false) {
  if (!statusEl || !statusLabelEl) return;
  statusLabelEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  statusEl.classList.remove("warn", "critical");
  statusTimerEl?.classList.add("hidden");
}

function setCountdownStatus(seconds: number, action: ScheduledAction) {
  if (!statusEl || !statusLabelEl || !statusTimerEl) return;
  statusEl.classList.remove("error");
  statusEl.classList.toggle("critical", seconds <= CRITICAL_THRESHOLD_SECONDS);
  statusEl.classList.toggle(
    "warn",
    seconds > CRITICAL_THRESHOLD_SECONDS && seconds <= WARN_THRESHOLD_SECONDS,
  );
  const { noun, scheduledWord } = actionWording(action);
  statusLabelEl.textContent = `${noun} ${scheduledWord} dans`;
  statusTimerEl.textContent = formatDuration(seconds);
  statusTimerEl.classList.remove("hidden");
}

function setScheduledUiState(scheduled: boolean) {
  if (delaySelectBtnEl) delaySelectBtnEl.disabled = scheduled;
  if (scheduled) closeDelaySelectList();
  if (customInputEl) customInputEl.disabled = scheduled;
  if (timeInputEl) timeInputEl.disabled = scheduled;
  if (startBtnEl) startBtnEl.disabled = scheduled;
  if (actionShutdownBtnEl) actionShutdownBtnEl.disabled = scheduled;
  if (actionRestartBtnEl) actionRestartBtnEl.disabled = scheduled;
  if (modeRelativeBtnEl) modeRelativeBtnEl.disabled = scheduled;
  if (modeAbsoluteBtnEl) modeAbsoluteBtnEl.disabled = scheduled;
  // Le bouton Annuler reste toujours cliquable : une extinction a pu être
  // programmée lors d'une session précédente de l'application.
}

function setAction(action: ScheduledAction) {
  selectedAction = action;
  actionShutdownBtnEl?.classList.toggle("active", action === "shutdown");
  actionRestartBtnEl?.classList.toggle("active", action === "restart");
}

function setMode(mode: ScheduleMode) {
  selectedMode = mode;
  modeRelativeBtnEl?.classList.toggle("active", mode === "relative");
  modeAbsoluteBtnEl?.classList.toggle("active", mode === "absolute");

  const isAbsolute = mode === "absolute";
  delaySelectWrapEl?.classList.toggle("hidden", isAbsolute);
  if (isAbsolute) closeDelaySelectList();

  const showCustom = !isAbsolute && selectedDelayValue === "custom";
  customRowEl?.classList.toggle("visible", showCustom);
  customRowEl?.toggleAttribute("inert", !showCustom);

  timeRowEl?.classList.toggle("visible", isAbsolute);
  timeRowEl?.toggleAttribute("inert", !isAbsolute);
}

function openDelaySelectList() {
  if (delaySelectBtnEl?.disabled) return;
  delaySelectListEl?.removeAttribute("inert");
  delaySelectListEl?.classList.add("open");
  delaySelectBtnEl?.setAttribute("aria-expanded", "true");
}

function closeDelaySelectList() {
  delaySelectListEl?.classList.remove("open");
  delaySelectListEl?.setAttribute("inert", "");
  delaySelectBtnEl?.setAttribute("aria-expanded", "false");
}

function toggleDelaySelectList() {
  if (delaySelectListEl?.classList.contains("open")) {
    closeDelaySelectList();
  } else {
    openDelaySelectList();
  }
}

function setDelayValue(value: string) {
  selectedDelayValue = value;
  const chosen = delaySelectOptionEls.find((opt) => opt.dataset.value === value);
  if (delaySelectValueEl) delaySelectValueEl.textContent = chosen?.textContent ?? "";
  delaySelectOptionEls.forEach((opt) => {
    opt.setAttribute("aria-selected", String(opt.dataset.value === value));
  });

  const isCustom = value === "custom";
  customRowEl?.classList.toggle("visible", isCustom);
  customRowEl?.toggleAttribute("inert", !isCustom);
}

function persistScheduleEnd(seconds: number, action: ScheduledAction): number {
  const endsAt = Date.now() + seconds * 1000;
  localStorage.setItem(SHUTDOWN_ENDS_AT_KEY, JSON.stringify({ endsAt, action }));
  return endsAt;
}

function clearPersistedSchedule() {
  localStorage.removeItem(SHUTDOWN_ENDS_AT_KEY);
}

function stopCountdown() {
  if (countdownInterval !== null) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }
  scheduleEndsAt = null;
}

// Recalcule le temps restant à partir de l'horodatage cible plutôt que de
// décrémenter un compteur : un `setInterval` peut ralentir (fenêtre masquée
// dans la barre système, onglet en arrière-plan, etc.), ce qui désynchronise
// l'affichage de l'extinction réellement programmée côté système.
function tickCountdown() {
  if (scheduleEndsAt === null) return;

  const remaining = Math.round((scheduleEndsAt - Date.now()) / 1000);
  if (remaining <= 0) {
    const { inProgress } = actionWording(scheduledAction);
    stopCountdown();
    clearPersistedSchedule();
    setStatus(inProgress);
    setScheduledUiState(false);
    return;
  }
  setCountdownStatus(remaining, scheduledAction);
}

function startCountdown(endsAt: number, action: ScheduledAction) {
  stopCountdown();
  scheduleEndsAt = endsAt;
  scheduledAction = action;
  tickCountdown();
  if (scheduleEndsAt !== null) {
    countdownInterval = window.setInterval(tickCountdown, 1000);
  }
}

function restorePersistedSchedule() {
  const raw = localStorage.getItem(SHUTDOWN_ENDS_AT_KEY);
  if (!raw) return;

  let stored: { endsAt: number; action: ScheduledAction } | null = null;
  try {
    stored = JSON.parse(raw);
  } catch {
    stored = null;
  }

  if (!stored || !Number.isFinite(stored.endsAt)) {
    clearPersistedSchedule();
    return;
  }

  if (stored.endsAt <= Date.now()) {
    clearPersistedSchedule();
    return;
  }

  setAction(stored.action);
  setScheduledUiState(true);
  startCountdown(stored.endsAt, stored.action);
}

function getRelativeDelaySeconds(): number | null {
  if (selectedDelayValue === "custom") {
    const minutes = Number(customInputEl?.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setStatus("Merci d'indiquer un délai personnalisé valide (en minutes).", true);
      return null;
    }
    if (minutes > MAX_DELAY_MINUTES) {
      setStatus(`Le délai personnalisé ne peut pas dépasser ${MAX_DELAY_MINUTES / 60} heures.`, true);
      return null;
    }
    return Math.round(minutes * 60);
  }

  return Number(selectedDelayValue);
}

function getAbsoluteDelaySeconds(): number | null {
  const value = timeInputEl?.value;
  if (!value) {
    setStatus("Merci d'indiquer une heure valide.", true);
    return null;
  }

  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    setStatus("Merci d'indiquer une heure valide.", true);
    return null;
  }

  const target = new Date();
  target.setSeconds(0, 0);
  target.setHours(hours, minutes);
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return Math.round((target.getTime() - Date.now()) / 1000);
}

function getSelectedDelaySeconds(): number | null {
  return selectedMode === "absolute" ? getAbsoluteDelaySeconds() : getRelativeDelaySeconds();
}

async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

async function notify(title: string, body: string) {
  try {
    if (await ensureNotificationPermission()) {
      sendNotification({ title, body });
    }
  } catch (err) {
    console.error("Notification impossible :", err);
  }
}

async function initAutostart() {
  if (!autostartCheckboxEl) return;
  try {
    autostartCheckboxEl.checked = await isAutostartEnabled();
  } catch (err) {
    console.error("Lecture de l'état de démarrage automatique impossible :", err);
  }
}

async function handleAutostartToggle() {
  if (!autostartCheckboxEl) return;
  const wantEnabled = autostartCheckboxEl.checked;
  try {
    if (wantEnabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
  } catch (err) {
    console.error("Modification du démarrage automatique impossible :", err);
    autostartCheckboxEl.checked = !wantEnabled;
  }
}

async function handleStart() {
  const seconds = getSelectedDelaySeconds();
  if (seconds === null) return;

  try {
    await invoke("schedule_shutdown", { seconds, action: selectedAction });
    const endsAt = persistScheduleEnd(seconds, selectedAction);
    setScheduledUiState(true);
    startCountdown(endsAt, selectedAction);
    const { noun, scheduledWord } = actionWording(selectedAction);
    void notify(`${noun} ${scheduledWord}`, `${noun} ${scheduledWord} dans ${formatDuration(seconds)}.`);
  } catch (err) {
    setStatus(`Erreur : ${err}`, true);
  }
}

function applyCancelOutcome(message: string) {
  stopCountdown();
  clearPersistedSchedule();
  setScheduledUiState(false);
  setStatus(message);
  void notify("ShutdownPro", message);
}

// Une extinction annulée depuis le menu du system tray n'est plus en cours,
// que la commande ait réussi ou qu'il n'y ait simplement rien eu à annuler.
function handleCancelOutcome(success: boolean, message: string) {
  if (success || message.includes(NO_SHUTDOWN_MESSAGE)) {
    applyCancelOutcome(message);
  } else {
    setStatus(`Erreur : ${message}`, true);
  }
}

async function handleCancel() {
  try {
    await invoke("cancel_shutdown");
    handleCancelOutcome(true, "Extinction annulée.");
  } catch (err) {
    handleCancelOutcome(false, String(err));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  delaySelectWrapEl = document.querySelector("#delay-select-wrap");
  delaySelectBtnEl = document.querySelector("#delay-select-btn");
  delaySelectValueEl = document.querySelector("#delay-select-value");
  delaySelectListEl = document.querySelector("#delay-select-list");
  delaySelectOptionEls = Array.from(document.querySelectorAll("#delay-select-list [role='option']"));
  customRowEl = document.querySelector("#custom-row");
  customInputEl = document.querySelector("#custom-input");
  timeRowEl = document.querySelector("#time-row");
  timeInputEl = document.querySelector("#time-input");
  startBtnEl = document.querySelector("#start-btn");
  cancelBtnEl = document.querySelector("#cancel-btn");
  statusEl = document.querySelector("#status");
  statusLabelEl = document.querySelector("#status-label");
  statusTimerEl = document.querySelector("#status-timer");
  actionShutdownBtnEl = document.querySelector("#action-shutdown-btn");
  actionRestartBtnEl = document.querySelector("#action-restart-btn");
  modeRelativeBtnEl = document.querySelector("#mode-relative-btn");
  modeAbsoluteBtnEl = document.querySelector("#mode-absolute-btn");
  autostartCheckboxEl = document.querySelector("#autostart-checkbox");

  delaySelectBtnEl?.addEventListener("click", () => toggleDelaySelectList());

  delaySelectOptionEls.forEach((option, index) => {
    option.addEventListener("click", () => {
      setDelayValue(option.dataset.value ?? "");
      closeDelaySelectList();
      delaySelectBtnEl?.focus();
    });

    option.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        delaySelectOptionEls[Math.min(index + 1, delaySelectOptionEls.length - 1)]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        delaySelectOptionEls[Math.max(index - 1, 0)]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setDelayValue(option.dataset.value ?? "");
        closeDelaySelectList();
        delaySelectBtnEl?.focus();
      } else if (event.key === "Escape") {
        closeDelaySelectList();
        delaySelectBtnEl?.focus();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!delaySelectListEl || !delaySelectListEl.classList.contains("open")) return;
    const target = event.target as Node;
    if (delaySelectBtnEl?.contains(target) || delaySelectListEl.contains(target)) return;
    closeDelaySelectList();
  });

  actionShutdownBtnEl?.addEventListener("click", () => setAction("shutdown"));
  actionRestartBtnEl?.addEventListener("click", () => setAction("restart"));
  modeRelativeBtnEl?.addEventListener("click", () => setMode("relative"));
  modeAbsoluteBtnEl?.addEventListener("click", () => setMode("absolute"));

  startBtnEl?.addEventListener("click", handleStart);
  cancelBtnEl?.addEventListener("click", handleCancel);
  autostartCheckboxEl?.addEventListener("change", handleAutostartToggle);

  listen<{ success: boolean; message: string }>("tray-cancel-result", (event) => {
    handleCancelOutcome(event.payload.success, event.payload.message);
  });

  void initAutostart();
  restorePersistedSchedule();
});
