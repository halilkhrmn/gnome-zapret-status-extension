# GNOME Zapret Status Extension

A GNOME Shell panel extension that shows the status of the `zapret.service`
systemd unit in the top bar via a **Z** icon with a colored status dot, and
exposes a menu to start / stop / restart / show detailed status / toggle
autostart.

> **This extension is a control GUI for [zapret](https://github.com/bol-van/zapret)
> and will not do anything useful without it.** zapret must be installed and
> its systemd service registered as `zapret.service`.
>
> Install guide: https://keift.gitbook.io/guides/linux/install-zapret
> Upstream project: https://github.com/bol-van/zapret

## Authorization

Starting, stopping, restarting and enabling/disabling the service is done
through `systemctl`. These actions require polkit authorization, which is
requested automatically through the standard GNOME authentication prompt when
an action is triggered. No extra setup is needed.

Status monitoring (icon, dot, menu status line, detailed status) only reads
state and does not require any authorization.

## Installation

### Extension

Install into the user directory:

```sh
UUID=gnome-zapret@halilkhrmn.github.io
mkdir -p ~/.local/share/gnome-shell/extensions/$UUID
cp metadata.json extension.js icons ~/.local/share/gnome-shell/extensions/$UUID/
```

Under Wayland, GNOME Shell only scans for new extensions at startup, so log out
and back in. On X11 you can restart the shell with `Alt+F2 → r`. Then enable:

```sh
gnome-extensions enable gnome-zapret@halilkhrmn.github.io
```

or toggle it from **Settings → Extensions**.

### Test from source

You can also test from the source tree by symlinking:

```sh
ln -s "$PWD" ~/.local/share/gnome-shell/extensions/gnome-zapret@halilkhrmn.github.io
```

## Packaging for extensions.gnome.org

```sh
./build.sh
```

Produces `build/<uuid>.shell-extension.zip` containing only the extension
files (metadata.json, extension.js, icons/). README and LICENSE are
intentionally excluded per the review guidelines.

## CLI control

Since the extension drives `systemctl`, you can do everything from the command
line as well:

```sh
systemctl status zapret.service
systemctl is-active zapret.service
systemctl is-enabled zapret.service
systemctl start zapret.service
systemctl stop zapret.service
systemctl restart zapret.service
```

For a detailed blocking check:

```sh
/opt/zapret/blockcheck.sh
```

## Panel indicator

The panel shows a **Z** glyph with a small colored dot in the bottom-right
corner:

| Dot color | Meaning                          |
|-----------|----------------------------------|
| green     | `zapret.service` is running      |
| orange    | `zapret.service` is stopped      |
| red       | `zapret.service` is not installed |

When the unit is missing, all menu actions are disabled and the Z icon is
dimmed. Left/right-clicking shows a notification: *Zapret is not installed*.

## Notes

- Status is refreshed every 10 seconds and after each action.
- "Detailed status" copies the full `systemctl status` output to the clipboard.
- `Alt+F2 r` does not work under Wayland; log out and back in.