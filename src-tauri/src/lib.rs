use std::process::{Command, Output};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Code retourné par `shutdown /a` sous Windows quand aucune extinction n'est en cours.
#[cfg(target_os = "windows")]
const ERROR_NO_SHUTDOWN_IN_PROGRESS: i32 = 1116;

#[cfg(target_os = "windows")]
fn run_shutdown_command(args: &[&str]) -> Result<Output, String> {
    use std::os::windows::process::CommandExt;

    Command::new("shutdown")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Impossible de lancer la commande shutdown: {e}"))
}

#[cfg(not(target_os = "windows"))]
fn run_shutdown_command(_args: &[&str]) -> Result<Output, String> {
    Err("L'extinction programmée n'est pour l'instant supportée que sous Windows.".into())
}

/// Délai maximal accepté pour une extinction/redémarrage programmé (24 heures).
const MAX_DELAY_SECONDS: u32 = 24 * 60 * 60;

/// Valide `seconds`/`action` et renvoie le flag `shutdown` et le message
/// associés. Logique pure, séparée de `schedule_shutdown` pour être testable
/// sans jamais invoquer la vraie commande `shutdown` système.
fn validate_schedule_args(
    seconds: u32,
    action: &str,
) -> Result<(&'static str, &'static str), String> {
    if seconds == 0 {
        return Err("Le délai doit être supérieur à 0 seconde.".into());
    }
    if seconds > MAX_DELAY_SECONDS {
        return Err("Le délai ne peut pas dépasser 24 heures.".into());
    }

    match action {
        "shutdown" => Ok(("/s", "Extinction programmée par ShutdownPro")),
        "restart" => Ok(("/r", "Redémarrage programmé par ShutdownPro")),
        _ => Err("Action inconnue.".into()),
    }
}

/// Programme l'extinction ou le redémarrage de l'ordinateur dans `seconds`
/// secondes. `action` vaut `"shutdown"` ou `"restart"`.
#[tauri::command]
fn schedule_shutdown(seconds: u32, action: String) -> Result<(), String> {
    let (flag, message) = validate_schedule_args(seconds, &action)?;

    let secs_str = seconds.to_string();
    let output = run_shutdown_command(&[flag, "/t", &secs_str, "/c", message])?;

    if output.status.success() {
        Ok(())
    } else {
        Err(command_error(&output))
    }
}

/// Construit un message d'erreur à partir de la sortie de `shutdown`, avec un
/// message de repli si la commande a échoué sans rien écrire sur stderr.
fn command_error(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return stderr;
    }

    match output.status.code() {
        Some(code) => format!("La commande shutdown a échoué (code de sortie : {code})."),
        None => "La commande shutdown a échoué.".to_string(),
    }
}

/// Annule une extinction précédemment programmée, y compris si elle a été
/// programmée lors d'une session précédente de l'application.
fn do_cancel_shutdown() -> Result<(), String> {
    let output = run_shutdown_command(&["/a"])?;

    if output.status.success() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    if output.status.code() == Some(ERROR_NO_SHUTDOWN_IN_PROGRESS) {
        return Err("Aucune extinction n'était programmée.".into());
    }

    Err(command_error(&output))
}

#[tauri::command]
fn cancel_shutdown() -> Result<(), String> {
    do_cancel_shutdown()
}

/// Éteint ou redémarre l'ordinateur sans délai. `action` vaut `"shutdown"`
/// ou `"restart"`.
fn do_immediate_action(action: &str) -> Result<(), String> {
    let (flag, message) = immediate_action_args(action)?;

    let output = run_shutdown_command(&[flag, "/t", "0", "/c", message])?;

    if output.status.success() {
        Ok(())
    } else {
        Err(command_error(&output))
    }
}

/// Résout le flag `shutdown` et le message pour une action immédiate.
/// Logique pure, séparée de `do_immediate_action` pour être testable sans
/// jamais invoquer la vraie commande `shutdown` système.
fn immediate_action_args(action: &str) -> Result<(&'static str, &'static str), String> {
    match action {
        "shutdown" => Ok(("/s", "Extinction immédiate par ShutdownPro")),
        "restart" => Ok(("/r", "Redémarrage immédiat par ShutdownPro")),
        _ => Err("Action inconnue.".into()),
    }
}

#[derive(Clone, serde::Serialize)]
struct CancelResult {
    success: bool,
    message: String,
}

/// Résultat d'une action d'extinction/redémarrage déclenchée depuis le menu
/// du system tray, envoyé à la fenêtre principale pour qu'elle reste
/// synchronisée (countdown affiché, message d'erreur, etc.).
#[derive(Clone, serde::Serialize)]
struct TrayScheduleResult {
    success: bool,
    message: String,
    seconds: Option<u32>,
    action: String,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Traite un clic sur une entrée `shutdown_*`/`restart_*` du menu tray.
/// `spec` vaut `"now"` pour une action immédiate, ou un nombre de secondes.
fn handle_tray_schedule(app: &AppHandle, action: &str, spec: &str) {
    let (result, seconds) = if spec == "now" {
        (do_immediate_action(action), None)
    } else {
        match spec.parse::<u32>() {
            Ok(seconds) => (
                schedule_shutdown(seconds, action.to_string()),
                Some(seconds),
            ),
            Err(_) => (Err("Délai invalide.".to_string()), None),
        }
    };

    // Pour une action programmée, on affiche la fenêtre pour que le
    // countdown soit visible. Une action immédiate réussie n'a pas cet
    // intérêt (le PC s'éteint de toute façon), mais un ÉCHEC doit toujours
    // afficher la fenêtre : sinon l'utilisateur croit avoir déclenché
    // l'extinction alors que rien ne s'est passé, sans aucun signal visible.
    let failed = result.is_err();
    if seconds.is_some() || failed {
        show_main_window(app);
    }

    let (success, message) = match result {
        Ok(()) => (true, String::new()),
        Err(err) => (false, err),
    };

    let payload = TrayScheduleResult {
        success,
        message,
        seconds,
        action: action.to_string(),
    };
    let _ = app.emit("tray-schedule-result", payload);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--hidden"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![schedule_shutdown, cancel_shutdown])
        .setup(|app| {
            let show_item =
                MenuItem::with_id(app, "show", "Afficher ShutdownPro", true, None::<&str>)?;
            let cancel_item =
                MenuItem::with_id(app, "cancel", "Annuler l'extinction", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(
                app,
                "quit",
                "Quitter (n'annule pas une extinction programmée)",
                true,
                None::<&str>,
            )?;
            let separator = PredefinedMenuItem::separator(app)?;

            let shutdown_now_item =
                MenuItem::with_id(app, "shutdown_now", "Maintenant", true, None::<&str>)?;
            let shutdown_15_item =
                MenuItem::with_id(app, "shutdown_900", "Dans 15 minutes", true, None::<&str>)?;
            let shutdown_30_item =
                MenuItem::with_id(app, "shutdown_1800", "Dans 30 minutes", true, None::<&str>)?;
            let shutdown_60_item =
                MenuItem::with_id(app, "shutdown_3600", "Dans 1 heure", true, None::<&str>)?;
            let shutdown_submenu = Submenu::with_items(
                app,
                "Éteindre",
                true,
                &[
                    &shutdown_now_item,
                    &shutdown_15_item,
                    &shutdown_30_item,
                    &shutdown_60_item,
                ],
            )?;

            let restart_now_item =
                MenuItem::with_id(app, "restart_now", "Maintenant", true, None::<&str>)?;
            let restart_15_item =
                MenuItem::with_id(app, "restart_900", "Dans 15 minutes", true, None::<&str>)?;
            let restart_30_item =
                MenuItem::with_id(app, "restart_1800", "Dans 30 minutes", true, None::<&str>)?;
            let restart_60_item =
                MenuItem::with_id(app, "restart_3600", "Dans 1 heure", true, None::<&str>)?;
            let restart_submenu = Submenu::with_items(
                app,
                "Redémarrer",
                true,
                &[
                    &restart_now_item,
                    &restart_15_item,
                    &restart_30_item,
                    &restart_60_item,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &separator,
                    &shutdown_submenu,
                    &restart_submenu,
                    &separator,
                    &cancel_item,
                    &separator,
                    &quit_item,
                ],
            )?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("ShutdownPro")
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "cancel" => {
                        show_main_window(app);
                        let result = do_cancel_shutdown();
                        let payload = match &result {
                            Ok(()) => CancelResult {
                                success: true,
                                message: "Extinction annulée.".into(),
                            },
                            Err(message) => CancelResult {
                                success: false,
                                message: message.clone(),
                            },
                        };
                        let _ = app.emit("tray-cancel-result", payload);
                    }
                    "quit" => app.exit(0),
                    other => {
                        if let Some(spec) = other.strip_prefix("shutdown_") {
                            handle_tray_schedule(app, "shutdown", spec);
                        } else if let Some(spec) = other.strip_prefix("restart_") {
                            handle_tray_schedule(app, "restart", spec);
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // La fenêtre est créée cachée (voir tauri.conf.json). On ne
            // l'affiche que si l'application n'a pas été lancée par
            // l'autostart Windows (flag `--hidden` ajouté par le plugin).
            let launched_hidden = std::env::args().any(|arg| arg == "--hidden");
            if !launched_hidden {
                show_main_window(app.handle());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::process::ExitStatusExt;
    use std::process::ExitStatus;

    fn output_with_code(code: i32) -> Output {
        Output {
            status: ExitStatus::from_raw(code as u32),
            stdout: Vec::new(),
            stderr: Vec::new(),
        }
    }

    fn output_with_stderr(code: i32, stderr: &str) -> Output {
        Output {
            status: ExitStatus::from_raw(code as u32),
            stdout: Vec::new(),
            stderr: stderr.as_bytes().to_vec(),
        }
    }

    // --- validate_schedule_args : jamais d'appel à la vraie commande shutdown ---

    #[test]
    fn rejects_zero_seconds() {
        let err = validate_schedule_args(0, "shutdown").unwrap_err();
        assert!(err.contains("supérieur à 0"));
    }

    #[test]
    fn rejects_delay_over_24h() {
        let err = validate_schedule_args(MAX_DELAY_SECONDS + 1, "shutdown").unwrap_err();
        assert!(err.contains("24 heures"));
    }

    #[test]
    fn accepts_exactly_24h() {
        assert!(validate_schedule_args(MAX_DELAY_SECONDS, "shutdown").is_ok());
    }

    #[test]
    fn accepts_minimum_one_second() {
        assert!(validate_schedule_args(1, "restart").is_ok());
    }

    #[test]
    fn rejects_unknown_action() {
        let err = validate_schedule_args(60, "hibernate").unwrap_err();
        assert_eq!(err, "Action inconnue.");
    }

    #[test]
    fn shutdown_action_maps_to_s_flag() {
        let (flag, _) = validate_schedule_args(60, "shutdown").unwrap();
        assert_eq!(flag, "/s");
    }

    #[test]
    fn restart_action_maps_to_r_flag() {
        let (flag, _) = validate_schedule_args(60, "restart").unwrap();
        assert_eq!(flag, "/r");
    }

    // --- immediate_action_args ---

    #[test]
    fn immediate_rejects_unknown_action() {
        assert!(immediate_action_args("sleep").is_err());
    }

    #[test]
    fn immediate_shutdown_maps_to_s_flag() {
        let (flag, _) = immediate_action_args("shutdown").unwrap();
        assert_eq!(flag, "/s");
    }

    #[test]
    fn immediate_restart_maps_to_r_flag() {
        let (flag, _) = immediate_action_args("restart").unwrap();
        assert_eq!(flag, "/r");
    }

    // --- command_error ---

    #[test]
    fn command_error_prefers_stderr() {
        let output = output_with_stderr(1, "  accès refusé  \n");
        assert_eq!(command_error(&output), "accès refusé");
    }

    #[test]
    fn command_error_falls_back_to_exit_code() {
        let output = output_with_code(5);
        assert_eq!(
            command_error(&output),
            "La commande shutdown a échoué (code de sortie : 5)."
        );
    }

    #[test]
    fn command_error_falls_back_to_generic_message_on_empty_stderr() {
        let output = output_with_stderr(0, "");
        // status.success() ne fait pas partie de command_error : on vérifie
        // juste la branche "code présent, stderr vide".
        assert!(command_error(&output).contains("code de sortie"));
    }
}
