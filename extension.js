import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const SERVICE = 'zapret.service';

const ZapretIndicator = GObject.registerClass(
class ZapretIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Zapret'), false);

        this._extension = extension;

        this._icon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._statusLabel = new St.Label({text: _('…'), y_align: St.Align.CENTER});
        this.add_child(this._statusLabel);

        // Menu items
        this._statusItem = new PopupMenu.PopupMenuItem(_('Status: …'), {reactivate: false});
        this._statusItem.sensitive = false;
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._startItem = new PopupMenu.PopupMenuItem(_('Start'));
        this._startItem.connect('activate', () => this._runSystemctl('start'));
        this.menu.addMenuItem(this._startItem);

        this._stopItem = new PopupMenu.PopupMenuItem(_('Stop'));
        this._stopItem.connect('activate', () => this._runSystemctl('stop'));
        this.menu.addMenuItem(this._stopItem);

        this._restartItem = new PopupMenu.PopupMenuItem(_('Restart'));
        this._restartItem.connect('activate', () => this._runSystemctl('restart'));
        this.menu.addMenuItem(this._restartItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._checkItem = new PopupMenu.PopupMenuItem(_('Detailed status'));
        this._checkItem.connect('activate', () => this._showDetailedStatus());
        this.menu.addMenuItem(this._checkItem);

        this._enabledItem = new PopupMenu.PopupMenuItem(_('Autostart: …'), {reactivate: false});
        this._enabledItem.connect('activate', () => {
            this._runSystemctl(this._enabled ? 'disable' : 'enable');
        });
        this.menu.addMenuItem(this._enabledItem);

        this._active = false;
        this._enabled = false;

        this._timeoutId = 0;
        this._cancellable = null;
    }

    refresh() {
        this._cancellable?.cancel();
        this._cancellable = new Gio.Cancellable();

        // is-active
        this._readStdout(['systemctl', 'is-active', SERVICE], (active) => {
            this._active = active.trim() === 'active';
            this._updateUi();
        });

        // is-enabled
        this._readStdout(['systemctl', 'is-enabled', SERVICE], (enabled) => {
            enabled = enabled.trim();
            this._enabled = enabled === 'enabled' || enabled === 'enabled-runtime' || enabled === 'static';
            this._updateUi();
        });
    }

    _updateUi() {
        const active = this._active;
        const enabled = this._enabled;

        this._statusLabel.text = active ? _('ON') : _('OFF');
        this._statusLabel.set_style(active ? 'color: #57e389; font-weight: bold;' : 'color: #ff6b6b; font-weight: bold;');

        this._icon.icon_name = active ? 'network-transmit-receive-symbolic' : 'network-offline-symbolic';

        this._statusItem.label.text = _('Status: %s').format(active ? _('running') : _('stopped'));
        this._enabledItem.label.text = _('Autostart: %s').format(enabled ? _('yes') : _('no'));

        this._startItem.sensitive = !active;
        this._stopItem.sensitive = active;
        this._restartItem.sensitive = true;
    }

    _readStdout(argv, callback) {
        try {
            const [, stdout] = GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
            const dec = new TextDecoder();
            callback(dec.decode(stdout));
        } catch (e) {
            callback('');
        }
    }

    _runSystemctl(action) {
        try {
            GLib.spawn_command_line_async(`systemctl ${action} ${SERVICE}`);
        } catch (e) {
            Main.notifyError(_('Zapret'), _('Failed to run systemctl %s').format(action));
            return;
        }
        // Refresh shortly after to reflect new state
        this._scheduleRefresh(800);
        this._scheduleRefresh(2500);
    }

    _scheduleRefresh(delayMs) {
        if (this._timeoutId) GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._timeoutId = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _showDetailedStatus() {
        try {
            const [, stdout] = GLib.spawn_sync(null, ['systemctl', 'status', SERVICE, '--no-pager', '--full'], null, GLib.SpawnFlags.SEARCH_PATH, null);
            const dec = new TextDecoder();
            const text = dec.decode(stdout) || _('(no output)');

            // Open a small notification with the status so the user sees it.
            Main.notify(_('Zapret status'), text.split('\n')[0]);
            // Copy full status to the clipboard for convenience.
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            Main.notify(_('Zapret'), _('Detailed status copied to clipboard'));
        } catch (e) {
            Main.notifyError(_('Zapret'), _('Failed to read status'));
        }
    }

    start() {
        this.refresh();
        // Poll periodically
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
        this._cancellable?.cancel();
        this._cancellable = null;
    }
});

export default class ZapretExtension extends Extension {
    enable() {
        this._indicator = new ZapretIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._indicator.start();
    }

    disable() {
        this._indicator?.stop();
        this._indicator?.destroy();
        this._indicator = null;
    }
}