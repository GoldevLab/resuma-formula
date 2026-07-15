//! Resuma Formula — WebGPU racing desk-toy (kit / drive / studio).

mod pages;

use pages::PagesRegistry;
use resuma::prelude::*;

const CSS: &str = concat!(
    r#"<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>"#,
    include_str!("../static/styles.css"),
    "</style>"
);

#[layout("/")]
fn RootLayout() -> View {
    view! {
        <div class="shell">
            <header class="top">
                <a class="brand" href="/">"RESUMA "<span>"FORMULA"</span></a>
                <nav>
                    <NavLink href="/" activeClass="active">"Pista"</NavLink>
                    <NavLink href="/about" activeClass="active">"Notas"</NavLink>
                </nav>
            </header>
            <Slot />
        </div>
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    FlowApp::new()
        .with_title("Resuma Formula — WebGPU racing desk-toy")
        .with_description(
            "Carrera mínima en WebGPU + Resuma: modos kit, drive y studio. Inspirado en el showcase Formula (sin código fuente público); implementación propia en Rust/JS.",
        )
        .with_head(CSS)
        .client_asset(
            "formula-gpu",
            include_bytes!("../static/client/formula-gpu.js"),
        )
        .without_pwa()
        .not_found(|| not_found_page())
        .auto_pages(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/pages"),
            PagesRegistry,
        )
        .serve(FlowServeOptions::from_env().with_webgpu_csp())
        .await
}
