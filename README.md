# GNOME Zapret Extension

GNOME Shell (50 / Fedora 46) panel eklentisi. `zapret.service` systemd servisinin
durumunu üst barda ikon + ON/OFF etiketi olarak gösterir; başlat / durdur /
yeniden başlat / ayrıntılı durum / autostart toggle menüsü sunar.

## Yetkilendirme

Servisi başlat/durdur `systemctl` üzerinden yapılır ve polkit yetkisi gerekir.
`polkit/49-zapret.rules` kuralı `wheel` grubundaki kullanıcıların **yalnızca**
`zapret.service` birimini parolasız yönetmesine izin verir. Başka servislere
erişim yoktur.

## Kurulum

```sh
# 1) Polkit kuralını kur (bir kez)
sudo install -m 0644 polkit/49-zapret.rules /etc/polkit-1/rules.d/49-zapret.rules

# 2) Eklentiyi kur
mkdir -p ~/.local/share/gnome-shell/extensions
cp -r zapret@halil.github.io ~/.local/share/gnome-shell/extensions/

# 3) GNOME Shell'i yeniden başlat (Wayland altında çıkış/giriş gerekir)
# X11: Alt+F2 -> r
```

Eklentiyi `gnome-extensions` ile veya **Ayarlar → Uzantılar** menüsünden
etkinleştirin.

## CLI kontrolü

Eklenti `systemctl` kullandığı için komut satırından da tüm kontrolleri
yapabilirsiniz:

```sh
systemctl status zapret.service
systemctl is-active zapret.service
systemctl is-enabled zapret.service
systemctl start zapret.service
systemctl stop zapret.service
systemctl restart zapret.service
```

Ayrıntılı engelleme kontrolü için:

```sh
/opt/zapret/blockcheck.sh
```

## Notlar

- Durum her 10 saniyede ve her aksiyondan sonra yenilenir.
- "Detailed status" tüm `systemctl status` çıktısını panoya kopyalar.
- Wayland'de `Alt+F2 r` çalışmaz; çıkış/giriş yapın.