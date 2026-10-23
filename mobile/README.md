# MiniLedger mobile app

This app uses Expo Router. Its login, loan list, receipt upload, and API/session helpers live under `src`.

## Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the backend from the `backend` folder.
3. Start Expo from the `mobile` folder:

   ```bash
   npx expo start
   ```

The app attempts to find the backend on the same machine as the Expo development server. If that does not work (for example, with a tunnel or a physical phone), copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the backend's reachable URL. On a physical phone, use the computer's LAN IP address rather than `localhost`.

OTP messages are printed in the backend terminal in this demo setup.
