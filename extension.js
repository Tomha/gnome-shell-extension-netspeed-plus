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
    _formatStyle: function(colour, width, family, size) {
        let styleText = '';
        if (colour) styleText += ('color:' + colour + ';');
        if (width) styleText += ('width:' + width + ';');
        if (family) styleText += ('font-family:' + family + ';');
        if (size > 0) styleText += ('font-size:' + size + ';')
        styleText += 'text-align:right;';
        return styleText;
    },

    _formatSpeed: function (speed) {
        try {
            let units = ["B", "K", "M", "G"];
            let index = 0;
            while (speed >= 1000){
                speed /= 1000;
                index += 1;
            }
            let int = speed | 0;
            let len = int.toString().length;
            let speedText;

            if (speed == int) speedText = (speed.toString());
            else speedText = (speed.toFixed(this._measurementPrecision).toString());

            return speedText + units[index];
        } catch (e) {
            return "FORMAT ERROR";  // For debug
        }
    },

    _getBootTime: function () {
        let inputFile = Gio.File.new_for_path('/proc/uptime');
        let readStream = inputFile.read(null);
        let dataStream = Gio.DataInputStream.new(readStream);
        let line = dataStream.read_line(null).toString().trim().split(/\W+/);
        readStream.close(null);
        let upTime = parseInt(line[0]);
        let timeNow = new Date().getTime();
        return (timeNow - upTime);
    },

    _getThroughput: function () {
        try {
            let received = 0;
            let transmitted = 0;
            let inputFile = Gio.File.new_for_path('/proc/net/dev');
            let readStream = inputFile.read(null);
            let dataStream = Gio.DataInputStream.new(readStream);
            let line;
            while (line = dataStream.read_line(null)) {
                line = line.toString().trim();
                let columns = line.split(/\W+/);
                if (columns.length < 4) break;
                let interfaceName = columns[0];
                if (this._interfaces.indexOf(interfaceName) >= 0) {
                    received += parseInt(columns[1]);
                    transmitted += parseInt(columns[9]);
                }
            }
            readStream.close(null);
            return [received, transmitted];
        } catch (e) {
            return[0, 0];
        }
    },

    _init: function () {
        this._settings = Settings.getSettings();

        this._isRunning = false;

        // Lots of settings
        this._interfaces = this._settings.get_strv('monitor-interfaces');

        this._updateInterval= this._settings.get_int('update-interval');
        this._measurementPrecision = this._settings.get_int('measurement-precision');
        this._displayVertical = this._settings.get_boolean('display-vertical');
        this._initialUsage = 0;

        this._downLabelEnding = this._settings.get_string('down-label-ending');
        this._upLabelEnding = this._settings.get_string('up-label-ending');
        this._totalLabelEnding = this._settings.get_string('total-label-ending');
        this._usageLabelEnding = this._settings.get_string('usage-label-ending');

        let downLabelColour = this._settings.get_string('down-label-colour');
        let upLabelColour = this._settings.get_string('up-label-colour');
        let totalLabelColour = this._settings.get_string('total-label-colour');
        let usageLabelColour = this._settings.get_string('usage-label-colour');

        let labelFontFamily = this._settings.get_string('label-font-family');
        let labelFontSize = this._settings.get_string('label-font-size');

        this._totalReceived = 0;
        this._totalTransmitted = 0;

        this._labelBox = new St.BoxLayout();//{'vertical': this._displayVertical});
        this._button = new St.Bin({style_class: 'panel-button',
                                   reactive: true,
                                   can_focus: true,
                                   x_fill: true,
                                   y_fill: false,
                                   track_hover: true,
                                   child: this._labelBox});

        // Try to find digit width of font:
        let tempLabel = new St.Label({style: this._formatStyle(null,
                                                               null,
                                                               labelFontFamily,
                                                               labelFontSize)});
        let labelContext = tempLabel.create_pango_context();
        let labelContextMetrics = labelContext.get_metrics(null, null);
        let digitWidthUnits = labelContextMetrics.get_approximate_digit_width();
        let digitWidth = digitWidthUnits / 1024;
        let labelWidth = (6 + this._measurementPrecision) * digitWidth;
        labelWidth += digitWidth / 2; // A bit of extra padding
        let labelWidthString = labelWidth.toString() + "px";
        // More work than I would have liked, if only Gnome CSS had ch units :(

        this._speedDown = 0;
        this._speedUp = 0;
        this._speedTotal = 0;
        this._usageTotal = 0;

        let dnLabelStyle = this._formatStyle(downLabelColour,
                                             labelWidthString,
                                             labelFontFamily,
                                             labelFontSize);
        let upLabelStyle = this._formatStyle(upLabelColour,
                                             labelWidthString,
                                             labelFontFamily,
                                             labelFontSize);
        let sumLabelStyle = this._formatStyle(totalLabelColour,
                                              labelWidthString,
                                              labelFontFamily,
                                              labelFontSize);
        let usageLabelStyle = this._formatStyle(usageLabelColour,
                                                labelWidthString,
                                                labelFontFamily,
                                                labelFontSize);

        this._downLabel = new St.Label({style: dnLabelStyle});
        this._labelBox.add_child(this._downLabel);
        this._downLabel.hide();

        this._upLabel = new St.Label({style: upLabelStyle});
        this._labelBox.add_child(this._upLabel);
        this._upLabel.hide();

        this._totalLabel = new St.Label({style: sumLabelStyle});
        this._labelBox.add_child(this._totalLabel);
        this._totalLabel.hide();

        this._usageLabel = new St.Label({style: usageLabelStyle});
        this._labelBox.add_child(this._usageLabel);
        this._usageLabel.hide();

        this._button.connect('button-press-event',
                             Lang.bind(this, this._onButtonClicked));
    },

    _onButtonClicked: function (button, event) {
        if (event.get_button() == 3) {  // Right click button clears the couter
            this._initialReceived = this._totalReceived;
            this._initialTransmitted = this._totalTransmitted;
            this._usageLabel.set_text(this._formatSpeed(0) + usageChar);
        }
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

        this._downLabel.set_text(this._formatSpeed(this._speedDown) +
                                 this._downLabelEnding);
        this._upLabel.set_text(this._formatSpeed(this._speedUp) +
                                 this._upLabelEnding);
        this._totalLabel.set_text(this._formatSpeed(this._speedTotal) +
                                  this._totalLabelEnding);
        this._usageLabel.set_text(this._formatSpeed(this._usageTotal) +
                                    this._usageLabelEnding);

        return this._isRunning;
    },

    enable: function () {
        this._isRunning = true;

        this._speedDown = 0;
        this._speedUp = 0;
        this._speedTotal = 0;
        this._usageTotal = 0;

        if (this._settings.get_boolean('show-down-label')) {
            this._downLabel.show();
        }
        if (this._settings.get_boolean('show-up-label')) {
            this._upLabel.show();
        }
        if (this._settings.get_boolean('show-total-label')) {
            this._totalLabel.show();
        }
        if (this._settings.get_boolean('show-usage-label')) {
            this._usageLabel.show();
        }

        let throughput = this._getThroughput();
        this._totalReceived = throughput[0];
        this._totalTransmitted = throughput[1];

        let lastBootTime = this._settings.get_int('last-boot-time');
        let thisBootTime = this._getBootTime();
        if (lastBootTime > 0 && lastBootTime != thisBootTime) {
            this._initialReceived = this._initialTransmitted = 0;
        } else {
            this._initialReceived = this._settings.get_double('initial-receive-count');
            this._initialTransmitted = this._settings.get_double('initial-transmit-count');
        }

        Main.panel._rightBox.insert_child_at_index(this._button, 0);
        Main.Mainloop.timeout_add_seconds(this._updateInterval,
                                          Lang.bind(this, this._update));
    },

    disable: function () {
        this._isRunning = false
        let bootTime = this._getBootTime();
        this._settings.set_double('initial-receive-count', this._initialReceived);
        this._settings.set_double('initial-transmit-count', this._initialTransmitted);
        this._settings.set_double('last-boot-time', bootTime);
        this._settings.apply();
        Main.panel._rightBox.remove_child(this._button);
    }
};

function init() {
    return new NetSpeedExtension();
}
