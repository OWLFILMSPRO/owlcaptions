// OWLFILMS.CAP — hostscript.jsx v44.5 (Final Focus)
var OWL = {};

OWL.inspectSequence = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERR: No active sequence found.";
        var props = [];
        for (var p in seq) {
            props.push(p);
        }
        return props.join(", ");
    } catch(e) { return "JSX_ERR: " + e.toString(); }
};

if (typeof JSON !== "object") { JSON = {}; }
JSON.stringify = JSON.stringify || function(obj) { return '"' + obj + '"'; };

app.enableQE();

OWL.transcriptHelper = function() {
    try {
        var activeSeq = app.project.activeSequence;
        if (!activeSeq) return "JSX_ERR: Nenhuma sequência ativa. Clique na linha do tempo.";
        
        app.enableQE();
        
        // --- 1. Focus Stealing (Técnica avançada de foco) ---
        // Primeiro: Foca o Painel de Texto (Abre se estiver fechado)
        try { app.executeCommand(3657); } catch(e) {}
        $.sleep(200);
        
        // Segundo: Foca a Aba de Transcrição especificamente
        try { app.executeCommand(3652); } catch(e) {}
        $.sleep(200);
        
        // Terceiro: Volta o foco para a Timeline (CRUCIAL para liberar o comando na sequência ativa)
        // 4011: ID universal para focar o painel de Sequência (Timeline)
        try { app.executeCommand(4011); } catch(e) {}
        $.sleep(300);
        
        // --- 2. Disparo de Comandos (Tentativas múltiplas) ---
        // 4165: Gerar Transcrição Estática (Modal principal CC 2023-2026)
        // 2132: Criar Transcrição (Dialog legado mas estável)
        // 2128: Comando "Transcrição..."
        // 4163: Re-transcrever (Útil se já houver transcrição incompleta)
        
        var commandsToTry = [4165, 2132, 2128, 4163, 4161, 3841, 5145];
        
        for (var i = 0; i < commandsToTry.length; i++) {
            var cid = commandsToTry[i];
            try { 
                app.executeCommand(cid); 
                if (typeof qe !== 'undefined' && qe.command) {
                    qe.command.execute(cid);
                }
            } catch(e) {}
        }
        
        return "success";
    } catch(e) { return "JSX_ERR: " + e.toString(); }
};

OWL.createCaptions = function(data, mogrt, targetTrackIndex) {
    try {
        app.enableQE();
        var seq = app.project.activeSequence;
        if (!seq) return "Sem sequência ativa.";
        
        // Se targetTrackIndex for -1, tenta criar uma nova faixa
        if (targetTrackIndex === -1) {
            targetTrackIndex = OWL.ensureVideoTrack();
        }
        
        var mogrtFile = new File(mogrt.mogrtFile);
        var createdClips = [];
        for (var i = 0; i < data.length; i++) {
            var start = new Time(); start.seconds = data[i].start;
            var end = new Time(); end.seconds = data[i].end;
            
            // Tentativa de Importar
            try {
                var clip = seq.importMGT(mogrtFile.fsName, start.ticks, targetTrackIndex, 0); 
                if (!clip && targetTrackIndex >= seq.videoTracks.numTracks) {
                     targetTrackIndex = seq.videoTracks.numTracks - 1;
                     clip = seq.importMGT(mogrtFile.fsName, start.ticks, targetTrackIndex, 0); 
                }
                
                if (clip) {
                    clip.end = end.ticks;
                    createdClips.push(clip.nodeId);
                    var comp = clip.getMGTComponent();
                    if (comp && comp.properties) {
                       var props = comp.properties;
                       var pText = props.getParamForDisplayName("Text") || 
                                   props.getParamForDisplayName("text") || 
                                   props.getParamForDisplayName("Source Text") || 
                                   props.getParamForDisplayName("texto");
                       
                       if (pText) pText.setValue(data[i].text);
                    }
                }
            } catch(e) {
                 if (targetTrackIndex != seq.videoTracks.numTracks - 1) {
                     targetTrackIndex = seq.videoTracks.numTracks - 1;
                     i--; 
                 }
            }
        }
        return JSON.stringify({ status: "success", clips: createdClips, track: targetTrackIndex });
    } catch(e) { return e.toString(); }
};

OWL.importIntroMogrt = function(mogrt, targetTrackIndex) {
    try {
        app.enableQE();
        var seq = app.project.activeSequence;
        if (!seq) return "Sem sequência ativa.";
        
        if (targetTrackIndex === -1) {
            targetTrackIndex = OWL.ensureVideoTrack();
        }
        
        var mogrtFile = new File(mogrt.mogrtFile);
        var start = new Time(); start.seconds = 0;
        
        try {
            var clip = seq.importMGT(mogrtFile.fsName, start.ticks, targetTrackIndex, 0);
            if (!clip && targetTrackIndex >= seq.videoTracks.numTracks) {
                 targetTrackIndex = seq.videoTracks.numTracks - 1;
                 clip = seq.importMGT(mogrtFile.fsName, start.ticks, targetTrackIndex, 0); 
            }
            if (clip) return JSON.stringify({ status: "success", nodeId: clip.nodeId, track: targetTrackIndex });
            else return "Falha ao importar MOGRT.";
        } catch(e) {
            return "Erro no ImportMGT: " + e.toString();
        }
    } catch(e) { return e.toString(); }
};

OWL.getMogrtProperties = function(nodeId) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "No active sequence";
        
        var clip = null;
        // Search for clip by nodeId across all tracks
        for (var i = 0; i < seq.videoTracks.numTracks; i++) {
            var track = seq.videoTracks[i];
            for (var j = 0; j < track.clips.numItems; j++) {
                if (track.clips[j].nodeId === nodeId) {
                    clip = track.clips[j];
                    break;
                }
            }
            if (clip) break;
        }

        if (!clip) return "Clip not found";
        
        var comp = clip.getMGTComponent();
        if (!comp) return "MGT component not found";
        
        var props = comp.properties;
        var result = {};
        for (var k = 0; k < props.numParameters; k++) {
            var p = props[k];
            result[p.displayName] = p.getValue();
        }
        return JSON.stringify(result);
    } catch(e) { return e.toString(); }
};

OWL.setMogrtProperty = function(nodeId, displayName, value) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "No active sequence";
        
        var clip = null;
        for (var i = 0; i < seq.videoTracks.numTracks; i++) {
            var track = seq.videoTracks[i];
            for (var j = 0; j < track.clips.numItems; j++) {
                if (track.clips[j].nodeId === nodeId) {
                    clip = track.clips[j];
                    break;
                }
            }
            if (clip) break;
        }

        if (!clip) return "Clip not found";
        
        var comp = clip.getMGTComponent();
        if (!comp) return "MGT component not found";
        
        var prop = comp.properties.getParamForDisplayName(displayName);
        if (prop) {
            // Handle position/scale which might be strings or arrays depending on version
            if (typeof value === 'string' && value.indexOf('[') === 0) {
                value = JSON.parse(value);
            }
            prop.setValue(value);
            return "success";
        }
        return "Property not found: " + displayName;
    } catch(e) { return e.toString(); }
};

OWL.getTimelineInfo = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ videoCount: 0, captionCount: 0 });
        
        var vCount = seq.videoTracks.numTracks;
        var cCount = 0;
        try {
            if (seq.captionTracks) cCount = seq.captionTracks.numTracks;
        } catch(e) {}
        
        return JSON.stringify({
            videoCount: vCount,
            captionCount: cCount
        });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
};

OWL.openFilePicker = function(title, filter) {
    var f = File.openDialog(title, filter, false);
    return f ? f.fsName : "";
};

OWL.forceExportCaptionsEPR = function(extPath, trackIndex) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "ERR: Nenhuma sequência ativa selecionada.";
        
        // Ativa apenas a trilha de legenda desejada
        if (seq.captionTracks && seq.captionTracks.numTracks > 0) {
            for (var i = 0; i < seq.captionTracks.numTracks; i++) {
                // i == trackIndex é flexível para string/number
                var shouldEnable = (i == trackIndex);
                seq.captionTracks[i].enabled = shouldEnable;
                // Em algumas versões, precisa focar/setar como target
                try { if (shouldEnable && seq.captionTracks[i].setSelected) seq.captionTracks[i].setSelected(true, true); } catch(e) {}
            }
        }
        
        var baseFolder = new Folder(Folder.userData.fsName + "/OWLFilms_Cache");
        if (!baseFolder.exists) baseFolder.create();
        
        // Limpa arquivos velhos para evitar confusão
        var oldFiles = baseFolder.getFiles("*.srt");
        for (var f = 0; f < oldFiles.length; f++) { oldFiles[f].remove(); }

        // Localiza o preset no caminho da extensao
        var presetPath = extPath + "/captioneer_preset_perfect.epr";
        var presetFile = new File(presetPath);
        
        if (!presetFile.exists) return "ERR: Preset EPR não localizado: " + presetPath;

        var outPath = baseFolder.fsName + "\\temp_owl"; // Premiere adiciona .srt
        seq.exportAsMediaDirect(outPath, presetFile.fsName, 0);
        
        // Loop de espera (Polling)
        var maxWait = 100; // ~5 segundos
        while(maxWait-- > 0) {
            var files = baseFolder.getFiles("*.srt");
            if (files.length > 0) return files[0].fsName;
            $.sleep(50);
        }
        return "ERR: O Premiere não gerou o SRT no tempo esperado.";
    } catch(e) { return "ERR:" + e.toString(); }
};

OWL.ensureVideoTrack = function() {
    var seq = app.project.activeSequence;
    if (!seq) return 0;
    
    var startCount = seq.videoTracks.numTracks;
    
    // 1. Tenta API Moderna 2024 (PPRO v24+)
    try { 
        if (seq.videoTracks.add) { 
            seq.videoTracks.add(); 
        } 
    } catch(e) {}
    
    // 2. Tenta API alternativa 2023
    if (seq.videoTracks.numTracks == startCount) {
        try { if (seq.createVideoTrack) { seq.createVideoTrack(); } } catch(e) {}
    }

    // 3. Tenta QE (Mais invasivo, mas eficaz em versões antigas)
    if (seq.videoTracks.numTracks == startCount) {
        try {
            app.enableQE();
            var qeSeq = qe.project.getActiveSequence();
            if (qeSeq && qeSeq.addVideoTrack) {
                qeSeq.addVideoTrack();
            }
        } catch(e) {}
    }
    
    // 4. Fallback final: Comando Nativo
    if (seq.videoTracks.numTracks == startCount) {
        try {
            app.project.activeSequence = seq; 
            app.executeCommand(2140); // "Add Tracks" dialog
            $.sleep(800); 
        } catch(e) {}
    }

    seq = app.project.activeSequence;
    var finalCount = seq.videoTracks.numTracks;
    return (finalCount > 0) ? finalCount - 1 : 0;
};

OWL.createAIHighlights = function(segments) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return "Falha: Nenhuma sequência ativa.";
        
        // 1. Localiza o clipe principal na trilha V1
        var vTrack = seq.videoTracks[0];
        if (vTrack.clips.numItems === 0) return "Falha: Trilha V1 está vazia.";
        
        // Pegaremos o primeiro clipe que encontrar na V1 como fonte
        var sourceClip = null;
        for (var c = 0; c < vTrack.clips.numItems; c++) {
            if (vTrack.clips[c].projectItem) {
                sourceClip = vTrack.clips[c];
                break;
            }
        }
        
        if (!sourceClip) return "Falha: Nenhum clipe válido encontrado na V1.";
        var projectItem = sourceClip.projectItem;

        // 2. Cria nova sequência para os cortes
        var newSeqName = "CORTES IA - " + seq.name;
        var newSeq = app.project.createNewSequence(newSeqName, ""); 
        
        if (!newSeq) return "Falha ao criar nova sequência.";

        var currentTicks = "0";

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            
            // INSIRA VÍDEO E ÁUDIO NA NOVA SEQUÊNCIA
            // Overwrite na trilha de vídeo 1 e áudio 1
            newSeq.videoTracks[0].overwriteClip(projectItem, currentTicks);
            if (newSeq.audioTracks.numTracks > 0) {
                newSeq.audioTracks[0].overwriteClip(projectItem, currentTicks);
            }
            
            // PEGA OS CLIPES INSERIDOS (Últimos da trilha)
            var insertedVideoClip = newSeq.videoTracks[0].clips[newSeq.videoTracks[0].clips.numItems - 1];
            var insertedAudioClip = (newSeq.audioTracks.numTracks > 0) ? newSeq.audioTracks[0].clips[newSeq.audioTracks[0].clips.numItems - 1] : null;
            
            var startTime = new Time(); startTime.seconds = parseFloat(seg.start);
            var endTime = new Time(); endTime.seconds = parseFloat(seg.end);
            
            // APLICA O CORTE (TRIM) EM AMBOS PARA MANTER SINCRONIA
            if (insertedVideoClip) {
                insertedVideoClip.inPoint = startTime.ticks;
                insertedVideoClip.outPoint = endTime.ticks;
            }
            if (insertedAudioClip) {
                insertedAudioClip.inPoint = startTime.ticks;
                insertedAudioClip.outPoint = endTime.ticks;
            }
            
            // ATUALIZA POSIÇÃO PARA O PRÓXIMO CORTE
            var nextStartTime = new Time();
            nextStartTime.ticks = currentTicks;
            nextStartTime.seconds += (endTime.seconds - startTime.seconds);
            currentTicks = nextStartTime.ticks;
        }

        return "success";
    } catch(e) { return "JSX_ERR: " + e.toString(); }
};
