use resuma::prelude::*;

pub fn page(_req: FlowRequest) -> View {
    let mode = use_signal("drive".to_string());
    let status = use_signal("Arrancando WebGPU…".to_string());
    let speed = use_signal("0".to_string());

    visible_task!(
        r#"
        async (state, __resuma) => {
            const canvas = document.getElementById("formula-canvas");
            if (!canvas) {
                state.status.set("Canvas ausente");
                return;
            }

            for (let i = 0; i < 80 && !window.FormulaGpu; i++) {
                await new Promise((r) => setTimeout(r, 40));
            }
            if (!window.FormulaGpu) {
                state.status.set("Client formula-gpu no cargó");
                return;
            }

            let api = null;
            let alive = true;
            try {
                api = await window.FormulaGpu.create(canvas, {
                    onHud: (hud) => {
                        if (!alive) return;
                        if (hud.speed != null) state.speed.set(String(Math.round(hud.speed)));
                        if (hud.status) state.status.set(String(hud.status));
                    },
                });
                const m = String(state.mode.value || "drive");
                api.setMode(m);
                document.querySelectorAll("[data-mode]").forEach((b) => {
                    b.dataset.active = b.getAttribute("data-mode") === m ? "true" : "false";
                });
                state.status.set("Listo · WASD / flechas en Drive");
            } catch (e) {
                state.status.set("Error: " + (e && e.message ? e.message : e));
                return;
            }

            window.__formula = {
                setMode: (m) => {
                    state.mode.set(String(m));
                    document.querySelectorAll("[data-mode]").forEach((b) => {
                        b.dataset.active = b.getAttribute("data-mode") === m ? "true" : "false";
                    });
                    api && api.setMode(m);
                },
            };

            return () => {
                alive = false;
                try { api && api.destroy(); } catch (_) {}
                delete window.__formula;
            };
        }
        "#,
        mode,
        status,
        speed
    );

    view! {
        <div class="stage">
            <div class="viewport">
                {client_component(
                    ClientComponent::new("formula-gpu")
                        .class("formula-gpu-boot")
                        .aria_hidden(true)
                )}
                <canvas id="formula-canvas" aria-label="Resuma Formula WebGPU" tabindex="0"></canvas>
                <div class="hud">
                    <div class="hud-speed">{speed}<span>" km/h"</span></div>
                    <div class="hud-status">{status}</div>
                </div>
            </div>
            <aside class="panel">
                <h1>"Desk toy · F1"</h1>
                <p class="lede">
                    "Tres modos como el showcase Formula: mesa de kit, conducción WASD y estudio orbit."
                </p>
                <div class="modes">
                    <button type="button" data-mode="kit" onClick={js! { window.__formula?.setMode("kit"); }}>"Kit"</button>
                    <button type="button" data-mode="drive" data-active="true" onClick={js! { window.__formula?.setMode("drive"); }}>"Drive"</button>
                    <button type="button" data-mode="studio" onClick={js! { window.__formula?.setMode("studio"); }}>"Studio"</button>
                </div>
                <ul class="tips">
                    <li><b>"Drive"</b>" — W/S acelerar · A/D girar · espacio freno"</li>
                    <li><b>"Kit"</b>" — piezas en la esterilla azul"</li>
                    <li><b>"Studio"</b>" — órbita del coche (arrastrar)"</li>
                </ul>
                <p class="note">
                    "Inspirado en "
                    <a href="https://www.webgpu.com/showcase/formula-f1-model-kit-webgl/" target="_blank" rel="noreferrer">"webgpu.com/Formula"</a>
                    " (demo cerrado). Código 100% propio · Resuma + WebGPU."
                </p>
            </aside>
        </div>
    }
}
