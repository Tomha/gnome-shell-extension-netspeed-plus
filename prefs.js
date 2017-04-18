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

An up to date version can be found at:
https://github.com/Tomha/gnome-shell-extension-netspeed */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;

const Me = imports.misc.extensionUtils.getCurrentExtension();

function NetSpeedPrefs() {
    this._init();
}

NetSpeedPrefs.prototype = {
    _init: function (params) {
        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/prefs.ui');
        this._builder.connect_signals(Lang.bind(this, this._signalConnector));
        this.widget = this._builder.get_object('parentGrid');

        versionText = this._builder.get_object('versionText');
        versionText.set_text(Me.metadata.version.toString());

        this.aboutText = this._builder.get_object('aboutText');
        this.aboutText.set_text(Me.metadata.description.toString());
    },

    _signalConnector: function (builder, object, signal, handler) {
        object.connect(signal, Lang.bind(this, this._signalHandlers[handler]));
    },

    _signalHandlers: {
        _intervalChanged: function (spinButton) {
            this.aboutText.setText(spinButton.get_value().toString());
        },

        _precisionChanged: function (spinButton) {
            this._builder.get_object('aboutText').setText(spinButton.get_value().toString());
        },

        _multiLineChanged: function (switch_) {
            this._builder.get_object('aboutText').setText(switch_.get_state().toString());
        }
    }

};

function buildPrefsWidget() {
    prefs = new NetSpeedPrefs();
    prefs.widget.show_all();
    return prefs.widget;
}

function init(){

}
