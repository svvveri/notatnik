# Notatnik tekstów: podłączenie Dysku Google (jednorazowo, ok. 10 minut)

Aplikacja zapisuje teksty i nagrania w folderze **„!Teksty”** na Twoim Dysku Google. Widzi tylko pliki, które sama tam utworzy (zakres `drive.file`), a nie resztę Dysku. Żeby się zalogować, potrzebuje „identyfikatora klienta” z Google Cloud. To nie jest hasło ani sekret, można go bezpiecznie wkleić do czatu.

1. Wejdź na https://console.cloud.google.com i zaloguj się kontem, na którego Dysku mają leżeć dane.
2. U góry kliknij listę projektów → **Nowy projekt** → nazwa `Notatnik tekstow` → **Utwórz**.
3. Menu ☰ → **Interfejsy API i usługi** → **Biblioteka** → wyszukaj **Google Drive API** → **Włącz**.
4. **Interfejsy API i usługi** → **Ekran zgody OAuth** (albo „Google Auth Platform”):
   - typ użytkownika: **Zewnętrzny** → Utwórz,
   - nazwa aplikacji: `Notatnik tekstów`, e-mail pomocy i kontaktowy: Twój,
   - **Użytkownicy testowi** → **Dodaj użytkowników** → wpisz swój adres Gmail,
   - zakresy (Scopes) → **Dodaj** → wybierz `.../auth/drive.file`,
   - status publikacji zostaw jako **Testowanie**.
5. **Dane logowania** → **Utwórz dane logowania** → **Identyfikator klienta OAuth** → typ **Aplikacja internetowa**:
   - **Autoryzowane źródła JavaScript** → dodaj: `https://svvveri.github.io` (oraz do prób lokalnych: `http://localhost:8765`),
   - **Autoryzowane identyfikatory URI przekierowania** zostaw puste,
   - **Utwórz** → skopiuj **Identyfikator klienta** (kończy się na `.apps.googleusercontent.com`).
6. Wklej go Claude'owi w czacie. Reszta jest po mojej stronie.

Przy pierwszym logowaniu Google pokaże „Ta aplikacja nie została zweryfikowana”. To normalne dla własnej aplikacji w trybie testowym: **Zaawansowane** → **Przejdź do Notatnik tekstów (niebezpieczne)** → zezwól na dostęp do plików utworzonych przez aplikację.

Uwagi:
- W trybie testowym logowanie wygasa po godzinie i odnawia się samo przy najbliższym dotknięciu ekranu (na iPhonie na chwilę mignie okienko Google).
- Dane są w Twoim Dysku, więc masz do nich dostęp i bez aplikacji (`teksty.json` i pliki `nagranie-*.m4a`).
