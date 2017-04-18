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
