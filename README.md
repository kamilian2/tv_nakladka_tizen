# TV Nakładka – Samsung (Tizen)

Wersja aplikacji TV Nakładka dla telewizorów Samsung z systemem Tizen.

## Czym różni się od wersji na Androida

Samsung **nie pozwala** zwykłym aplikacjom wyświetlać niczego nad innymi aplikacjami
(Netflix, YouTube, telewizja). Ta możliwość jest zarezerwowana dla partnerów Samsunga.
Dlatego ta wersja działa inaczej:

* po uruchomieniu **sama pokazuje obraz** – telewizję z anteny (tuner) albo wybrane wejście **HDMI** – na całym ekranie,
* **na tym obrazie** wyświetla zegar z sekundami, 5 pól z encjami Home Assistanta i kamery,
* działa tylko, **dopóki ta aplikacja jest otwarta** (nie nad Netflixem ani YouTube).

Kanały przełączasz w niej przyciskami **P+ / P−**, głośność działa normalnie.

## Co umie

* zegar z sekundami (format, czcionka, kolory, przezroczystość, położenie),
* 5 pól z encjami HA – każde może pokazywać do 4 encji na zmianę z animacją
  (zanikanie, obrót 3D, powiększenie, przesunięcie),
* tła: jednolite, **szkło jasne/ciemne (iOS)**, ramka; krycie tła i tekstu, cień,
* tryb: sama wartość / nazwa + wartość / sama nazwa, warunki („pokaż gdy > 100”), pola „na żądanie”,
* przesuwanie wszystkich elementów razem,
* do 6 zapisanych kamer, pokazywanych na dole ekranu przyciskiem pilota (maks. 30 s),
* przypisywanie przycisków pilota (np. kolorowych) do kamer i pól,
* wszystkie ustawienia pilotem (przycisk **OK**).

## Obsługa pilotem

| Przycisk | Działanie |
|---|---|
| **OK** | menu ustawień |
| ▲ ▼ | wybór pozycji |
| ◀ ▶ | zmiana wartości (w menu) |
| ⏪ ⏩ | zmiana wartości o większy krok |
| **WSTECZ** | powrót / zamknięcie kamer / wyjście z aplikacji |
| **P+ / P−** | kanał w górę / w dół (źródło TV) |
| kolorowe | domyślnie: czerwony – wszystkie kamery, zielony – pola „na żądanie” |

## Kamery

Przeglądarka w telewizorze Samsung **nie odtwarza RTSP**. Użyj dodatku **go2rtc** w Home Assistant
(repozytorium dodatków `https://github.com/AlexxIT/hassio-addons`) i podaj adres MJPEG albo HLS:

```
http://IP_HOME_ASSISTANTA:1984/api/stream.mjpeg?src=brama       (MJPEG – najpewniejszy)
http://IP_HOME_ASSISTANTA:1984/api/stream.m3u8?src=brama        (HLS)
http://IP_HOME_ASSISTANTA:1984/api/frame.jpeg?src=brama         (zdjęcie odświeżane co 1 s)
```

W konfiguracji go2rtc kamera wygląda tak:

```yaml
streams:
  brama: rtsp://LOGIN:HASLO@192.168.1.50:554/stream2
```

---

## Instalacja

Samsung pozwala instalować własne aplikacje tylko przez program **Tizen Studio** z certyfikatem
Samsunga przypisanym do Twojego telewizora. Robisz to raz; aktualizacje to już tylko jedno kliknięcie.

### 1. Programy na komputerze (Windows)

1. Pobierz i zainstaluj **Tizen Studio** (wersja z IDE): https://developer.tizen.org/development/tizen-studio/download
2. Uruchom **Package Manager** (instaluje się razem z Tizen Studio), zakładka **Extension SDK** i zainstaluj:
   * **TV Extensions** (najnowsze),
   * **TV Extensions Tools**,
   * **Samsung Certificate Extension**.
3. Załóż bezpłatne konto **Samsung** (jeśli nie masz) – będzie potrzebne do certyfikatu.

### 2. Tryb dewelopera w telewizorze

1. Komputer i telewizor muszą być w tej samej sieci. Sprawdź IP komputera (`ipconfig` w `cmd`).
2. Na telewizorze otwórz **Aplikacje** (Apps).
3. Na ekranie aplikacji wpisz pilotem **1 2 3 4 5** (cyfry pilota albo klawiatura ekranowa).
4. W okienku ustaw **Developer mode: On**, wpisz **IP komputera** i zatwierdź.
5. **Wyłącz i włącz** telewizor (najlepiej wyjmij wtyczkę na 30 s).
   Na ekranie Aplikacji pojawi się napis **Develop mode**.

### 3. Połączenie z telewizorem

1. Tizen Studio → **Tools → Device Manager**.
2. **Remote Device Manager** (ikona) → **+** → wpisz nazwę (np. `Samsung`) i **IP telewizora**, port `26101` → **Add**.
3. Przełącz **Connection** na **ON**. Telewizor pojawi się na liście urządzeń.

### 4. Certyfikat Samsung

1. Tizen Studio → **Tools → Certificate Manager** → **+**.
2. Wybierz **Samsung** (nie Tizen!) → typ urządzenia **TV**.
3. Nazwa profilu, np. `MojTV` → **Create a new author certificate** → wpisz nazwę i hasło →
   zaloguj się kontem Samsung.
4. **Distributor certificate**: Privilege **Public**, a na liście **DUID** powinien już być Twój telewizor
   (dlatego najpierw krok 3). Zaloguj się ponownie kontem Samsung → **Finish**.
5. Zachowaj kopię certyfikatów (folder `C:\Users\TWOJA_NAZWA\SamsungCertificate`) – aktualizacje muszą
   być podpisane tym samym certyfikatem.

### 5. Pobranie aplikacji i Twoje dane

1. Pobierz kod: na stronie repozytorium **Code → Download ZIP** i rozpakuj (np. `C:\tv_nakladka_tizen`).
2. Otwórz plik **`config.json`** w Notatniku i wpisz adres i token Home Assistanta
   (token: w HA kliknij swój profil → **Bezpieczeństwo** → **Tokeny długoterminowe** → **Utwórz token**):

```json
{
  "ha": { "url": "http://192.168.1.10:8123", "token": "TUTAJ_DŁUGI_TOKEN", "interval": 5 },
  "source": { "type": "TV", "number": 1 },
  "e1": { "entity": "sensor.siedlce_temperatura" },
  "cams": { "c1_name": "Brama", "c1_url": "http://192.168.1.10:1984/api/stream.mjpeg?src=brama" }
}
```

   Wszystko inne (wygląd, położenie, kolejne encje, przyciski) ustawisz już na telewizorze pilotem.
   **Nie wysyłaj** pliku z tokenem z powrotem do GitHuba.

### 6. Instalacja na telewizorze

**Sposób A – w Tizen Studio (najprostszy):**

1. **File → Import → Tizen → Tizen Project** → wskaż folder `C:\tv_nakladka_tizen` → **Finish**.
   (Jeśli import się nie uda: **File → New → Tizen Project → Template → TV → Web Application → Basic Project**,
   nazwa `TvNakladka`, a potem skopiuj do tego projektu wszystkie pliki z repozytorium, zastępując istniejące).
2. Kliknij projekt prawym przyciskiem → **Run As → 1 Tizen Web Application**.
3. Aplikacja zainstaluje się i uruchomi na telewizorze. Później znajdziesz ją w **Aplikacjach** jako **TvNakladka**.

**Sposób B – z wiersza poleceń:**

```
cd C:\tv_nakladka_tizen
set PATH=%PATH%;C:\tizen-studio\tools;C:\tizen-studio\tools\ide\bin
sdb connect IP_TELEWIZORA
sdb devices
tizen build-web -- .
tizen package -t wgt -s MojTV -- .buildResult
tizen install -n TvNakladka.wgt -t NAZWA_Z_SDB_DEVICES -- .buildResult
```

### Aktualizacja

Pobierz nową wersję z GitHuba, przenieś do niej swój `config.json` i zainstaluj tak samo (krok 6).
Ustawienia zrobione pilotem zostają w telewizorze.

## Rozwiązywanie problemów

* **Brak obrazu w tle** – OK → **Obraz w tle** → wybierz źródło (TV lub HDMI i numer wejścia).
* **Pola pokazują „—”** – OK → **Home Assistant**: stan połączenia. „zły token (401)” – nowy token;
  „brak połączenia z HA” – sprawdź adres (IP, a nie `homeassistant.local`).
* **„Brak połączenia z HA”, choć adres i token są dobre** – Home Assistant mógł zablokować zapytanie z innej
  „strony” (CORS). Może pomóc dopisanie w `configuration.yaml`:
  ```yaml
  http:
    cors_allowed_origins:
      - "null"
      - "file://"
  ```
  i restart HA. Daj znać, jeśli to nie pomoże.
* **Telewizor nie łączy się z Tizen Studio** – sprawdź, czy w trybie dewelopera wpisany jest aktualny IP komputera.
* **Tryb dewelopera wyłączył się sam** – na części modeli wyłącza się po kilku dniach; włącz go ponownie (krok 2).
  Zainstalowana aplikacja zwykle zostaje; jeśli zniknie, zainstaluj ją ponownie.
