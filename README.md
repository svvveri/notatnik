# Notatnik tekstów

Osobisty notatnik do pisania tekstów rapowych: sylaby przy wersach, adliby, części utworu (refren, zwrotka), BPM i tonacja, ściana rymów, nagrywanie głosu pod metronom. Aplikacja webowa (PWA), dane trzymane w folderze „!Teksty” na Dysku Google użytkownika (zakres `drive.file`). W repozytorium nie ma żadnych tekstów ani nagrań, tylko kod.

- Logowanie: Google Identity Services, identyfikator klienta w `config.js` (jawny z założenia).
- Konfiguracja Google Cloud: `INSTRUKCJA-GOOGLE.md`.
- Słownik rymów (`rym_slownik.txt`): wygenerowany ze słownika SJP.pl (https://sjp.pl/sl/ort/, wersja 2026-11-01), udostępnianego na licencji CC BY 4.0 (do wyboru również GPL 2, LGPL 2.1, MPL 1.1, Apache 2.0). Autorzy: zespół SJP.pl.

## Dane spakowane (gzip)
Pliki w `rym/`, `ctx/` i `lin/` leżą jako `.txt.gz` (o ok. 70% mniej miejsca w repozytorium i w pamięci telefonu); aplikacja rozpakowuje je w przeglądarce (`gzTxt` w index.html, wymaga iOS 16.4+ / nowoczesnej przeglądarki). Po przebudowie słownika spakuj ponownie: `gzip -9n rym/*.txt` (analogicznie `ctx`, `lin`). `rym/idx.json` zostaje nieskompresowany.
