# Your site AI

Your site AI to statyczna aplikacja Next.js z App Routerem, TypeScriptem i lokalnym runtime LLM w przeglądarce. Interfejs został zaprojektowany jako ciemny, premium chat do pracy nad stronami, JavaScriptem, TypeScriptem, Reactem, Next.js i jakością UI.

## Umiejętności asystenta

- Pisanie, debugowanie i refaktorowanie JavaScriptu.
- Projektowanie typów, poprawianie błędów kompilatora i wyjaśnianie TypeScriptu.
- Pomoc przy React, Next.js, komponentach, formularzach i stanie aplikacji.
- Ulepszanie UX/UI: hierarchia, copy, spacing, dostępność i jakość premium.
- Konkretne odpowiedzi: krótkie sekcje, listy kroków, założenia i sposoby weryfikacji.

## Wymagania

- Node.js 20 lub nowszy
- npm
- Przeglądarka z WebGPU, na przykład aktualny Chrome albo Edge
- Opcjonalnie Firebase CLI do wdrożenia
- Projekt Firebase z włączonym logowaniem Email/Password, jeśli chcesz odblokować pisanie w chacie

## Instalacja

```bash
npm install
```

## Lokalny development

```bash
npm run dev
```

Otwórz `http://localhost:3000`, kliknij `Uruchom AI` i poczekaj na zakończenie przygotowania asystenta. Pierwsze uruchomienie może potrwać dłużej, ponieważ przeglądarka pobiera wymagane pliki do pamięci podręcznej.

## Sprawdzenie typów

```bash
npm run typecheck
```

## Build i statyczny export

```bash
npm run build
```

Next.js jest skonfigurowany z `output: 'export'`, więc po buildzie statyczne pliki są dostępne w katalogu `out`.

## Konfiguracja Firebase Auth

Aplikacja pokazuje interfejs czatu każdemu użytkownikowi, ale przed wysłaniem pierwszej wiadomości wymaga logowania przez Firebase Auth. Przepływ jest dwuetapowy: po próbie pisania użytkownik podaje e-mail, a dopiero potem hasło.

1. W konsoli Firebase włącz Authentication → Sign-in method → Email/Password.
2. Dodaj użytkowników, którzy mają mieć możliwość pisania w chacie.
3. Ustaw publiczną konfigurację Firebase w zmiennych środowiskowych Next.js:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Bez tych zmiennych aplikacja nadal się zbuduje i pokaże chat, ale logowanie wyświetli komunikat o brakującej konfiguracji Firebase.

## Konfiguracja Firebase Hosting

1. Utwórz projekt Firebase w konsoli Firebase.
2. Skopiuj przykładową konfigurację, jeśli korzystasz z pliku `.firebaserc.example`:

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

Skrypt `deploy` uruchamia `firebase deploy --only hosting`. Plik `firebase.json` wskazuje katalog `out` jako publiczny katalog hostingu.

## Struktura

- `src/app/page.tsx` renderuje pojedynczy ekran czatu.
- `src/components/LocalLlmChat.tsx` zawiera interfejs czatu, osobowość asystenta, listę umiejętności, logowanie Firebase i stany UI.
- `src/lib/firebase.ts` inicjuje Firebase Auth po stronie klienta na podstawie zmiennych `NEXT_PUBLIC_FIREBASE_*`.
- `src/hooks/useLocalLlm.ts` izoluje ładowanie modelu, streaming i zatrzymywanie generowania.
- `src/app/globals.css` definiuje ciemny, premium wygląd aplikacji.
- `next.config.ts` włącza statyczny export.
- `firebase.json` konfiguruje Firebase Hosting.
