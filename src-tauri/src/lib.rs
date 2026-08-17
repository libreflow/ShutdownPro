use std::process::{Command, Output};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
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

/// Programme l'extinction propre de l'ordinateur dans `seconds` secondes.
#[tauri::command]
fn schedule_shutdown(seconds: u32) -> Result<(), String> {
    if seconds == 0 {
        return Err("Le délai doit être supérieur à 0 seconde.".into());
    }

    let secs_str = seconds.to_string();
    let output = run_shutdown_command(&[
        "/s",
        "/t",
        &secs_str,
        "/c",
        "Extinction programmée par ShutdownPro",
    ])?;

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

#[derive(Clone, serde::Serialize)]
struct CancelResult {
    success: bool,
    message: String,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![schedule_shutdown, cancel_shutdown])
        .setup(|app| {
            let show_item =
                MenuItem::with_id(app, "show", "Afficher ShutdownPro", true, None::<&str>)?;
            let cancel_item =
                MenuItem::with_id(app, "cancel", "Annuler l'extinction", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[&show_item, &separator, &cancel_item, &separator, &quit_item],
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
                    _ => {}
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
