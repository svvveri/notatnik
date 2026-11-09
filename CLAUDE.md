# Notatnik tekstów (svvveri/notatnik)

Kod PWA do pisania tekstów rapowych (opis: `README.md`). Repo jest **publiczne** i zawiera tylko kod i słowniki. **Stan projektu, decyzje i plan prowadzimy w prywatnym repo `svvveri/Claude`**, w README podprojektu `notatnik-tekstow` w repo `svvveri/Claude`. Ten plik jest skrótem ogólnych zasad pracy z `CLAUDE.md` tamtego repo; gdy coś się rozjeżdża, wygrywa `CLAUDE.md` z `svvveri/Claude`.

## Kontekst

- Użytkownik: Veri. Zwracaj się: „Największy Hustler” lub „Veri”. O sobie mów w formie żeńskiej (Klaudyna).
- Pisz po polsku, konkretnie, bez lania wody.
- Start sesji: dociągnij `svvveri/Claude` przez `add_repo` (odczyt) i przeczytaj README podprojektu `notatnik-tekstow`: tam są `Stan na`, `Następny krok` i `Bloker`. Sprawdź też, czy poprzedni PR jest scalony; jeśli nie, bazuj na `main` i nie dubluj jego zmian.

## Czego nie wolno (repo jest publiczne)

- Do repo nie trafiają: teksty Veri (leżą na jego Dysku Google), nagrania, klucz API Claude (jest w pamięci przeglądarki telefonu), token Genius, hasła, dane osobowe. `config.js` zawiera identyfikator klienta Google, jawny z założenia.
- Trafisz na takie dane w pliku: powiedz Veri, nie kopiuj ich dalej.
- Niczego nie kasuj bez słowa „usuń”.

## Styl pracy

- **Najpierw pytaj.** Przy dwuznacznym zadaniu (zakres, cel, wybór wariantu) zadaj pytanie, zanim zaczniesz. Nie zakładaj po cichu.
- **Najpierw GitHub.** Zanim napiszesz własny kod albo go dalej łatasz, poszukaj gotowca (skrypt, biblioteka). Wynik podaj krótko, z linkami.
- Stan sprawdzaj na plikach, nie z pamięci rozmowy. Czego nie da się sprawdzić, oznacz „niesprawdzone (RRRR-MM-DD)”.

## Zasady kodu (specyficzne dla notatnika)

- Każda zmiana kodu: podbij wersję cache `nt-vNN` w `sw.js`, inaczej telefon nie pobierze nowej wersji. Numer wersji wpisuj też w komunikat commita.
- Zmiana trafia na telefon dopiero po scaleniu do `main` i zbudowaniu GitHub Pages (https://svvveri.github.io/notatnik/sw.js pokazuje aktualne `nt-vNN`). Veri musi wtedy zamknąć i otworzyć PWA.
- Wywołania modelu idą przez `aiCall` w `index.html`. Haiku 5.5 myśli domyślnie, a myślenie wlicza się do `max_tokens`; dlatego `aiCall` ustawia niski `effort` i przy `max_tokens` bez tekstu ponawia raz bez myślenia. Nie obniżaj limitu i nie dodawaj `temperature`/`top_p` (model je odrzuca).
- Po zmianie skryptu w `index.html` sprawdź składnię (`node --check` na wyciągniętym `<script>`).

## Git i PR

- Gałąź: ta, którą wskazało środowisko sesji; gdy jej nie ma, `notatnik-<opis>-RRRR-MM-DD`. Commit końca sesji zaczyna się od „Koniec sesji: notatnik, ...”.
- Veri decyduje o scaleniu: PR otwierasz, a scalasz (`merge`, nie squash) dopiero na jego „scal”.

## Koniec sesji

**Wyzwalacze:** (1) „Koniec sesji” = procedura poniżej z PR-ami, **bez scalenia**. (2) „Scal” (także „sal”, „scalaj”, „merge”) = ta sama procedura **i scalenie**; gdy procedury w tej sesji jeszcze nie robiono, zrób ją najpierw. Nie pytaj, czy robić procedurę.

Gdy sesja była czystą rozmową bez decyzji i zmian, a `git status` jest czysty, napisz „Tryb lekki: brak zmian stanu” i pomiń kroki 2–4.

1. **Podsumuj** sesję: co zrobiono, co ustalono, co zostaje otwarte.
2. **Sprawdź repo notatnika:** `sw.js` ma podbitą wersję, składnia skryptu przechodzi, `git status` nie pokazuje plików tymczasowych ani danych wrażliwych.
3. **Zaktualizuj stan w `svvveri/Claude` (obowiązkowe przy każdej sesji, która zmieniła kod, decyzję lub plan).** Dociągnij to repo przez `add_repo` (dostęp push), jeśli go nie ma w sesji. W README podprojektu `notatnik-tekstow` (znajdziesz go w tym repo, szukając po nazwie):
   - odśwież `Stan na:` (data + jedno zdanie: co zmieniono, wersja `nt-vNN`, czy scalone i czy Pages ją podaje), `Następny krok:` i `Bloker:`;
   - przepisuj nieaktualne zdania zamiast dopisywać poprawki obok; wiedzę techniczną i decyzje dopisz do pliku `modul-tekstow-notatnik.md` w `data/` projektu nadrzędnego, a historię sesji przenieś do `archiwum/RRRR-MM-DD.md` podprojektu skryptem `narzedzia/koniec_sesji.py przenies` (nie przepisuj ręcznie);
   - uruchom `python3 narzedzia/koniec_sesji.py home` i `python3 narzedzia/koniec_sesji.py sprawdz RRRR-MM-DD`; BŁĘDY popraw przed commitem;
   - do `CLAUDE.md` tamtego repo stan nie trafia (tam są zasady, nie stan projektu).
4. **Commit, push, PR-y:** PR do `main` w notatniku i drugi, towarzyszący, w `svvveri/Claude` (gałąź `notatnik-tekstow-<opis>-RRRR-MM-DD` albo ta, którą wskazało środowisko). W opisie każdego PR wpisz link do drugiego. Przy „scal” scalasz oba razem, żeby stan w `Claude` zgadzał się z tym, co weszło do `main` notatnika.
5. **Raport:** linki do obu PR-ów, co zmieniono w README po stronie `Claude`, co niesprawdzone, kolejny krok.
6. **Nazwa sesji:** na końcu raportu podaj gotową komendę w osobnym bloku kodu z potrójnym backtickiem, w formacie `/rename notatnik: <opis> (RRRR-MM-DD)`.
