use resuma::prelude::*;

pub fn page(_req: FlowRequest) -> View {
    view! {
        <article class="about">
            <h1>"Notas de investigación"</h1>
            <p>
                "El showcase "
                <a href="https://www.webgpu.com/showcase/formula-f1-model-kit-webgl/" target="_blank" rel="noreferrer">
                    "Formula (Patrick Heintzmann)"
                </a>
                " no publica repositorio. La demo vive en "
                <a href="https://lab.patrickheintzmann.com/demo/demoFormula" target="_blank" rel="noreferrer">
                    "lab.patrickheintzmann.com"
                </a>
                ". Este proyecto reinterpreta la idea (kit → drive → studio) en Resuma + WebGPU nativo."
            </p>
            <h2>"Repos abiertos del showcase (página 1 + referentes)"</h2>
            <ul>
                <li><a href="https://github.com/momentchan/false-earth" target="_blank" rel="noreferrer">"false-earth"</a>" — planeta GPU / compute grass"</li>
                <li><a href="https://github.com/ekzhang/jax-js" target="_blank" rel="noreferrer">"jax-js"</a>" — kernels WebGPU"</li>
                <li><a href="https://github.com/joshuagarcia-git/still-night" target="_blank" rel="noreferrer">"still-night"</a></li>
                <li><a href="https://github.com/apssouza22/webgpu-video-cluster" target="_blank" rel="noreferrer">"webgpu-video-cluster"</a></li>
                <li><a href="https://github.com/Manishbhai9350/Curvy-Project-Showcase" target="_blank" rel="noreferrer">"Curvy-Project-Showcase"</a></li>
            </ul>
            <p class="note">"Inventario: apps/webgpu-showcase-repos.json"</p>
        </article>
    }
}
