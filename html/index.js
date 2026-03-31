// OWLFILMS.CAP — index.js v38 (The Roaming Path Bypass)
const cs = new CSInterface();
let fs = null;
try { fs = require('fs'); } catch(e) { }

let captionItems = [];
let selectedMogrt = null;
let selectedIntroMogrt = null;
let currentEditingNodeId = null;
let discoveredProps = {};
let geminiKey = localStorage.getItem("gemini_api_key") || "";

function log(level, msg) {
  const c = document.getElementById("consoleLogs");
  if(!c) return;
  const d = document.createElement("div");
  d.style.color = level==="error"?"#fca5a5":level==="warn"?"#fde047":"#22c55e";
  d.style.whiteSpace = "pre-wrap";
  d.style.marginTop = "4px";
  d.innerText = "> [" + level.toUpperCase() + "] " + msg;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    // Auto remove after 5s
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(-20px)";
        toast.style.transition = "0.5s";
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

function getExtPath() {
    let p = cs.getSystemPath(SystemPath.EXTENSION);
    p = decodeURI(p).replace(/^file:\/{2,3}/, "");
    if (p.match(/^\/[A-Z]:/i)) p = p.substring(1);
    return p.replace(/\\/g, "/");
}
async function smartIdentify() {
  log("info", "Iniciando Sincronia C1 (EPR Bypass)...");
  try {
      const cleanPath = getExtPath();
      const selCap = document.getElementById("selCaptionTrack");
      const capTrackIdx = (selCap && selCap.value !== "") ? selCap.value : 0;
      log("info", "Sincronizando de C" + (parseInt(capTrackIdx)+1) + "...");
      
      const eprRes = await new Promise(r => cs.evalScript(`OWL.forceExportCaptionsEPR("${cleanPath}", ${capTrackIdx})`, r));
      
      if (eprRes && !eprRes.startsWith("ERR:")) {
         log("success", "Legendas C1 capturadas com sucesso!");
         loadData(eprRes);
      } else {
         log("error", eprRes ? eprRes.replace("ERR:", "") : "Falha na ponte JSX.");
         log("warn", "Tente exportar o SRT manualmente se falhar 3x.");
      }
  } catch(e) {
      log("error", "Exceção no SYNC: " + e.message);
  }
}

async function loadData(path) {
  if (path === "CANCEL") return;
  log("info", "Processando SRT Localmente: " + path.split("\\").pop());
  
  try {
      if (!fs) throw new Error("Acesso negado ao sistema de arquivos.");
      const buffer = fs.readFileSync(path);
      let content = "";
      // Autodetect Encoding
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) content = buffer.toString('utf16le');
      else if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) content = buffer.toString('utf8', 3);
      else content = buffer.toString('utf8');
      
      let items = [];
      const blocks = content.split(/\n\s*\n|\r\n\s*\r\n/);
      for (let i = 0; i < blocks.length; i++) {
          const lines = blocks[i].replace(/^\s+|\s+$/g, "").split(/\r?\n/);
          if (lines.length >= 3 && lines[1].includes(" --> ")) {
              const times = lines[1].split(" --> ");
              const text = lines.slice(2).join(" ").replace(/<[^>]*>/g, "");
              const p1 = times[0].replace(",", ".").split(":");
              const start = parseFloat(p1[0])*3600 + parseFloat(p1[1])*60 + parseFloat(p1[2]);
              const p2 = times[1].replace(",", ".").split(":");
              const end = parseFloat(p2[0])*3600 + parseFloat(p2[1])*60 + parseFloat(p2[2]);
              items.push({ text, start, end });
          }
      }
      
      if (items.length > 0) {
          captionItems = items;
          document.getElementById("captionSummary").style.display="block";
          document.getElementById("captionCountLabel").textContent = items.length + " Legendas Detectadas!";
          log("success", "Feito! Selecione o Estilo MOGRT abaixo e clique Inserir!");
          checkReady();
          checkAiReady();
      } else { log("error", "O arquivo SRT está vazio."); }
  } catch(e) { log("error", "Falha absurda na leitura local: " + e.message); }
}

function checkReady() {
  document.getElementById("btnInsert").disabled = !(captionItems.length > 0 && selectedMogrt);
  document.getElementById("btnInsertIntro").disabled = !selectedIntroMogrt;
}

// ── Updates ──
const bUpdatePlugin = document.getElementById("btnUpdatePlugin");
if (bUpdatePlugin) {
    bUpdatePlugin.onclick = () => {
        bUpdatePlugin.innerText = "⏳ UPDATING...";
        bUpdatePlugin.disabled = true;
        
        try {
            const exec = require('child_process').exec;
            const cwd = getExtPath();
            
            const psUpdate = () => {
                log("warn", "Tentando atualização via download direto (PowerShell)...");
                const psCommand = `powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://github.com/OWLFILMSPRO/owlcaptions/archive/refs/heads/main.zip'; $zip = 'update.zip'; Invoke-WebRequest -Uri $url -OutFile $zip; Expand-Archive -Path $zip -DestinationPath 'temp_update' -Force; Copy-Item -Path 'temp_update\\owlcaptions-main\\*' -Destination '.' -Recurse -Force; Remove-Item 'temp_update' -Recurse; Remove-Item $zip]"`;
                
                exec(psCommand, { cwd: cwd }, (psErr) => {
                    bUpdatePlugin.innerText = "🔄 UPDATE";
                    bUpdatePlugin.disabled = false;
                    if (psErr) {
                        log("error", "Erro Falback: " + psErr.message);
                        showToast("Não foi possível atualizar automaticamente.", "error");
                        return;
                    }
                    log("success", "Plugin atualizado com sucesso!");
                    showToast("Plugin atualizado com sucesso via download direto! Por favor, reinicie a extensão.", "success");
                });
            };

            // 1. Tenta via Git primeiro
            exec('git --version', (errVersion) => {
                if (!errVersion) {
                    log("info", "Git detectado, tentando pull...");
                    exec('git pull origin main', { cwd: cwd }, (error, stdout, stderr) => {
                        if (error) {
                            log("warn", "Git Pull falhou (provavelmente não é um repo). Usando fallback...");
                            psUpdate();
                            return;
                        }
                        
                        bUpdatePlugin.innerText = "🔄 UPDATE";
                        bUpdatePlugin.disabled = false;
                        if (stdout.includes("up to date") || stdout.includes("Already up to date")) {
                            showToast("O plugin já está atualizado!");
                        } else {
                            showToast("Plugin atualizado via Git! Reinicie a extensão.", "success");
                        }
                    });
                } else {
                    // 2. Fallback direto se não tiver Git
                    psUpdate();
                }
            });
        } catch(e) {
            bUpdatePlugin.innerText = "🔄 UPDATE";
            bUpdatePlugin.disabled = false;
            log("error", "Erro Node.js ao atualizar: " + e.message);
        }
    };
}

// ── Gemini IA Logic ──
const inputKey = document.getElementById("geminiApiKey");
const sliderCuts = document.getElementById("numCuts");
const valCuts = document.getElementById("valNumCuts");
const btnAi = document.getElementById("btnGenerateAICuts");
const aiStatus = document.getElementById("aiStatus");

if (inputKey) {
    inputKey.value = geminiKey;
    inputKey.oninput = (e) => {
        geminiKey = e.target.value;
        localStorage.setItem("gemini_api_key", geminiKey);
        checkAiReady();
    };
}

if (sliderCuts) {
    sliderCuts.oninput = (e) => {
        valCuts.innerText = e.target.value;
    };
}

function checkAiReady() {
    if (btnAi) {
        btnAi.disabled = !(captionItems.length > 0 && geminiKey.length > 10);
        btnAi.style.opacity = btnAi.disabled ? "0.5" : "1";
    }
}

async function callGeminiAI(srtText, count) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    
    const prompt = `Você é um editor de vídeos especialista em podcasts e cortes virais. 
Analise a transcrição SRT abaixo e selecione os ${count} melhores trechos (mais interessantes, engraçados ou polêmicos) para criar cortes curtos.
IMPORTANTE: Retorne APENAS um array JSON puro, sem formatação markdown, seguindo este modelo:
[{"start": segundos, "end": segundos, "topic": "título curto"}]

Transcrição:
${srtText}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Erro na API do Gemini");
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    // Limpeza básica se o modelo retornar markdown
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
}

if (btnAi) {
    btnAi.onclick = async () => {
        try {
            log("info", "Iniciando análise de IA...");
            aiStatus.style.display = "block";
            aiStatus.innerText = "🤖 Gemini analisando transcrição...";
            btnAi.disabled = true;

            // Formata SRT Simplificado para economizar tokens
            const simplifiedSRT = captionItems.map((item, idx) => `[${item.start}-${item.end}] ${item.text}`).join("\n");
            
            const segments = await callGeminiAI(simplifiedSRT, sliderCuts.value);
            
            log("success", `IA encontrou ${segments.length} destaques!`);
            aiStatus.innerText = "🎬 Criando cortes na timeline...";

            cs.evalScript(`OWL.createAIHighlights(${JSON.stringify(segments)})`, (res) => {
                aiStatus.style.display = "none";
                btnAi.disabled = false;
                if (res === "success") {
                    log("success", "Sequência de CORTES IA criada com sucesso!");
                    showToast("Cortes gerados em uma nova sequência!", "success");
                } else {
                    log("error", "Erro ao criar cortes: " + res);
                }
            });

        } catch (e) {
            log("error", "Falha na IA: " + e.message);
            aiStatus.style.display = "none";
            btnAi.disabled = false;
        }
    };
}

// ── Cliques ──
const bLoadT = document.getElementById("btnLoadTranscript");
if (bLoadT) bLoadT.onclick = () => { smartIdentify(); };

const bManSRT = document.getElementById("btnManualSRT");
if (bManSRT) bManSRT.onclick = () => { 
    window.focus();
    setTimeout(() => cs.openFileDialog("Escolha o SRT exportado", "Subtitles:*.srt", false), 100);
};

window.addEventListener("manualFileSelected", (e) => {
    loadData(e.detail);
});

const bImpM = document.getElementById("btnImportMogrt");
if (bImpM) bImpM.onclick = () => { 
    window.focus(); 
    setTimeout(() => cs.importMogrtDialog("Selecione um arquivo .mogrt"), 100);
};

const bImpIntroPicker = document.getElementById("btnImportIntroPicker");
if (bImpIntroPicker) bImpIntroPicker.onclick = () => {
    window.focus();
    setTimeout(() => {
        cs.evalScript('OWL.openFilePicker("Selecione um arquivo .mogrt para Intro", "Motion Graphics Template:*.mogrt")', function(res) {
            if(res && res !== "") {
                window.dispatchEvent(new CustomEvent("importIntroFileSelected", { detail: res }));
            }
        });
    }, 100);
};

window.addEventListener("importIntroFileSelected", (e) => {
    try {
        const source = e.detail;
        const targetDir = getExtPath() + "/intros";
        let fileName = source.split(/[\\/]/).pop();
        
        const targetPath = targetDir + "/" + fileName;
        
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(source, targetPath);
        log("success", "Intro adicionada com sucesso!");
        initGallery();
    } catch(err) {
        log("error", "Erro ao importar intro: " + err.message);
    }
});

window.addEventListener("importFileSelected", (e) => {
    try {
        const source = e.detail;
        const targetDir = getExtPath() + "/mogrts";
        const fileName = source.split(/[\\/]/).pop();
        const targetPath = targetDir + "/" + fileName;
        
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(source, targetPath);
        log("success", "Estilo '" + fileName + "' adicionado com sucesso!");
        initGallery(); // Recarrega a galeria
    } catch(err) {
        log("error", "Erro ao importar: " + err.message);
    }
});

const bIns = document.getElementById("btnInsert");
if (bIns) bIns.onclick = () => {
    log("info", "Inserindo clipes...");
    const selVid = document.getElementById("selVideoTrack");
    const vidTrackIdx = parseInt(selVid ? selVid.value : "0");
    log("info", "Track de Vídeo Alvo: " + (vidTrackIdx === -1 ? "NOVA FAIXA" : "V" + (vidTrackIdx + 1)));
    
    cs.evalScript(`OWL.createCaptions(${JSON.stringify(captionItems)}, ${JSON.stringify(selectedMogrt)}, ${vidTrackIdx})`, (res) => {
        try {
            const data = JSON.parse(res);
            if(data.status === "success") {
                log("success", "MOGRTs aplicados com sucesso! FIM DO PROCESSO.");
                if (data.clips && data.clips.length > 0) {
                    openEditor(data.clips[0]); // Abre editor para a primeira legenda
                }
            } else {
                log("error", "Erro do Timeline: " + res);
                showToast("Erro ao gerar legendas.", "error");
            }
        } catch(e) {
            log("error", "Erro parse: " + res);
        }
    });
};

const bInsIntro = document.getElementById("btnInsertIntro");
if (bInsIntro) bInsIntro.onclick = () => {
    log("info", "Inserindo Intro...");
    const selVid = document.getElementById("selVideoTrack");
    const vidTrackIdx = parseInt(selVid ? selVid.value : "0");
    log("info", "Track de Intro Alvo: " + (vidTrackIdx === -1 ? "ULTIMA FAIXA" : "V" + (vidTrackIdx + 1)));

    if (!selectedIntroMogrt) { log("warn", "Selecione uma Intro primeiro!"); return; }
    
    cs.evalScript(`OWL.importIntroMogrt(${JSON.stringify(selectedIntroMogrt)}, ${vidTrackIdx})`, (res) => {
        try {
            const data = JSON.parse(res);
            if(data.status === "success") {
                log("success", "Intro aplicada com sucesso!");
                openEditor(data.nodeId);
            } else {
                log("error", "Erro Intro: " + res);
                showToast("Erro ao importar Intro.", "error");
            }
        } catch(e) {
            log("error", "Erro parse Intro: " + res);
        }
    });
};

// End of Event Listeners

async function initGallery() {
  const grid = document.getElementById("galleryGrid");
  const introGrid = document.getElementById("introGrid");
  if (!fs) {
     grid.innerHTML = "<p style='color:#71717a; font-size:10px; text-align:center;'>Node.js inativo.</p>";
     return;
  }
  
  try {
      const extPath = getExtPath();
      const mogrtsPath = extPath + "/mogrts";
      const introsPath = extPath + "/intros";
      
      if (!fs.existsSync(mogrtsPath)) fs.mkdirSync(mogrtsPath, { recursive: true });
      if (!fs.existsSync(introsPath)) fs.mkdirSync(introsPath, { recursive: true });
      
      log("info", "Lendo pastas: mogrts, intros");
      
      const styleFiles = fs.readdirSync(mogrtsPath).filter(f => f.toLowerCase().endsWith(".mogrt")).sort((a,b) => fs.statSync(mogrtsPath + "/" + a).mtimeMs - fs.statSync(mogrtsPath + "/" + b).mtimeMs);
      const introFiles = fs.readdirSync(introsPath).filter(f => f.toLowerCase().endsWith(".mogrt")).sort((a,b) => fs.statSync(introsPath + "/" + a).mtimeMs - fs.statSync(introsPath + "/" + b).mtimeMs);
      
      log("info", `MOGRTs: ${styleFiles.length} Estilos, ${introFiles.length} Intros`);

      grid.innerHTML = "";
      introGrid.innerHTML = "";
      
      // Processa ESTILOS
      if (styleFiles.length > 0) {
          styleFiles.forEach((file) => {
              const baseName = file.replace(".mogrt", "");
              const styleName = baseName.replace("9•16 ", "").replace(" Subtitles", "");
              const thumbFile = mogrtsPath + "/" + baseName + ".png";
              
              const m = { name: styleName, mogrtFile: mogrtsPath + "/" + file };
              const el = document.createElement("div"); 
              el.className = "gallery-card";
              
              if (thumbFile && fs.existsSync(thumbFile)) {
                  const base64 = fs.readFileSync(thumbFile).toString('base64');
                  el.innerHTML = `
                    <div style="width:100%; aspect-ratio:16/9; overflow:hidden; background:#000;">
                        <img src="data:image/png;base64,${base64}" style="width:100%; height:100%; object-fit:cover; opacity:0.8;">
                    </div>
                    <div class="style-name" style="font-size: 7px; padding: 4px;">${styleName}</div>
                  `;
              } else {
                  el.innerHTML = `<div style="height:40px; display:flex; align-items:center; justify-content:center; background:#111;">🖼️</div><div class="style-name" style="font-size: 7px; padding: 4px;">${styleName}</div>`;
              }
              
              el.onclick = () => { 
                 selectedMogrt = m; 
                 grid.querySelectorAll(".gallery-card").forEach(c => c.classList.remove("active"));
                 el.classList.add("active"); 
                 checkReady();
              };
              grid.appendChild(el);
          });
      } else {
          grid.innerHTML = "<p style='color:#71717a; font-size:10px; text-align:center; grid-column:1/3;'>Nenhum Estilo encontrado.</p>";
      }
      
      // Processa INTROS
      if (introFiles.length > 0) {
          introFiles.forEach((file) => {
              const baseName = file.replace(".mogrt", "");
              const styleName = baseName; // Intros don't format much
              
              const m = { name: styleName, mogrtFile: introsPath + "/" + file };
              const el = document.createElement("div"); 
              el.className = "gallery-card";
              
              el.style.justifyContent = "center";
              el.innerHTML = `<div class="style-name" style="font-size: 8px; padding: 12px; width: 100%; text-align: center; border: none; background: transparent;">${styleName}</div>`;
              
              el.onclick = () => { 
                 selectedIntroMogrt = m;
                 introGrid.querySelectorAll(".gallery-card").forEach(c => c.classList.remove("active"));
                 el.classList.add("active"); 
                 checkReady();
              };
              introGrid.appendChild(el);
          });
      } else {
          introGrid.innerHTML = "<p style='color:#71717a; font-size:10px; text-align:center; grid-column:1/3;'>Nenhuma Intro encontrada.</p>";
      }
      
  } catch(e) {
      grid.innerHTML = `<p style='color:#fca5a5; font-size:10px; text-align:center; grid-column:1/3;'>Falha ao ler pasta: ${e.message}</p>`;
  }
}

async function updateTrackSelectors() {
    const infoStr = await new Promise(r => cs.evalScript(`OWL.getTimelineInfo()`, r));
    try {
        let info;
        if (infoStr && infoStr.indexOf("{") === 0) {
            info = JSON.parse(infoStr);
        } else {
            log("error", "Erro ao obter info da Timeline. Tentando novamente...");
            info = { videoCount: 0, captionCount: 0 };
        }
        
        if (info.error) { log("error", "Erro Timeline: " + info.error); return; }
        
        const selCap = document.getElementById("selCaptionTrack");
        const selVid = document.getElementById("selVideoTrack");
        if (!selVid) return;

        const oldVid = selVid.value;

        if (selCap) {
            const oldCap = selCap.value;
            selCap.options.length = 0;
            if (info.captionCount > 0) {
                for (let i = 0; i < info.captionCount; i++) {
                    const opt = new Option(`C${i+1} (Caption ${i+1})`, i);
                    selCap.add(opt);
                }
            } else {
                selCap.add(new Option("C1 (Auto)", 0));
            }
            if (oldCap !== "" && parseInt(oldCap) < info.captionCount) selCap.value = oldCap;
        }

        // Limpa e repopula vídeo
        selVid.options.length = 0;
        selVid.add(new Option("✨ ULTIMA FAIXA", -1));
        for (let j = 0; j < info.videoCount; j++) {
            selVid.add(new Option(`V${j+1} (Video ${j+1})`, j));
        }

        // Restaura seleções
        if (oldCap !== "" && parseInt(oldCap) < info.captionCount) selCap.value = oldCap;
        
        if (oldVid === "-1") selVid.value = "-1";
        else if (oldVid !== "" && parseInt(oldVid) < info.videoCount) selVid.value = oldVid;
        else if (info.videoCount >= 4) selVid.value = "3";
        else if (info.videoCount > 0) selVid.value = info.videoCount - 1;

        updateSyncButtonText();

    } catch(e) { log("error", "Falha no update de trilhas: " + e.message); }
}

function updateSyncButtonText() {
    const selCap = document.getElementById("selCaptionTrack");
    const bLoadT = document.getElementById("btnLoadTranscript");
    if (bLoadT) {
        if (selCap) {
            const val = selCap.value;
            const idx = (val !== "" && !isNaN(val)) ? parseInt(val) : 0;
            bLoadT.innerText = `🔍 SYNC C${idx + 1}`;
        } else {
            bLoadT.innerText = `🔍 SYNC C1`;
        }
    }
}

const selCap = document.getElementById("selCaptionTrack");
if (selCap) selCap.onchange = updateSyncButtonText;

const bRef = document.getElementById("btnRefreshTracks");
if (bRef) bRef.onclick = () => {
    log("info", "Atualizando trilhas...");
    updateTrackSelectors();
};

// ── MOGRT Editor Logic ──

const editorContainer = document.getElementById("editorContainer");
const mainContent = Array.from(document.body.children).filter(el => el.id !== "editorContainer" && el.id !== "toastContainer" && el.tagName !== "SCRIPT");

function openEditor(nodeId) {
    currentEditingNodeId = nodeId;
    
    // Hide main UI
    mainContent.forEach(el => el.style.display = "none");
    editorContainer.style.display = "block";
    
    log("info", "Carregando propriedades do MOGRT...");
    
    cs.evalScript(`OWL.getMogrtProperties("${nodeId}")`, (res) => {
        try {
            const props = JSON.parse(res);
            log("info", "Propriedades carregadas.");
            syncEditorUI(props);
        } catch(e) {
            log("error", "Erro ao carregar propriedades: " + res);
        }
    });
}

function closeEditor() {
    editorContainer.style.display = "none";
    mainContent.forEach(el => {
        if (el.id === "captionSummary" && captionItems.length === 0) return;
        el.style.display = "";
    });
}

document.getElementById("btnBackToMain").onclick = closeEditor;

function syncEditorUI(props) {
    discoveredProps = {}; // Reset discovery
    
    // Mapping properties based on common MOGRT names
    const mapping = {
        "Line 1": ["Source Text", "Text", "texto", "Line 1"],
        "Line 2": ["Source Text 2", "Text 2", "texto 2", "Line 2"],
        "Size1": ["Font Size", "Size", "Tamanho"],
        "Size2": ["Font Size 2", "Size 2", "Tamanho 2"],
        "Pos1": ["Position", "Posição"],
        "Pos2": ["Position 2", "Posição 2"],
        "Scale1": ["Scale", "Escala"],
        "Scale2": ["Scale 2", "Escala 2"],
        "Box1": ["Box 1", "Cor 1", "Color 1", "BOX 1"],
        "Box2": ["Box 2", "Cor 2", "Color 2", "BOX 2"],
        "FlagScale": ["Flag Scale", "Escala Bandeira"]
    };

    function findProp(id, keys) {
        for (let k of keys) { 
            if (props[k] !== undefined) {
                discoveredProps[id] = k;
                return { name: k, value: props[k] }; 
            }
        }
        return null;
    }

    const l1 = findProp("Line 1", mapping["Line 1"]);
    if (l1) document.getElementById("editLine1Text").value = l1.value;

    const l2 = findProp("Line 2", mapping["Line 2"]);
    if (l2) document.getElementById("editLine2Text").value = l2.value;

    const s1 = findProp("Size1", mapping["Size1"]);
    if (s1) {
        document.getElementById("editLine1Size").value = s1.value;
        document.getElementById("valLine1Size").innerText = parseFloat(s1.value).toFixed(1);
    }

    const s2 = findProp("Size2", mapping["Size2"]);
    if (s2) {
        document.getElementById("editLine2Size").value = s2.value;
        document.getElementById("valLine2Size").innerText = parseFloat(s2.value).toFixed(1);
    }

    const p1 = findProp("Pos1", mapping["Pos1"]);
    if (p1 && Array.isArray(p1.value)) {
        document.getElementById("editLine1PosX").value = p1.value[0];
        document.getElementById("editLine1PosY").value = p1.value[1];
    }

    const p2 = findProp("Pos2", mapping["Pos2"]);
    if (p2 && Array.isArray(p2.value)) {
        document.getElementById("editLine2PosX").value = p2.value[0];
        document.getElementById("editLine2PosY").value = p2.value[1];
    }

    const sc1 = findProp("Scale1", mapping["Scale1"]);
    if (sc1) document.getElementById("editLine1Scale").value = sc1.value;

    const sc2 = findProp("Scale2", mapping["Scale2"]);
    if (sc2) document.getElementById("editLine2Scale").value = sc2.value;

    const b1 = findProp("Box1", mapping["Box1"]);
    if (b1) document.getElementById("editBox1Color").value = b1.value;

    const b2 = findProp("Box2", mapping["Box2"]);
    if (b2) document.getElementById("editBox2Color").value = b2.value;
    
    const fs = findProp("FlagScale", mapping["FlagScale"]);
    if (fs) {
        document.getElementById("editFlagScale").value = fs.value;
        document.getElementById("valFlagScale").innerText = parseInt(fs.value);
    }
}

function updateProp(id, value) {
    if (!currentEditingNodeId || !discoveredProps[id]) return;
    cs.evalScript(`OWL.setMogrtProperty("${currentEditingNodeId}", "${discoveredProps[id]}", ${JSON.stringify(value)})`);
}

// Event Listeners for Editor
document.getElementById("editLine1Text").oninput = (e) => updateProp("Line 1", e.target.value);
document.getElementById("editLine2Text").oninput = (e) => updateProp("Line 2", e.target.value);

document.getElementById("editLine1Size").oninput = (e) => {
    document.getElementById("valLine1Size").innerText = parseFloat(e.target.value).toFixed(1);
    updateProp("Size1", parseFloat(e.target.value));
};
document.getElementById("editLine2Size").oninput = (e) => {
    document.getElementById("valLine2Size").innerText = parseFloat(e.target.value).toFixed(1);
    updateProp("Size2", parseFloat(e.target.value));
};

const updatePos1 = () => {
    const x = parseFloat(document.getElementById("editLine1PosX").value);
    const y = parseFloat(document.getElementById("editLine1PosY").value);
    updateProp("Pos1", [x, y]);
};
document.getElementById("editLine1PosX").oninput = updatePos1;
document.getElementById("editLine1PosY").oninput = updatePos1;

const updatePos2 = () => {
    const x = parseFloat(document.getElementById("editLine2PosX").value);
    const y = parseFloat(document.getElementById("editLine2PosY").value);
    updateProp("Pos2", [x, y]);
};
document.getElementById("editLine2PosX").oninput = updatePos2;
document.getElementById("editLine2PosY").oninput = updatePos2;

document.getElementById("editLine1Scale").oninput = (e) => updateProp("Scale1", parseFloat(e.target.value));
document.getElementById("editLine2Scale").oninput = (e) => updateProp("Scale2", parseFloat(e.target.value));

document.getElementById("editBox1Color").onchange = (e) => updateProp("Box1", e.target.value);
document.getElementById("editBox2Color").onchange = (e) => updateProp("Box2", e.target.value);

document.getElementById("editFlagScale").oninput = (e) => {
    document.getElementById("valFlagScale").innerText = parseInt(e.target.value);
    updateProp("FlagScale", parseInt(e.target.value));
};

// Inicia no Load
initGallery();
updateTrackSelectors();
checkAiReady();
