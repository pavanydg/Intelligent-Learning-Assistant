# Environment Variables for New Features

This document lists the additional environment variables required for the three new features.

## Feature 1: Plugin Ecosystem / API Integrations

### Notion Integration
```env
# Notion uses internal integrations with API keys, NOT OAuth
# No environment variables needed - users configure API key manually in the app
```

**How to set up:**
1. Go to https://www.notion.so/my-integrations
2. Create a new **Internal** integration
3. Copy the **Internal Integration Token** (starts with `secret_`)
4. In the ILA app, go to `/integrations` and enter:
   - Your API key (the token from step 3)
   - Your Database ID (from your Notion database URL)
5. Share your database with the integration (click "..." → "Connections" → select your integration)

**Note:** Notion does NOT use OAuth, so no CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI is needed.

### Google Docs Integration
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/integrations/googledocs/callback
```

**How to get:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URIs
4. Enable Google Docs API and Google Drive API

### Moodle Integration
```env
# Moodle doesn't require OAuth - users configure manually
# No additional environment variables needed
```

## Feature 2: AI Proctoring

No additional environment variables required. Proctoring uses existing infrastructure.

## Feature 3: Cross-Device Learning Continuity

### Option 1: Firebase Realtime Database (Recommended)
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

**How to get:**
1. Go to https://console.firebase.google.com/
2. Create a new project
3. Enable Realtime Database
4. Copy configuration from Project Settings

### Option 2: Supabase Realtime (Alternative)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**How to get:**
1. Go to https://supabase.com/
2. Create a new project
3. Copy API keys from Project Settings

**Note:** If neither Firebase nor Supabase is configured, the system will use MongoDB-only sync (works but not real-time).

## Complete .env Example

```env
# Existing ILA Configuration
PORT=4001
NODE_ENV=development
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ila-db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-here
GEMINI_API_KEY=your_gemini_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
YOUTUBE_DATA_API_KEY=your-youtube-data-api-key-here
CLIENT_URL=http://localhost:5173

# Feature 1: Integrations
# Notion: No environment variables needed - uses internal integrations with API keys (configured in app)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/integrations/googledocs/callback

# Feature 3: Cross-Device Sync (Optional - choose one)
# Firebase
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# OR Supabase
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your_supabase_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Installation Notes

1. **Notion & Google Docs**: These are optional. If not configured, users won't be able to connect these integrations, but the rest of the system works fine.

2. **Firebase/Supabase**: Optional for Feature 3. If not configured, sync will work via MongoDB only (not real-time, but still functional).

3. **All features are backward compatible**: Existing functionality continues to work even if new environment variables are not set.


