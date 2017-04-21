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

// TODO: Implement statistics per-interface not aggregate.
// TODO: Implement speed (and usage?) graph on left-click.
// TODO: Implement prefs menu to change settings.

function NetSpeedExtension() {
    this._init();
}

NetSpeedExtension.prototype = {
    // Internal Functions
    _createLabelStyle: function (colour) {
        let styleText = '';
        if (colour) styleText += ('color:' + colour + ';');
        if (this._labelFontFamily) styleText += ('font-family:' +
                                                 this._labelFontFamily + ';');
        if (this._labelFontSize > 0) styleText += ('font-size:' +
                                                   this._labelFontSize + ';');
        if (this._labelWidthString) styleText += ('width:' +
                                                  this._labelWidthString + ';');
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
        else text = (speed.toFixed(this._measurementPrecision).toString());

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
        this._interfaces = this._settings.get_strv('monitor-interfaces');
        this._updateInterval= this._settings.get_int('update-interval');
        this._measurementPrecision =
          this._settings.get_int('measurement-precision');
        this._displayVertical = this._settings.get_boolean('display-vertical');

        this._showDownLabel = this._settings.get_boolean('show-down-label');
        this._showUpLabel = this._settings.get_boolean('show-up-label');
        this._showTotalLabel = this._settings.get_boolean('show-total-label');
        this._showUsageLabel =this._settings.get_boolean('show-usage-label');

        this._downLabelEnding = this._settings.get_string('down-label-ending');
        this._upLabelEnding = this._settings.get_string('up-label-ending');
        this._totalLabelEnding =
          this._settings.get_string('total-label-ending');
        this._usageLabelEnding =
          this._settings.get_string('usage-label-ending');

        this._labelFontFamily = this._settings.get_string('label-font-family');
        this._labelFontSize = this._settings.get_string('label-font-size');
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
        if (this._showDownLabel) {
            this._downLabel.set_text(this._formatSpeed(this._speedDown) +
                                       this._downLabelEnding);
        }
        if (this._showUpLabel) {
            this._upLabel.set_text(this._formatSpeed(this._speedUp) +
                                     this._upLabelEnding);
        }
        if (this._showTotalLabel) {
            this._totalLabel.set_text(this._formatSpeed(this._speedTotal) +
                                        this._totalLabelEnding);
        }
        if (this._showUsageLabel){
            this._usageLabel.set_text(this._formatSpeed(this._usageTotal) +
                                        this._usageLabelEnding);
        }

        // Return false if not meant to update again
        return this._isRunning;
    },

    // Event Handler Functions

    _onButtonClicked: function (button, event) {
        if (event.get_button() == 3) {  // Right click button clears the couter
            this._initialReceived = this._totalReceived;
            this._initialTransmitted = this._totalTransmitted;
            this._usageLabel.set_text("0B" + this._usageLabelEnding);
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

        // Try to find digit width of font:
        let tempLabel = new St.Label({style: this._createLabelStyle()});
        let labelContext = tempLabel.create_pango_context();
        let labelContextMetrics = labelContext.get_metrics(null, null);
        let digitWidthUnits = labelContextMetrics.get_approximate_digit_width();
        let digitWidth = digitWidthUnits / 1024;
        let labelWidth = (6 + this._measurementPrecision) * digitWidth;
        labelWidth += digitWidth / 2; // A bit of extra padding
        this._labelWidthString = labelWidth.toString() + "px";
        // More work than I would have liked, if only Gnome CSS had ch units :(

        // Set up labels
        let downLabelColour = this._settings.get_string('down-label-colour');
        let upLabelColour = this._settings.get_string('up-label-colour');
        let totalLabelColour = this._settings.get_string('total-label-colour');
        let usageLabelColour = this._settings.get_string('usage-label-colour');

        this._downLabel.set_style(this._createLabelStyle(downLabelColour));
        this._upLabel.set_style(this._createLabelStyle(upLabelColour));
        this._totalLabel.set_style(this._createLabelStyle(totalLabelColour));
        this._usageLabel.set_style(this._createLabelStyle(usageLabelColour));

        if (this._showDownLabel) this._downLabel.show();
        if (this._showUpLabel) this._upLabel.show();
        if (this._showTotalLabel) this._totalLabel.show();
        if (this._showUsageLabel) this._usageLabel.show();

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
        if (lastBootTime > 0 & lastBootTime != thisBootTime) {
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
