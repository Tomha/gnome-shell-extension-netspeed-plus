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
AppChooser; if not, see http://www.gnu.org/licenses/.

An up to date version can also be found at:
https://github.com/Tomha/gnome-shell-extension-netspeed */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Lang = imports.lang;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

function NetSpeedExtension() {
    this._init();
}

NetSpeedExtension.prototype = {
    // Internal Functions
    _createLabelStyle: function (labelName) {
        let styleText = '';

        if (!!labelName) {
            let labelNames = ['down', 'up', 'total', 'usage']
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
        styleText += ('width:' + this._labelWidth + 'px;');
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

    _getThroughput: function () {
        try {
            let received = 0;
            let transmitted = 0;

            let fileContentsRaw = GLib.file_get_contents('/proc/net/dev');
            let fileContents = fileContentsRaw[1].toString().split('\n');
            // Skip the first 2 header lines:
            for (let i = 2; i < fileContents.length; i++) {
                let lineData = fileContents[i].trim().split(/\W+/);
                if (this._interfaces.indexOf(lineData[0]) >= 0) {
                    received += parseInt(lineData[1]);
                    transmitted += parseInt(lineData[9]);
                }
            }

            return [received, transmitted];
        } catch (e) {
            // Will cause 0 increase in stats over this interval
            return[this._totalReceived, this._totalTransmitted];
        }
    },

    _loadSettings: function() {
        this._customFontFamily =
            this._settings.get_string('custom-font-family');
        this._customFontSize = this._settings.get_string('custom-font-size');
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
        this._interfaces = this._settings.get_strv('interfaces');
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
    },

    _calcLabelWidth: function () {
        // Find width in characters
        let baseWidth = 4;
        let decimalWidth = 0;
        if (this._decimalPlace > 0) decimalWidth = this._decimalPlace + 1;
        let decorationWidth = 1;
        if (this._useCustomDecorations) {
            let maxWidth = Math.max([this._customSpeedDownDecoration.length,
                                     this._customSpeedUpDecoration.length,
                                     this._customSpeedTotalDecoration.length,
                                     this._customUsageTotalDecoration.length]);
            if (maxWidth > decorationWidth) decorationWidth = maxWidth;
        }
        let totalWidth = baseWidth + decimalWidth + decorationWidth;

        // Find width of a digit in pixels
        let tempLabel = new St.Label({style: this._createLabelStyle(null)});
        let labelContext = tempLabel.create_pango_context();
        let labelContextMetrics = labelContext.get_metrics(null, null);
        let digitWidthUnits = labelContextMetrics.get_approximate_digit_width();
        let digitWidthPixels = digitWidthUnits / 1024;

        // Set total digit width in pixels with half a digit's width in padding.
        return (totalWidth + 0.5) * digitWidthPixels;
    },

    _update: function () {
        let throughput = this._getThroughput();
        let received = throughput[0];
        let transmitted = throughput[1];

        let justReceived = received - this._totalReceived;
        let justTransmitted = transmitted - this._totalTransmitted;

        this._totalReceived = received;
        this._totalTransmitted = transmitted;

        this._speedDown = justReceived / this._updateInterval;
        this._speedUp = justTransmitted / this._updateInterval;
        this._speedTotal = this._speedDown + this._speedUp;
        this._usageTotal = received - this._initialReceived +
                             transmitted - this._initialTransmitted;

        // No need to update text for hidden labels
        if (this._showSpeedDown) this._downLabel.set_text(
            this._formatSpeed(this._speedDown) + this._speedDownDecoration);
        if (this._showSpeedUp) this._upLabel.set_text(
            this._formatSpeed(this._speedUp) + this._speedUpDecoration);
        if (this._showSpeedTotal) this._totalLabel.set_text(
            this._formatSpeed(this._speedTotal) + this._speedTotalDecoration);
        if (this._showUsageTotal) this._usageLabel.set_text(
            this._formatSpeed(this._usageTotal) + this._usageTotalDecoration);

        return this._isRunning; // Return false if not meant to update again
    },

    // Event Handler Functions

    _onButtonClicked: function (button, event) {
        if (event.get_button() == 3) {  // Right click button clears the couter
            this._initialReceived = this._totalReceived;
            this._initialTransmitted = this._totalTransmitted;
            this._usageLabel.set_text("0B" + this._usageTotalDecoration);
        }
    },

    // Gnome Shell Functions

    _init: function () {
        this._isRunning = false;

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

        this._button.connect('button-press-event',
                             Lang.bind(this, this._onButtonClicked));
    },

    enable: function () {
        this._settings = Settings.getSettings();
        this._loadSettings();

        this._isRunning = true;

        this._labelWidth = this._calcLabelWidth();

        this._speedDownDecoration = this._useCustomDecorations ?
            this._customSpeedDownDecoration : '↓';
        this._speedUpDecoration = this._useCustomDecorations ?
            this._customSpeedUpDecoration : '↑';
        this._speedTotalDecoration = this._useCustomDecorations ?
            this._customSpeedTotalDecoration : '⇵';
        this._usageTotalDecoration = this._useCustomDecorations ?
            this._customUsageTotalDecoration : 'Σ';

        this._downLabel.set_style(this._createLabelStyle('down'));
        this._upLabel.set_style(this._createLabelStyle('up'));
        this._totalLabel.set_style(this._createLabelStyle('total'));
        this._usageLabel.set_style(this._createLabelStyle('usage'));

        if (this._showSpeedDown) this._downLabel.show();
        if (this._showSpeedUp) this._upLabel.show();
        if (this._showSpeedTotal) this._totalLabel.show();
        if (this._showUsageTotal) this._usageLabel.show();

        this._labelBox.set_vertical(this._displayVertical);

        // Set initial values
        this._speedDown = 0;
        this._speedUp = 0;
        this._speedTotal = 0;
        this._usageTotal = 0;

        let throughput = this._getThroughput();
        this._totalReceived = throughput[0];
        this._totalTransmitted = throughput[1];

        let lastBootTime = this._settings.get_int('last-boot-time');
        let thisBootTime = this._getBootTime();
        if (lastBootTime > 0 && lastBootTime != thisBootTime) {
            this._initialReceived = this._initialTransmitted = 0;
        } else {
            this._initialReceived =
              this._settings.get_double('initial-receive-count');
            this._initialTransmitted =
              this._settings.get_double('initial-transmit-count');
        }

        // Begin

        Main.panel._rightBox.insert_child_at_index(this._button, 0);
        Main.Mainloop.timeout_add_seconds(this._updateInterval,
                                          Lang.bind(this, this._update));
    },

    disable: function () {
        this._isRunning = false

        this._settings.set_double('initial-receive-count',
                                  this._initialReceived);
        this._settings.set_double('initial-transmit-count',
                                  this._initialTransmitted);
        this._settings.set_double('last-boot-time',
                                  this._getBootTime());
        this._settings.apply();

        Main.panel._rightBox.remove_child(this._button);
    }
};

function init() {
    return new NetSpeedExtension();
}
