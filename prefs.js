/*Copyright (C) 2017 Tom Hartill

prefs.js - Part of the NetSpeed Gnome Shell Extension.

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

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

function NetSpeedPrefs() {
    this._init();
}

NetSpeedPrefs.prototype = {
    _init: function () {
        this._settings = Settings.getSettings();

        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/prefs.ui');
        this.widget = this._builder.get_object('notebook');

        this._populateMonitoring();
        this._populateAppearance();
        this._populateAbout();
    },

    _populateAbout: function () {
        let name = this._builder.get_object('nameLabel');
        name.set_text(Me.metadata['name'].toString());

        let about = this._builder.get_object('aboutLabel');
        about.set_text(Me.metadata['description'].toString());

        let version = this._builder.get_object('versionLabel');
        version.set_text(Me.metadata['version'].toString());

        let website = this._builder.get_object('websiteLabel');
        website.set_text(Me.metadata['url'].toString());

        let licence = this._builder.get_object('licenceLabel');
        licence.set_text(Me.metadata['licence'].toString());
    },

    _populateAppearance: function () {
        let widget = null;
        let value = null;

        // Vertical Display Switch
        widget = this._builder.get_object('displayVertical');
        value = this._settings.get_boolean('display-vertical');
        widget.set_active(value);

        // Decimal Place Spin Button
        widget = this._builder.get_object('decimalPlace');
        value = this._settings.get_int('decimal-place');
        widget.set_value(value);

        // Font Size Spin Button
        widget = this._builder.get_object('fontSize');
        value = this._settings.get_int('custom-font-size');
        widget.set_value(value);

        // Font Family Combo Box
        widget = this._builder.get_object('fontFamily');
        value = this._settings.get_string('custom-font-family');
        let fontFamilyOptions = [];
        let fontFamilyModel = widget.get_model();
        fontFamilyModel.foreach(function (model, path, iter) {
            fontFamilyOptions.push(
                fontFamilyModel.get_value(iter, 0).toString());
        });
        let valueIndex = fontFamilyOptions.indexOf(value);
        if ( valueIndex >= 0) widget.set_active(valueIndex);

        // Use Custom Font Family
        widget = this._builder.get_object('customFamily');
        value = this._settings.get_boolean('use-custom-font-family');
        widget.set_active(value);

        // Use Custom Font Size
        widget = this._builder.get_object('customSize');
        value = this._settings.get_boolean('use-custom-font-size');
        widget.set_active(value);

        // Use Custom Font Colour
        widget = this._builder.get_object('customColour');
        value = this._settings.get_boolean('use-custom-font-colours');
        widget.set_active(value);

        // Use Custom Decorations
        widget = this._builder.get_object('customDecorations');
        value = this._settings.get_boolean('use-custom-decorations');
        widget.set_active(value);

        // Enable Speed Down
        widget = this._builder.get_object('speedDownEnable');
        value = this._settings.get_boolean('show-speed-down');
        widget.set_active(value);

        // Enable Speed Up
        widget = this._builder.get_object('speedUpEnable');
        value = this._settings.get_boolean('show-speed-up');
        widget.set_active(value);

        // Enable Speed Total
        widget = this._builder.get_object('speedTotalEnable');
        value = this._settings.get_boolean('show-speed-total');
        widget.set_active(value);

        // Enable Usage Total
        widget = this._builder.get_object('usageTotalEnable');
        value = this._settings.get_boolean('show-usage-total');
        widget.set_active(value);

        let colour = new Gdk.Color();

        // Speed Down Colour
        widget = this._builder.get_object('speedDownColour');
        value = this._settings.get_string('custom-speed-down-colour');
        colour.red = parseInt(value.slice(1,3), 16) * 256;
        colour.green = parseInt(value.slice(3,5), 16) * 256;
        colour.blue = parseInt(value.slice(5,7), 16) * 256;
        widget.set_color(colour);

        // Speed Up Colour
        widget = this._builder.get_object('speedUpColour');
        value = this._settings.get_string('custom-speed-up-colour');
        colour.red = parseInt(value.slice(1,3), 16) * 256;
        colour.green = parseInt(value.slice(3,5), 16) * 256;
        colour.blue = parseInt(value.slice(5,7), 16) * 256;
        widget.set_color(colour);

        // Speed Total Colour
        widget = this._builder.get_object('speedTotalColour');
        value = this._settings.get_string('custom-speed-total-colour');
        colour.red = parseInt(value.slice(1,3), 16) * 256;
        colour.green = parseInt(value.slice(3,5), 16) * 256;
        colour.blue = parseInt(value.slice(5,7), 16) * 256;
        widget.set_color(colour);

        // Usage Total Colour
        widget = this._builder.get_object('usageTotalColour');
        value = this._settings.get_string('custom-usage-total-colour');
        colour.red = parseInt(value.slice(1,3), 16) * 256;
        colour.green = parseInt(value.slice(3,5), 16) * 256;
        colour.blue = parseInt(value.slice(5,7), 16) * 256;
        widget.set_color(colour);

        // Custom Speed Down Decoration
        widget = this._builder.get_object('speedDownDecoration');
        value = this._settings.get_string('custom-speed-down-decoration');
        widget.set_text(value);

        // Custom Speed Up Decoration
        widget = this._builder.get_object('speedUpDecoration');
        value = this._settings.get_string('custom-speed-up-decoration');
        widget.set_text(value);

        // Custom Speed Total Decoration
        widget = this._builder.get_object('speedTotalDecoration');
        value = this._settings.get_string('custom-speed-total-decoration');
        widget.set_text(value);

        // Custom Usage Total Decoration
        widget = this._builder.get_object('usageTotalDecoration');
        value = this._settings.get_string('custom-usage-total-decoration');
        widget.set_text(value);
    },

    _populateMonitoring: function () {
        let widget = null;
        let value = null;

        let debug = this._builder.get_object('debugLabel');

        widget = this._builder.get_object('updateInterval');
        value = this._settings.get_int('update-interval');
        widget.set_value(value)

        widget = this._builder.get_object('interfaceFlowBox');
        let savedInterfaces = this._settings.get_strv('interfaces');
        let currentInterfaces = this._getInterfaces();
        let displayInterfaces = savedInterfaces.slice()
        for (let i = 0; i < currentInterfaces.length; i++) {
            if (displayInterfaces.indexOf(currentInterfaces[i]) < 0) {
                displayInterfaces.push(currentInterfaces[i]);
            }
        }

        for (let i = 0; i < displayInterfaces.length; i++) {
            let checkbox = new Gtk.CheckButton();
            checkbox.set_label(displayInterfaces[i])
            if (savedInterfaces.indexOf(displayInterfaces[i]) >= 0) {
                checkbox.set_active(true);
            }
            widget.insert(checkbox, -1);
        }

        // TODO: Attach handler to toggled signals of interface checkboxes
    },

    _getInterfaces: function () {
        let interfaces = [];
        try {
            let fileContentsRaw = GLib.file_get_contents('/proc/net/dev');
            let fileContents = fileContentsRaw[1].toString().split('\n');
            // Skip the first 2 header lines:
            for (let i = 2; i < fileContents.length; i++) {
                let lineData = fileContents[i].trim().split(/\W+/);
                let interfaceName = lineData[0];
                if (interfaceName) interfaces.push(interfaceName);

            }
        } catch (e) { }
        return interfaces;
    }
};

function buildPrefsWidget () {
    prefs = new NetSpeedPrefs();
    prefs.widget.show_all();
    return prefs.widget;
}

function init (){

}
