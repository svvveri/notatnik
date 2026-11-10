# Gałąź `model`: wagi modelu do dopasowania tekstu do dźwięku (tylko dane)

Zawartość `ctc/`: model `int8mm.onnx` pocięty na kawałki `part-00…07` (po ≤ 46 MB, limit GitHuba to 100 MB na plik) i `manifest.json` (rozmiary, suma SHA-256 po sklejeniu). Aplikacja pobiera kawałki z `raw.githubusercontent.com` i skleja w pamięci przeglądarki.

## Pochodzenie i licencja

- Model: **`deskpai/ctc_forced_aligner`** (Hugging Face), czyli wav2vec2 MMS-300m w wersji do wymuszonego dopasowania (CTC forced alignment); oryginał: Meta MMS, pakiet `ctc-forced-aligner` (Deskpai / Mahmoud Ashraf).
- Licencja: **Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)**: https://creativecommons.org/licenses/by-nc/4.0/. Użycie niekomercyjne, z uznaniem autorstwa.
- **Zmiany w stosunku do oryginału:** kwantyzacja wag warstw `MatMul` do int8 (`onnxruntime.quantization.quantize_dynamic`, tylko `MatMul`, konwolucje zostają w fp32) oraz podział pliku na kawałki. Poza tym wagi bez zmian.
- Ta gałąź nie zawiera kodu aplikacji ani danych użytkownika.
