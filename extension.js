/* Copyright (C) 2017 Tom Hartill

extension.js - Part of the NetSpeed Gnome Shell Extension.

NetSpeed is free software; you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation; either version 3 of the License, or (at your option) any later
version.

NetSpeed is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
NetSpeed; if not, see http://www.gnu.org/licenses/.

An up to date version can also be found at:
https://github.com/Tomha/gnome-shell-extension-netspeed */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Lang = imports.lang;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

const showDebug = false;

// TODO: Fix resume usage on boot

function InterfaceData() {
    this._init();
}

InterfaceData.prototype = {
    _init() {
        this.initialReceive = 0;
        this.totalReceived = 0;
        this.lastReceived = 0;
        this.initialTransmitted = 0;
        this.totalTransmitted = 0;
        this.lastTransmitted = 0;
    }
};

function NetSpeedExtension() {
    this._init();
}

NetSpeedExtension.prototype = {
    // Internal Functions
    _createLabelStyle: function (labelName) {
        let styleText = '';

        if (!!labelName) {
            let labelNames = ['down', 'up', 'total', 'usage'];
            let labelColours = [this._customSpeedDownColour,
                                this._customSpeedUpColour,
                                this._customSpeedTotalColour,
                                this._customUsageTotalColour];
            let labelIndex = labelNames.indexOf(labelName);
            if (labelIndex < 0) throw new Error ("Invalid label name.");
            else if (this._useCustomFontColours) styleText +=
                ('color:' + labelColours[labelIndex] + ';');
        }
        if (this._useCustomFontFamily) styleText +=
            ('font-family:' + this._customFontFamily + ';');
        if (this._useCustomFontSize > 0) styleText +=
            ('font-size:' + this._customFontSize + 'pt;');
        if (this._useFixedWidth) {
            styleText += this._widthIsMinimum ? 'min-width:' : 'width:';
            styleText += this._customFixedWidth + 'px;';
        }
        styleText += 'text-align:right;';
        return styleText;
    },

    _formatSpeed: function (speed) {
        let unit = 0;
        while (speed >= 1000){
            speed /= 1000;
            unit += 1;
        }
        let text;
        if (speed == (speed | 0)) text = (speed.toString()); // If speed is int
        else text = (speed.toFixed(this._decimalPlace).toString());
        return text + ["B", "K", "M", "G"][unit];
    },

    _getBootTime: function () {
        let fileContentsRaw = GLib.file_get_contents('/proc/uptime');
        let fileContents = fileContentsRaw[1].toString().split(/\W+/);
        let upTime = parseInt(fileContents[0]);
        let timeNow = new Date().getTime();
        return (timeNow - upTime);
    },

    _updateInterfaceData() {
        let fileContentsRaw = GLib.file_get_contents('/proc/net/dev');
        let fileContents = fileContentsRaw[1].toString().split('\n');
        // Skip the first 2 header lines:
        for (let i = 2; i < fileContents.length; i++) {
            let lineData = fileContents[i].trim().split(/\W+/);
            let interfaceName = lineData[0];
            let interfaceIndex = this._interfaceNames.indexOf(interfaceName);
            if (interfaceIndex < 0) {
                let interfaceData = new InterfaceData();
                interfaceData.initialReceived =
                    interfaceData.totalReceived =
                        interfaceData.lastReceived = 0;
                interfaceData.initialTransmitted =
                    interfaceData.totalTransmitted =
                        interfaceData.lastTransmitted = 0
                this._interfaceNames.push(interfaceName);
                this._interfaceData.push(interfaceData);
            } else {
                let interfaceData = this._interfaceData[interfaceIndex];
                interfaceData.lastReceived = interfaceData.totalReceived;
                interfaceData.lastTransmitted = interfaceData.totalTransmitted;
                interfaceData.totalReceived = lineData[1];
                interfaceData.totalTransmitted = lineData[9];
            }
        }
    },

    _calculateSpeeds() {
        let speedDown = speedUp = speedTotal = usageTotal = 0;
        for (let i = 0; i < this._trackedInterfaces.length; i++) {
            let interfaceName = this._trackedInterfaces[i];
            let interfaceIndex = this._interfaceNames.indexOf(interfaceName);
            if (interfaceIndex < 0) continue; // This shouldn't happen
            let interfaceData = this._interfaceData[interfaceIndex];
            let justReceived =
                interfaceData.totalReceived - interfaceData.lastReceived;
            let justTransmitted =
                interfaceData.totalTransmitted - interfaceData.lastTransmitted;
            speedDown += justReceived
            speedUp += justTransmitted
            speedTotal += (justReceived + justTransmitted)

            let totalDown =
                interfaceData.totalReceived - interfaceData.initialReceived;
            let totalUp =
                interfaceData.totalTransmitted -
                    interfaceData.initialTransmitted;
            usageTotal += (totalDown + totalUp);

        }
        this._speedDown = speedDown / this._updateInterval;
        this._speedUp = speedUp / this._updateInterval;
        this._speedTotal = speedTotal / this._updateInterval;
        this._usageTotal = usageTotal;
    },

    _loadSettings: function() {
        this._customFixedWidth =
            this._settings.get_int('custom-fixed-width');
        this._customFontFamily =
            this._settings.get_string('custom-font-family');
        this._customFontSize = this._settings.get_int('custom-font-size');
        this._customSpeedDownColour =
            this._settings.get_string('custom-speed-down-colour');
        this._customSpeedDownDecoration =
            this._settings.get_string('custom-speed-down-decoration');
        this._customSpeedTotalColour =
            this._settings.get_string('custom-speed-total-colour');
        this._customSpeedTotalDecoration =
            this._settings.get_string('custom-speed-total-decoration');
        this._customSpeedUpColour =
            this._settings.get_string('custom-speed-up-colour');
        this._customSpeedUpDecoration =
            this._settings.get_string('custom-speed-up-decoration');
        this._customUsageTotalColour =
            this._settings.get_string('custom-usage-total-colour');
        this._customUsageTotalDecoration =
            this._settings.get_string('custom-usage-total-decoration');
        this._decimalPlace = this._settings.get_int('decimal-place');
        this._displayVertical = this._settings.get_boolean('display-vertical');
        this._trackedInterfaces = this._settings.get_strv('interfaces');
        this._showSpeedDown = this._settings.get_boolean('show-speed-down');
        this._showSpeedTotal = this._settings.get_boolean('show-speed-total');
        this._showSpeedUp = this._settings.get_boolean('show-speed-up');
        this._showUsageTotal =this._settings.get_boolean('show-usage-total');
        this._updateInterval= this._settings.get_int('update-interval');
        this._useCustomDecorations =
            this._settings.get_boolean('use-custom-decorations');
        this._useCustomFontColours =
            this._settings.get_boolean('use-custom-font-colours');
        this._useCustomFontFamily =
            this._settings.get_boolean('use-custom-font-family');
        this._useCustomFontSize =
            this._settings.get_boolean('use-custom-font-size');
        this._useFixedWidth =
            this._settings.get_boolean('use-fixed-width');
        this._widthIsMinimum =
            this._settings.get_boolean('width-is-minimum');
    },

    _setAllLabelStyles: function () {
        this._downLabel.set_style(this._createLabelStyle('down'));
        this._upLabel.set_style(this._createLabelStyle('up'));
        this._totalLabel.set_style(this._createLabelStyle('total'));
        this._usageLabel.set_style(this._createLabelStyle('usage'));
        if (showDebug)
            this._debugLabel.set_style(this._createLabelStyle(null));
    },

    _update: function () {
        this._updateInterfaceData();
        this._calculateSpeeds();

        // No need to update text for hidden labels
        if (this._showSpeedDown) this._downLabel.set_text(
            this._formatSpeed(this._speedDown) + this._speedDownDecoration);
        if (this._showSpeedUp) this._upLabel.set_text(
            this._formatSpeed(this._speedUp) + this._speedUpDecoration);
        if (this._showSpeedTotal) this._totalLabel.set_text(
            this._formatSpeed(this._speedTotal) + this._speedTotalDecoration);
        if (this._showUsageTotal) this._usageLabel.set_text(
            this._formatSpeed(this._usageTotal) + this._usageTotalDecoration);

        if (this._runNum > this._currentRunNum){
            this._currentRunNum = this._runNum;
            Main.Mainloop.timeout_add_seconds(this._updateInterval,
                                  Lang.bind(this, this._update));
            return false;
        } else return this._isRunning;
    },

    // Event Handler Functions
    _onButtonClicked: function (button, event) {
        if (event.get_button() == 3) {  // Clear counter on right click
            this._initialReceived = this._totalReceived;
            this._initialTransmitted = this._totalTransmitted;
            this._usageLabel.set_text("0B" + this._usageTotalDecoration);
        }
    },

    _onSettingsChanged: function (settings, key) {
        switch(key) {
            case 'custom-fixed-width':
                this._customFixedWidth =
                    this._settings.get_int('custom-fixed-width');
                this._setAllLabelStyles();
                break;
            case 'custom-font-family':
                this._customFontFamily =
                    this._settings.get_string('custom-font-family');
                this._setAllLabelStyles();
                break;
            case 'custom-font-size':
                this._customFontSize =
                    this._settings.get_int('custom-font-size');
                this._setAllLabelStyles();
                break;
            case 'custom-speed-down-colour':
                this._customSpeedDownColour =
                    this._settings.get_string('custom-speed-down-colour');
                this._downLabel.set_style(this._createLabelStyle('down'));
                break;
            case 'custom-speed-down-decoration':
                this._speedDownDecoration = this._useCustomDecorations ?
                    this._settings.get_string('custom-speed-down-decoration') :
                    '↓';
                this._setAllLabelStyles();
                break;
            case 'custom-speed-total-colour':
                this._customSpeedTotalColour =
                    this._settings.get_string('custom-speed-total-colour');
                this._totalLabel.set_style(this._createLabelStyle('total'));
                break;
            case 'custom-speed-total-decoration':
                this._speedTotalDecoration = this._useCustomDecorations ?
                    this._settings.get_string('custom-speed-total-decoration') :
                    '⇵';
                this._setAllLabelStyles();
                break;
            case 'custom-speed-up-colour':
                this._customSpeedUpColour =
                    this._settings.get_string('custom-speed-up-colour');
                this._upLabel.set_style(this._createLabelStyle('up'));
                break;
            case 'custom-speed-up-decoration':
                this._speedUpDecoration = this._useCustomDecorations ?
                    this._settings.get_string('custom-speed-up-decoration') :
                    '↑';
                this._setAllLabelStyles();
                break;
            case 'custom-usage-total-colour':
                this._customUsageTotalColour =
                    this._settings.get_string('custom-usage-total-colour');
                this._usageLabel.set_style(this._createLabelStyle('usage'));
                break;
            case 'custom-usage-total-decoration':
                this._usageTotalDecoration = this._useCustomDecorations ?
                    this._settings.get_string('custom-usage-total-decoration') :
                    'Σ';
                this._setAllLabelStyles();
                break;
            case 'decimal-place':
                this._decimalPlace =
                    this._settings.get_int('decimal-place');
                break;
            case 'display-vertical':
                this._displayVertical =
                    this._settings.get_boolean('display-vertical');
                this._labelBox.set_vertical(this._displayVertical);
                break;
            case 'interfaces':
                this._trackedInterfaces = this._settings.get_strv('interfaces');
                break;
            case 'show-speed-down':
                if (this._settings.get_boolean('show-speed-down'))
                    this._downLabel.show()
                else this._downLabel.hide();
                break;
            case 'show-speed-total':
                if (this._settings.get_boolean('show-speed-total'))
                    this._totalLabel.show()
                else this._totalLabel.hide();
                break;
            case 'show-speed-up':
                if (this._settings.get_boolean('show-speed-up'))
                    this._upLabel.show()
                else this._upLabel.hide();
                break;
            case 'show-usage-total':
                if (this._settings.get_boolean('show-usage-total'))
                    this._usageLabel.show()
                else this._usageLabel.hide();
                break;
            case 'update-interval':
                this._updateInterval =
                    this._settings.get_int('update-interval');
                this._runNum++;
                break;
            case 'use-custom-font-colours':
                this._useCustomFontColours =
                    this._settings.get_boolean('use-custom-font-colours');
                this._setAllLabelStyles();
                break;
            case 'use-custom-decorations':
                this._useCustomDecorations =
                    this._settings.get_boolean('use-custom-decorations');
                if (this._useCustomDecorations) {
                    this._speedDownDecoration =
                        this._settings.get_string(
                            'custom-speed-down-decoration');
                    this._speedUpDecoration =
                        this._settings.get_string(
                            'custom-speed-up-decoration');
                    this._speedTotalDecoration =
                        this._settings.get_string(
                            'custom-speed-total-decoration');
                    this._usageTotalDecoration =
                        this._settings.get_string(
                            'custom-usage-total-decoration');
                } else {
                    this._speedDownDecoration =  '↓';
                    this._speedUpDecoration = '↑';
                    this._speedTotalDecoration = '⇵';
                    this._usageTotalDecoration = 'Σ';
                }
                this._setAllLabelStyles();
                break;
            case 'use-custom-font-family':
                this._useCustomFontFamily =
                    this._settings.get_boolean('use-custom-font-family');
                this._setAllLabelStyles();
                break;
            case 'use-custom-font-size':
                this._useCustomFontSize =
                    this._settings.get_boolean('use-custom-font-size');
                this._setAllLabelStyles();
                break;
            case 'use-fixed-width':
                this._useFixedWidth =
                    this._settings.get_boolean('use-fixed-width');
                this._setAllLabelStyles();
                break;
            case 'width-is-minimum':
                this._widthIsMinimum =
                    this._settings.get_boolean('width-is-minimum');
                this._setAllLabelStyles();
                break;
        }
    },

    // Gnome Shell Functions
    _init: function () {
        this._isRunning = false;
        this._runNum = 0;
        this._currentRunNum = 0;

        this._labelBox = new St.BoxLayout();
        this._button = new St.Bin({style_class: 'panel-button',
                                   reactive: true,
                                   can_focus: true,
                                   x_fill: true,
                                   y_fill: false,
                                   track_hover: true,
                                   child: this._labelBox})

        this._downLabel = new St.Label();
        this._labelBox.add_child(this._downLabel);
        this._downLabel.hide();

        this._upLabel = new St.Label();
        this._labelBox.add_child(this._upLabel);
        this._upLabel.hide();

        this._totalLabel = new St.Label();
        this._labelBox.add_child(this._totalLabel);
        this._totalLabel.hide();

        this._usageLabel = new St.Label();
        this._labelBox.add_child(this._usageLabel);
        this._usageLabel.hide();

        if (showDebug) {
            this._debugLabel = new St.Label();
            this._labelBox.add_child(this._debugLabel);
            this._debugLabel.hide();
        }

        this._button.connect('button-press-event',
                             Lang.bind(this, this._onButtonClicked));
    },

    enable: function () {
        this._settings = Settings.getSettings();
        this._settings.connect('changed',
                               Lang.bind(this, this._onSettingsChanged));
        this._loadSettings();

        this._isRunning = true;
        this._runNum = 1;
        this._currentRunNum = 0;

        this._speedDownDecoration = this._useCustomDecorations ?
            this._customSpeedDownDecoration : '↓';
        this._speedUpDecoration = this._useCustomDecorations ?
            this._customSpeedUpDecoration : '↑';
        this._speedTotalDecoration = this._useCustomDecorations ?
            this._customSpeedTotalDecoration : '⇵';
        this._usageTotalDecoration = this._useCustomDecorations ?
            this._customUsageTotalDecoration : 'Σ';

        this._setAllLabelStyles();

        if (this._showSpeedDown) this._downLabel.show();
        if (this._showSpeedUp) this._upLabel.show();
        if (this._showSpeedTotal) this._totalLabel.show();
        if (this._showUsageTotal) this._usageLabel.show();

        if (showDebug) {
            this._debugLabel.set_text("DEBUG");t
            this._debugLabel.show();
        }

        this._labelBox.set_vertical(this._displayVertical);

        // Set initial values
        this._speedDown = 0;
        this._speedUp = 0;
        this._speedTotal = 0;
        this._usageTotal = 0;

        // New
        this._interfaceNames = []
        this._interfaceData = []

        /*let lastBootTime = this._settings.get_int('last-boot-time');
        let thisBootTime = this._getBootTime();
        if (lastBootTime != thisBootTime) {
            this._initialReceived = this._initialTransmitted = 0;
            this._settings.set_double('initial-receive-count', 0);
            this._settings.set_double('initial-transmit-count', 0);
            this._settings.set_double('last-boot-time', this._getBootTime());
            this._settings.apply();
        } else {
            this._initialReceived =
              this._settings.get_double('initial-receive-count');
            this._initialTransmitted =
              this._settings.get_double('initial-transmit-count');
        }*/

        // Begin
        Main.panel._rightBox.insert_child_at_index(this._button, 0);
        this._update();
    },

    disable: function () {
        this._isRunning = false
        Main.panel._rightBox.remove_child(this._button);
    }
};

function init() {
    return new NetSpeedExtension();
}
