# Lokalny Asystent AI na Firebase Hosting

To jest statyczna aplikacja Next.js z App Routerem, TypeScriptem i WebLLM. Model `Llama-3.2-1B-Instruct-q4f16_1-MLC` działa lokalnie w przeglądarce użytkownika przez WebGPU. Aplikacja nie używa Gemini, OpenAI API, Firebase AI Logic, API routes, server actions, Cloud Functions, Cloud Run ani żadnego backendu inferencyjnego.

## Prywatność i koszty

- Inferencja LLM działa w całości w przeglądarce użytkownika.
- Prompty i odpowiedzi nie są wysyłane do zewnętrznego API.
- Historia czatu jest zapisywana tylko w `localStorage` danego urządzenia.
- Firebase jest skonfigurowany wyłącznie jako statyczny Hosting z katalogu `out`.
- Po wdrożeniu aplikacja jest darmowa w uruchomieniu poza standardowymi limitami darmowego Firebase Hosting.
- Projekt nie zawiera kluczy API, telemetrii, analityki, Auth, Firestore, Storage, Functions ani Cloud Run.

## Wymagania

- Node.js 20 lub nowszy
- npm
- Przeglądarka z WebGPU, na przykład aktualny Chrome albo Edge
- Opcjonalnie Firebase CLI do wdrożenia

## Instalacja

```bash
npm install
```

## Lokalny development

```bash
npm run dev
```

Otwórz `http://localhost:3000`, kliknij `Załaduj model` i poczekaj na zakończenie pobierania oraz inicjalizacji modelu. Pierwsze ładowanie może potrwać dłużej, ponieważ przeglądarka pobiera pliki modelu i zapisuje je w pamięci podręcznej.

## Sprawdzenie typów

```bash
npm run typecheck
```

## Build i statyczny export

```bash
npm run build
```

Next.js jest skonfigurowany z `output: 'export'`, więc po buildzie statyczne pliki są dostępne w katalogu `out`.

## Konfiguracja Firebase Hosting

1. Utwórz projekt Firebase w konsoli Firebase.
2. Skopiuj przykładową konfigurację:

```bash
cp .firebaserc.example .firebaserc
```

3. W pliku `.firebaserc` zastąp `your-firebase-project-id` identyfikatorem swojego projektu.
4. Zaloguj się do Firebase CLI, jeśli jeszcze tego nie zrobiono:

```bash
npx firebase login
```

## Deploy do Firebase Hosting

```bash
npm run build
npm run deploy
```

Skrypt `deploy` uruchamia `firebase deploy --only hosting`. Plik `firebase.json` wskazuje katalog `out` jako jedyny publiczny katalog hostingu.

## Struktura

- `src/app/page.tsx` renderuje pojedynczy ekran czatu.
- `src/components/LocalLlmChat.tsx` zawiera interfejs czatu, obsługę localStorage i stany UI.
- `src/hooks/useLocalLlm.ts` izoluje logikę WebLLM, ładowanie modelu, streaming i zatrzymywanie generowania.
- `next.config.ts` włącza statyczny export.
- `firebase.json` konfiguruje statyczny Firebase Hosting.
