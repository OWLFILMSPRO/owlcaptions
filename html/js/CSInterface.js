/**
 * CSInterface - v11.0.0
 * Standard Adobe CEP Communication Library (Fixed for OWLFILMS.CAP)
 */

function CSInterface() {
    this.hostEnvironment = window.__adobe_cep__ ? JSON.parse(window.__adobe_cep__.getHostEnvironment()) : null;
}

CSInterface.prototype.getHostEnvironment = function() {
    this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    return this.hostEnvironment;
};

CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === null || callback === undefined) {
        callback = function(result) {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getSystemPath = function(pathType) {
    var path = window.__adobe_cep__.getSystemPath(pathType);
    return path;
};

CSInterface.prototype.registerInvalidCertificateCallback = function(callback) {
    return window.__adobe_cep__.registerInvalidCertificateCallback(callback);
};

CSInterface.prototype.getApplicationID = function() {
    return this.hostEnvironment.appId;
};

CSInterface.prototype.getExtensions = function(extensionIds) {
    var extensionIdsString = JSON.stringify(extensionIds);
    var extensionString = window.__adobe_cep__.getExtensions(extensionIdsString);
    var extensions = JSON.parse(extensionString);
    return extensions;
};

CSInterface.prototype.requestOpenExtension = function(extensionId, params) {
    window.__adobe_cep__.requestOpenExtension(extensionId, params);
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

CSInterface.prototype.removeEventListener = function(type, listener, obj) {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
};

CSInterface.prototype.dispatchEvent = function(event) {
    if (typeof event.data == "object") {
        event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(event);
};

CSInterface.prototype.closeExtension = function() {
    window.__adobe_cep__.closeExtension();
};

CSInterface.prototype.getScaleFactor = function() {
    return window.__adobe_cep__.getScaleFactor();
};

CSInterface.prototype.openFileDialog = function(title, filter, multiSelect) {
    this.evalScript('OWL.openFilePicker("' + title + '", "' + filter + '")', function(res) {
        if(res && res !== "") {
            window.dispatchEvent(new CustomEvent("manualFileSelected", { detail: res }));
        }
    });
};

CSInterface.prototype.importMogrtDialog = function(title) {
    this.evalScript('OWL.openFilePicker("' + title + '", "Motion Graphics Template:*.mogrt")', function(res) {
        if(res && res !== "") {
            window.dispatchEvent(new CustomEvent("importFileSelected", { detail: res }));
        }
    });
};

CSInterface.prototype.importIntroMogrtDialog = function(title) {
    this.evalScript('OWL.openFilePicker("' + title + '", "Motion Graphics Template:*.mogrt")', function(res) {
        if(res && res !== "") {
            window.dispatchEvent(new CustomEvent("importIntroFileSelected", { detail: res }));
        }
    });
};


var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};
