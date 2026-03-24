const fs = require('fs');
const code = fs.readFileSync('C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/com.aescripts.captioneer/assets/main-68d5777d.js', 'utf8');

const base64Regex = /PD94bW[A-Za-z0-9+/=]+/g;
let match = base64Regex.exec(code);
if (match) {
    const buf = Buffer.from(match[0], 'base64');
    // Salva o buffer binário direto para evitar corrupção
    fs.writeFileSync('C:/Users/eduar/AppData/Roaming/Adobe/CEP/extensions/OWL.CAPTIONS/captioneer_preset.epr', buf);
    console.log('Saved binary EPR file of ' + buf.length + ' bytes.');
}
