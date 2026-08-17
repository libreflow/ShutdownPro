import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const SHUTDOWN_ENDS_AT_KEY = "shutdownEndsAt";
const NO_SHUTDOWN_MESSAGE = "Aucune extinction n'était programmée.";

let delaySelectEl: HTMLSelectElement | null;
let customRowEl: HTMLElement | null;
let customInputEl: HTMLInputElement | null;
let startBtnEl: HTMLButtonElement | null;
let cancelBtnEl: HTMLButtonElement | null;
let statusEl: HTMLElement | null;
let statusLabelEl: HTMLElement | null;
let statusTimerEl: HTMLElement | null;

let countdownInterval: number | null = null;
let scheduleEndsAt: number | null = null;

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [h, m, s].map((n) => String(n).padStart(2, "0"));
  return h > 0 ? parts.join(":") : parts.slice(1).join(":");
}

function setStatus(message: string, isError = false) {
  if (!statusEl || !statusLabelEl) return;
  statusLabelEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  statusTimerEl?.classList.add("hidden");
}

function setCountdownStatus(seconds: number) {
  if (!statusEl || !statusLabelEl || !statusTimerEl) return;
  statusEl.classList.remove("error");
  statusLabelEl.textContent = "Extinction programmée dans";
  statusTimerEl.textContent = formatDuration(seconds);
  statusTimerEl.classList.remove("hidden");
}

function setScheduledUiState(scheduled: boolean) {
  if (delaySelectEl) delaySelectEl.disabled = scheduled;
  if (customInputEl) customInputEl.disabled = scheduled;
  if (startBtnEl) startBtnEl.disabled = scheduled;
  // Le bouton Annuler reste toujours cliquable : une extinction a pu être
  // programmée lors d'une session précédente de l'application.
}

function persistScheduleEnd(seconds: number): number {
  const endsAt = Date.now() + seconds * 1000;
  localStorage.setItem(SHUTDOWN_ENDS_AT_KEY, String(endsAt));
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
    stopCountdown();
    clearPersistedSchedule();
    setStatus("Extinction en cours…");
    setScheduledUiState(false);
    return;
  }
  setCountdownStatus(remaining);
}

function startCountdown(endsAt: number) {
  stopCountdown();
  scheduleEndsAt = endsAt;
  tickCountdown();
  if (scheduleEndsAt !== null) {
    countdownInterval = window.setInterval(tickCountdown, 1000);
  }
}

function restorePersistedSchedule() {
  const storedEndsAt = Number(localStorage.getItem(SHUTDOWN_ENDS_AT_KEY));
  if (!storedEndsAt) return;

  if (storedEndsAt <= Date.now()) {
    clearPersistedSchedule();
    return;
  }

  setScheduledUiState(true);
  startCountdown(storedEndsAt);
}

function getSelectedDelaySeconds(): number | null {
  if (!delaySelectEl) return null;

  if (delaySelectEl.value === "custom") {
    const minutes = Number(customInputEl?.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setStatus("Merci d'indiquer un délai personnalisé valide (en minutes).", true);
      return null;
    }
    return Math.round(minutes * 60);
  }

  return Number(delaySelectEl.value);
}

async function handleStart() {
  const seconds = getSelectedDelaySeconds();
  if (seconds === null) return;

  try {
    await invoke("schedule_shutdown", { seconds });
    const endsAt = persistScheduleEnd(seconds);
    setScheduledUiState(true);
    startCountdown(endsAt);
  } catch (err) {
    setStatus(`Erreur : ${err}`, true);
  }
}

function applyCancelOutcome(message: string) {
  stopCountdown();
  clearPersistedSchedule();
  setScheduledUiState(false);
  setStatus(message);
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
  delaySelectEl = document.querySelector("#delay-select");
  customRowEl = document.querySelector("#custom-row");
  customInputEl = document.querySelector("#custom-input");
  startBtnEl = document.querySelector("#start-btn");
  cancelBtnEl = document.querySelector("#cancel-btn");
  statusEl = document.querySelector("#status");
  statusLabelEl = document.querySelector("#status-label");
  statusTimerEl = document.querySelector("#status-timer");

  delaySelectEl?.addEventListener("change", () => {
    const isCustom = delaySelectEl?.value === "custom";
    customRowEl?.classList.toggle("visible", isCustom);
    customRowEl?.toggleAttribute("inert", !isCustom);
  });

  startBtnEl?.addEventListener("click", handleStart);
  cancelBtnEl?.addEventListener("click", handleCancel);

  listen<{ success: boolean; message: string }>("tray-cancel-result", (event) => {
    handleCancelOutcome(event.payload.success, event.payload.message);
  });

  restorePersistedSchedule();
});
