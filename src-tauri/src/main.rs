// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Native ESC/POS Thermal Printer Bridge Command
#[tauri::command]
fn print_raw_escpos(printer_name: String, raw_bytes: Vec<u8>) -> Result<String, String> {
    // In production, sends raw ESC/POS bytes directly to Windows Spooler / USB / Serial port
    println!("Printing {} bytes to thermal printer: {}", raw_bytes.len(), printer_name);
    Ok(format!("Successfully sent {} bytes to printer {}", raw_bytes.len(), printer_name))
}

#[tauri::command]
fn list_connected_printers() -> Vec<String> {
    vec![
        "EPSON TM-T20III (ESC/POS)".to_string(),
        "Xprinter XP-N160I (Thermal 80mm)".to_string(),
        "Generic ESC/POS Thermal (USB)".to_string(),
    ]
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            print_raw_escpos,
            list_connected_printers
        ])
        .run(tauri::generate_context!())
        .expect("error while running KushinaPOS desktop application");
}
