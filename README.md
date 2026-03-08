# CanliSkor

Canli futbol skorlarini takip edebileceginiz mobil uygulama. React Native ve Expo ile gelistirilmistir.

## Ozellikler

- **Canli skor takibi** - Devam eden maclari yesil vurgu ile gosterir
- **Takim logolari** - Her takimin armasini kartli tasarimda goruntule
- **Lig bazli gruplama** - Maclar liglerine gore siralanir
- **Pull-to-refresh** - Asagi cekerek skorlari guncelle
- **Yerel saat destegi** - Mac saatlerini kendi saat diliminize gore goruntule

## Desteklenen Ligler

| Lig | Ulke |
|-----|------|
| Super Lig | Turkiye |
| Premier Lig | Ingiltere |
| La Liga | Ispanya |
| Bundesliga | Almanya |
| Serie A | Italya |
| Ligue 1 | Fransa |
| Sampiyonlar Ligi | Avrupa |
| Avrupa Ligi | Avrupa |

## Kurulum

```bash
# Repoyu klonla
git clone https://github.com/coolhaz/CanliSkor.git
cd CanliSkor

# Bagimliliklari kur
npm install

# Uygulamayi baslat
npx expo start
```

## Calistirma

- **Android emulator:** `npm run android`
- **iOS simulator:** `npm run ios`
- **Telefonda:** Expo Go uygulamasini indirin ve QR kodu okutun

## Teknolojiler

- [Expo](https://expo.dev/) - React Native gelistirme platformu
- [React Native](https://reactnative.dev/) - Mobil uygulama frameworku
- [TheSportsDB API](https://www.thesportsdb.com/) - Ucretsiz futbol verileri (kayit gerektirmez)

## Ekran Goruntusu

<p align="center">
  <img src="https://github.com/user-attachments/assets/screenshot.png" alt="CanliSkor" width="300" />
</p>

## Lisans

MIT
