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

// Références DOM, toutes peuplées une seule fois par le listener
// DOMContentLoaded en bas de fichier. Regroupées ici (plutôt qu'en ~20
// variables `let` séparées) pour que l'état "éléments de la page" soit
// visible d'un coup d'œil et se passe comme un seul paramètre implicite.
interface Elements {
  delaySelectWrap: HTMLElement | null;
  delaySelectBtn: HTMLButtonElement | null;
  delaySelectValue: HTMLElement | null;
  delaySelectList: HTMLElement | null;
  delaySelectOptions: HTMLLIElement[];
  customRow: HTMLElement | null;
  customInput: HTMLInputElement | null;
  customInputError: HTMLElement | null;
  timeRow: HTMLElement | null;
  timeInput: HTMLInputElement | null;
  timeInputHint: HTMLElement | null;
  startBtn: HTMLButtonElement | null;
  cancelBtn: HTMLButtonElement | null;
  status: HTMLElement | null;
  statusLabel: HTMLElement | null;
  statusTimer: HTMLElement | null;
  actionShutdownBtn: HTMLButtonElement | null;
  actionRestartBtn: HTMLButtonElement | null;
  modeRelativeBtn: HTMLButtonElement | null;
  modeAbsoluteBtn: HTMLButtonElement | null;
  autostartCheckbox: HTMLInputElement | null;
}

const els: Elements = {
  delaySelectWrap: null,
  delaySelectBtn: null,
  delaySelectValue: null,
  delaySelectList: null,
  delaySelectOptions: [],
  customRow: null,
  customInput: null,
  customInputError: null,
  timeRow: null,
  timeInput: null,
  timeInputHint: null,
  startBtn: null,
  cancelBtn: null,
  status: null,
  statusLabel: null,
  statusTimer: null,
  actionShutdownBtn: null,
  actionRestartBtn: null,
  modeRelativeBtn: null,
  modeAbsoluteBtn: null,
  autostartCheckbox: null,
};

// État mutable de l'écran (par opposition aux références DOM ci-dessus).
// Regroupé de la même façon pour la même raison.
interface State {
  selectedDelayValue: string;
  countdownInterval: number | null;
  scheduleEndsAt: number | null;
  scheduledAction: ScheduledAction;
  selectedAction: ScheduledAction;
  selectedMode: ScheduleMode;
}

const state: State = {
  selectedDelayValue: "300",
  countdownInterval: null,
  scheduleEndsAt: null,
  scheduledAction: "shutdown",
  selectedAction: "shutdown",
  selectedMode: "relative",
};

export function actionWording(action: ScheduledAction) {
  return action === "restart"
    ? { noun: "Redémarrage", scheduledWord: "programmé", inProgress: "Redémarrage en cours…" }
    : { noun: "Extinction", scheduledWord: "programmée", inProgress: "Extinction en cours…" };
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [h, m, s].map((n) => String(n).padStart(2, "0"));
  return h > 0 ? parts.join(":") : parts.slice(1).join(":");
}

const WARN_THRESHOLD_SECONDS = 300;
const CRITICAL_THRESHOLD_SECONDS = 60;

function setStatus(message: string, isError = false) {
  if (!els.status || !els.statusLabel) return;
  els.statusLabel.textContent = message;
  els.status.classList.toggle("error", isError);
  els.status.classList.remove("warn", "critical");
  els.statusTimer?.classList.add("hidden");
}

function setCountdownStatus(seconds: number, action: ScheduledAction) {
  if (!els.status || !els.statusLabel || !els.statusTimer) return;
  els.status.classList.remove("error");
  els.status.classList.toggle("critical", seconds <= CRITICAL_THRESHOLD_SECONDS);
  els.status.classList.toggle(
    "warn",
    seconds > CRITICAL_THRESHOLD_SECONDS && seconds <= WARN_THRESHOLD_SECONDS,
  );
  const { noun, scheduledWord } = actionWording(action);
  els.statusLabel.textContent = `${noun} ${scheduledWord} dans`;
  els.statusTimer.textContent = formatDuration(seconds);
  els.statusTimer.classList.remove("hidden");
}

function setScheduledUiState(scheduled: boolean) {
  if (els.delaySelectBtn) els.delaySelectBtn.disabled = scheduled;
  if (scheduled) closeDelaySelectList();
  if (els.customInput) els.customInput.disabled = scheduled;
  if (els.timeInput) els.timeInput.disabled = scheduled;
  if (els.startBtn) els.startBtn.disabled = scheduled;
  if (els.actionShutdownBtn) els.actionShutdownBtn.disabled = scheduled;
  if (els.actionRestartBtn) els.actionRestartBtn.disabled = scheduled;
  if (els.modeRelativeBtn) els.modeRelativeBtn.disabled = scheduled;
  if (els.modeAbsoluteBtn) els.modeAbsoluteBtn.disabled = scheduled;
  // Le bouton Annuler reste toujours cliquable : une extinction a pu être
  // programmée lors d'une session précédente de l'application.
}

function setAction(action: ScheduledAction) {
  state.selectedAction = action;
  els.actionShutdownBtn?.classList.toggle("active", action === "shutdown");
  els.actionRestartBtn?.classList.toggle("active", action === "restart");
}

function setMode(mode: ScheduleMode) {
  state.selectedMode = mode;
  els.modeRelativeBtn?.classList.toggle("active", mode === "relative");
  els.modeAbsoluteBtn?.classList.toggle("active", mode === "absolute");

  const isAbsolute = mode === "absolute";
  els.delaySelectWrap?.classList.toggle("hidden", isAbsolute);
  if (isAbsolute) closeDelaySelectList();

  const showCustom = !isAbsolute && state.selectedDelayValue === "custom";
  els.customRow?.classList.toggle("visible", showCustom);
  els.customRow?.toggleAttribute("inert", !showCustom);

  els.timeRow?.classList.toggle("visible", isAbsolute);
  els.timeRow?.toggleAttribute("inert", !isAbsolute);

  setCustomInputError("");
  setTimeInputHint("");
}

function openDelaySelectList() {
  if (els.delaySelectBtn?.disabled) return;
  els.delaySelectList?.removeAttribute("inert");
  els.delaySelectList?.classList.add("open");
  els.delaySelectBtn?.setAttribute("aria-expanded", "true");
}

function closeDelaySelectList() {
  els.delaySelectList?.classList.remove("open");
  els.delaySelectList?.setAttribute("inert", "");
  els.delaySelectBtn?.setAttribute("aria-expanded", "false");
}

function toggleDelaySelectList() {
  if (els.delaySelectList?.classList.contains("open")) {
    closeDelaySelectList();
  } else {
    openDelaySelectList();
  }
}

function setDelayValue(value: string) {
  state.selectedDelayValue = value;
  const chosen = els.delaySelectOptions.find((opt) => opt.dataset.value === value);
  if (els.delaySelectValue) els.delaySelectValue.textContent = chosen?.textContent ?? "";
  els.delaySelectOptions.forEach((opt) => {
    opt.setAttribute("aria-selected", String(opt.dataset.value === value));
  });

  const isCustom = value === "custom";
  els.customRow?.classList.toggle("visible", isCustom);
  els.customRow?.toggleAttribute("inert", !isCustom);
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
  if (state.countdownInterval !== null) {
    window.clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
  state.scheduleEndsAt = null;
}

// Recalcule le temps restant à partir de l'horodatage cible plutôt que de
// décrémenter un compteur : un `setInterval` peut ralentir (fenêtre masquée
// dans la barre système, onglet en arrière-plan, etc.), ce qui désynchronise
// l'affichage de l'extinction réellement programmée côté système.
function tickCountdown() {
  if (state.scheduleEndsAt === null) return;

  const remaining = Math.round((state.scheduleEndsAt - Date.now()) / 1000);
  if (remaining <= 0) {
    const { inProgress } = actionWording(state.scheduledAction);
    stopCountdown();
    clearPersistedSchedule();
    setStatus(inProgress);
    setScheduledUiState(false);
    return;
  }
  setCountdownStatus(remaining, state.scheduledAction);
}

function startCountdown(endsAt: number, action: ScheduledAction) {
  stopCountdown();
  state.scheduleEndsAt = endsAt;
  state.scheduledAction = action;
  tickCountdown();
  if (state.scheduleEndsAt !== null) {
    state.countdownInterval = window.setInterval(tickCountdown, 1000);
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

function setCustomInputError(message: string) {
  els.customInput?.classList.toggle("invalid", Boolean(message));
  if (els.customInputError) els.customInputError.textContent = message;
}

function setTimeInputHint(message: string, isError = false) {
  els.timeInput?.classList.toggle("invalid", isError);
  if (els.timeInputHint) {
    els.timeInputHint.textContent = message;
    els.timeInputHint.classList.toggle("error", isError);
  }
}

function getRelativeDelaySeconds(): number | null {
  if (state.selectedDelayValue === "custom") {
    const minutes = Number(els.customInput?.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setCustomInputError("Indiquez un délai valide, en minutes.");
      return null;
    }
    if (minutes > MAX_DELAY_MINUTES) {
      setCustomInputError(`Le délai ne peut pas dépasser ${MAX_DELAY_MINUTES / 60} heures.`);
      return null;
    }
    setCustomInputError("");
    return Math.round(minutes * 60);
  }

  return Number(state.selectedDelayValue);
}

// Résout une heure "HH:MM" en délai (en secondes) jusqu'à la prochaine
// occurrence de cette heure, en précisant si elle tombe le lendemain (l'heure
// choisie est déjà passée aujourd'hui).
export function resolveAbsoluteTarget(
  value: string,
): { seconds: number; isTomorrow: boolean } | null {
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const target = new Date();
  target.setSeconds(0, 0);
  target.setHours(hours, minutes);
  const isTomorrow = target.getTime() <= Date.now();
  if (isTomorrow) {
    target.setDate(target.getDate() + 1);
  }

  return { seconds: Math.round((target.getTime() - Date.now()) / 1000), isTomorrow };
}

function previewTimeHint() {
  const value = els.timeInput?.value;
  if (!value) {
    setTimeInputHint("");
    return;
  }
  const resolved = resolveAbsoluteTarget(value);
  setTimeInputHint(resolved?.isTomorrow ? `Demain à ${value}` : "");
}

function getAbsoluteDelaySeconds(): number | null {
  const value = els.timeInput?.value;
  if (!value) {
    setTimeInputHint("Choisissez une heure.", true);
    return null;
  }

  const resolved = resolveAbsoluteTarget(value);
  if (!resolved) {
    setTimeInputHint("Heure invalide.", true);
    return null;
  }

  setTimeInputHint(resolved.isTomorrow ? `Demain à ${value}` : "");
  return resolved.seconds;
}

function getSelectedDelaySeconds(): number | null {
  return state.selectedMode === "absolute" ? getAbsoluteDelaySeconds() : getRelativeDelaySeconds();
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
  if (!els.autostartCheckbox) return;
  try {
    els.autostartCheckbox.checked = await isAutostartEnabled();
  } catch (err) {
    console.error("Lecture de l'état de démarrage automatique impossible :", err);
  }
}

async function handleAutostartToggle() {
  if (!els.autostartCheckbox) return;
  const wantEnabled = els.autostartCheckbox.checked;
  try {
    if (wantEnabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
  } catch (err) {
    console.error("Modification du démarrage automatique impossible :", err);
    els.autostartCheckbox.checked = !wantEnabled;
    setStatus(`Erreur : impossible de modifier le démarrage automatique (${err}).`, true);
  }
}

async function handleStart() {
  const seconds = getSelectedDelaySeconds();
  if (seconds === null) return;

  if (els.startBtn) els.startBtn.disabled = true;
  try {
    await invoke("schedule_shutdown", { seconds, action: state.selectedAction });
    const endsAt = persistScheduleEnd(seconds, state.selectedAction);
    setScheduledUiState(true);
    startCountdown(endsAt, state.selectedAction);
    const { noun, scheduledWord } = actionWording(state.selectedAction);
    void notify(`${noun} ${scheduledWord}`, `${noun} ${scheduledWord} dans ${formatDuration(seconds)}.`);
  } catch (err) {
    setStatus(`Erreur : ${err}`, true);
    if (els.startBtn) els.startBtn.disabled = false;
  }
}

function applyCancelOutcome(message: string) {
  stopCountdown();
  clearPersistedSchedule();
  setScheduledUiState(false);
  setStatus(message);
  // « Aucune extinction n'était programmée. » n'est pas une information
  // assez utile pour mériter une notification OS (souvent déclenchée par un
  // clic réflexe sur Annuler) : le message dans la fenêtre suffit.
  if (message !== NO_SHUTDOWN_MESSAGE) {
    void notify("ShutdownPro", message);
  }
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

interface TrayScheduleResult {
  success: boolean;
  message: string;
  seconds: number | null;
  action: ScheduledAction;
}

// Déclenchée par un clic sur "Maintenant" / "Dans X minutes" dans le menu du
// system tray : synchronise l'UI de la fenêtre principale avec l'action
// exécutée côté Rust (countdown démarré, ou extinction déjà en cours).
function handleTrayScheduleResult({ success, message, seconds, action }: TrayScheduleResult) {
  if (!success) {
    setStatus(`Erreur : ${message}`, true);
    // La fenêtre peut être masquée (icône system tray) : sans notification
    // OS, un échec déclenché depuis le tray serait totalement invisible et
    // l'utilisateur croirait à tort que l'action a eu lieu.
    void notify("ShutdownPro — erreur", message);
    return;
  }

  setAction(action);
  const { noun, scheduledWord, inProgress } = actionWording(action);

  if (seconds === null) {
    stopCountdown();
    clearPersistedSchedule();
    setScheduledUiState(false);
    setStatus(inProgress);
    void notify("ShutdownPro", inProgress);
    return;
  }

  const endsAt = persistScheduleEnd(seconds, action);
  setScheduledUiState(true);
  startCountdown(endsAt, action);
  void notify(`${noun} ${scheduledWord}`, `${noun} ${scheduledWord} dans ${formatDuration(seconds)}.`);
}

window.addEventListener("DOMContentLoaded", () => {
  els.delaySelectWrap = document.querySelector("#delay-select-wrap");
  els.delaySelectBtn = document.querySelector("#delay-select-btn");
  els.delaySelectValue = document.querySelector("#delay-select-value");
  els.delaySelectList = document.querySelector("#delay-select-list");
  els.delaySelectOptions = Array.from(document.querySelectorAll("#delay-select-list [role='option']"));
  els.customRow = document.querySelector("#custom-row");
  els.customInput = document.querySelector("#custom-input");
  els.customInputError = document.querySelector("#custom-input-error");
  els.timeRow = document.querySelector("#time-row");
  els.timeInput = document.querySelector("#time-input");
  els.timeInputHint = document.querySelector("#time-input-hint");
  els.startBtn = document.querySelector("#start-btn");
  els.cancelBtn = document.querySelector("#cancel-btn");
  els.status = document.querySelector("#status");
  els.statusLabel = document.querySelector("#status-label");
  els.statusTimer = document.querySelector("#status-timer");
  els.actionShutdownBtn = document.querySelector("#action-shutdown-btn");
  els.actionRestartBtn = document.querySelector("#action-restart-btn");
  els.modeRelativeBtn = document.querySelector("#mode-relative-btn");
  els.modeAbsoluteBtn = document.querySelector("#mode-absolute-btn");
  els.autostartCheckbox = document.querySelector("#autostart-checkbox");

  els.delaySelectBtn?.addEventListener("click", () => toggleDelaySelectList());

  els.delaySelectOptions.forEach((option, index) => {
    option.addEventListener("click", () => {
      setDelayValue(option.dataset.value ?? "");
      closeDelaySelectList();
      els.delaySelectBtn?.focus();
    });

    option.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        els.delaySelectOptions[Math.min(index + 1, els.delaySelectOptions.length - 1)]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        els.delaySelectOptions[Math.max(index - 1, 0)]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setDelayValue(option.dataset.value ?? "");
        closeDelaySelectList();
        els.delaySelectBtn?.focus();
      } else if (event.key === "Escape") {
        closeDelaySelectList();
        els.delaySelectBtn?.focus();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!els.delaySelectList || !els.delaySelectList.classList.contains("open")) return;
    const target = event.target as Node;
    if (els.delaySelectBtn?.contains(target) || els.delaySelectList.contains(target)) return;
    closeDelaySelectList();
  });

  els.actionShutdownBtn?.addEventListener("click", () => setAction("shutdown"));
  els.actionRestartBtn?.addEventListener("click", () => setAction("restart"));
  els.modeRelativeBtn?.addEventListener("click", () => setMode("relative"));
  els.modeAbsoluteBtn?.addEventListener("click", () => setMode("absolute"));

  els.customInput?.addEventListener("input", () => setCustomInputError(""));
  els.timeInput?.addEventListener("input", previewTimeHint);

  els.startBtn?.addEventListener("click", handleStart);
  els.cancelBtn?.addEventListener("click", handleCancel);
  els.autostartCheckbox?.addEventListener("change", handleAutostartToggle);

  listen<{ success: boolean; message: string }>("tray-cancel-result", (event) => {
    handleCancelOutcome(event.payload.success, event.payload.message);
  });

  listen<TrayScheduleResult>("tray-schedule-result", (event) => {
    handleTrayScheduleResult(event.payload);
  });

  void initAutostart();
  restorePersistedSchedule();
});
