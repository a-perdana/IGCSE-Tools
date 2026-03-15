# IGCSE Tools — Comprehensive Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor IGCSE Tools from a monolithic 1956-line App.tsx into a well-structured, secure, and maintainable React application with Firebase Storage, structural data model, and modular hooks/components.

**Architecture:** Five sequential phases — security/cleanup first, then infrastructure (Storage + error handling), then data model, then App.tsx refactoring into hooks+components, finally UX fixes. Each phase ends with a passing `npm run lint` and a git commit.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12 (Firestore + Storage), @google/genai 1.29, Tailwind CSS v4, Vitest (added for utility unit tests), lucide-react, react-markdown + KaTeX

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/types.ts` | All shared TypeScript interfaces |
| Create | `src/lib/clipboard.ts` | Cross-browser clipboard utility |
| Create | `src/lib/pricing.ts` | Gemini cost estimator |
| Create | `src/lib/svg.ts` | Safe SVG parser (DOMParser) |
| Create | `src/hooks/useAssessments.ts` | Firestore CRUD + library state |
| Create | `src/hooks/useGeneration.ts` | Gemini generation + retry |
| Create | `src/hooks/useNotifications.ts` | Toast notification state |
| Create | `src/hooks/useResources.ts` | Firebase Storage upload/download |
| Create | `src/components/Sidebar/index.tsx` | Config panel + knowledge base |
| Create | `src/components/AssessmentView/index.tsx` | Assessment display + editor |
| Create | `src/components/Library/index.tsx` | Question bank view |
| Create | `src/components/Notifications/index.tsx` | Toast UI |
| Create | `storage.rules` | Firebase Storage security rules |
| Create | `docs/firebase-api-key-restriction.md` | Console restriction instructions |
| Modify | `src/lib/firebase.ts` | Storage SDK + new interfaces + CRUD |
| Modify | `src/lib/gemini.ts` | withRetry + new types + updated functions |
| Modify | `src/App.tsx` | Gutted to ~120 lines |
| Modify | `firestore.rules` | Updated field validation |
| Modify | `firebase.json` | Add storage section |
| Modify | `package.json` | Remove motion, add vitest |

---

## Chunk 1: Faz 1 — Güvenlik & Temizlik

---

### Task 1: Test altyapısı kurulumu (vitest)

Utility fonksiyonlar için unit test altyapısı. Saf fonksiyonları test etmek için vitest kurulur.

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/__tests__/pricing.test.ts`

- [ ] **Step 1: vitest bağımlılığını ekle**

```bash
cd "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools"
npm install --save-dev vitest @vitest/ui jsdom
```

- [ ] **Step 2: vite.config.ts'e test config ekle**

`vite.config.ts` dosyasını oku. Mevcut dosya bir factory function (`defineConfig(({mode}) => { ... return { ... } })`) kullanıyor. `return` ifadesinin içindeki object'e **sadece** `test` bloğunu ekle — dosyanın geri kalanına dokunma:

```typescript
// vite.config.ts — sadece return object'e bu bloğu ekle:
test: {
  environment: 'jsdom',
},
```

Sonuç şöyle görünmeli:
```typescript
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: { 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: { hmr: process.env.DISABLE_HMR !== 'true' },
    test: {                   // ← sadece bu blok eklendi
      environment: 'jsdom',
    },
  };
});
```

- [ ] **Step 3: package.json'a test scripti ekle**

`"test": "vitest run"` ve `"test:ui": "vitest --ui"` scriptleri ekle.

- [ ] **Step 4: Placeholder test dosyası oluştur ve çalıştır**

```bash
mkdir -p src/lib/__tests__
```

`src/lib/__tests__/pricing.test.ts` içeriği:
```typescript
import { describe, it, expect } from 'vitest'

describe('placeholder', () => {
  it('passes', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Çalıştır:
```bash
npm run test
```
Beklenen: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts src/lib/__tests__/pricing.test.ts
git commit -m "chore: add vitest for utility unit tests"
```

---

### Task 2: `motion` paketini kaldır

**Files:**
- Modify: `package.json` (npm uninstall)

- [ ] **Step 1: `motion` import'u için kaynak dosyaları tara**

```bash
grep -r "from 'motion'" src/
grep -r "from \"motion\"" src/
```
Beklenen: Hiçbir satır çıkmamalı. Eğer import bulunursa bu task'ı atla.

- [ ] **Step 2: Paketi kaldır**

```bash
npm uninstall motion
```

- [ ] **Step 3: lint ile doğrula**

```bash
npm run lint
```
Beklenen: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused motion package (~150KB bundle saving)"
```

---

### Task 3: `.env` git geçmişini kontrol et ve temizle

**Files:**
- `.env`, `.gitignore`

- [ ] **Step 1: `.env`'in git geçmişinde olup olmadığını kontrol et**

```bash
git log --all --oneline -- .env
```
- Eğer hiçbir commit çıkmıyorsa: Step 2'yi atla, Step 3'e geç.
- Eğer commit çıkıyorsa: Step 2'ye devam et.

- [ ] **Step 2 (koşullu): Geçmişten temizle ve API key rotate et**

```bash
# git-filter-repo kurulu değilse:
pip install git-filter-repo

git filter-repo --path .env --invert-paths --force
```

Ardından Google AI Studio Console'dan mevcut API key'i iptal et, yeni key al, `.env` dosyasına yaz:
```
GEMINI_API_KEY="YENİ_KEY_BURAYA"
```

- [ ] **Step 3: `.gitignore` doğrulaması**

```bash
cat .gitignore | grep ".env"
```
Beklenen: `.env` satırı mevcut olmalı (zaten var).

- [ ] **Step 4: `.env.example` dosyasını güncelle**

```
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with current variable names"
```

---

### Task 4: Firebase API key restriction dokümantasyonu

**Files:**
- Create: `docs/firebase-api-key-restriction.md`

- [ ] **Step 1: Döküman dosyasını oluştur**

`docs/firebase-api-key-restriction.md`:
```markdown
# Firebase API Key Restriction

The `firebase-applet-config.json` contains a browser API key that should be restricted
to prevent unauthorized use from other domains.

## Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: **igcse-tools**
3. Navigate to: APIs & Services → Credentials
4. Find the **Browser key** (or API key named for this project)
5. Click Edit → Application restrictions → HTTP referrers
6. Add these allowed referrers:
   - `igcse-tools.firebaseapp.com/*`
   - `igcse-tools.web.app/*`
   - `localhost/*`
   - `127.0.0.1/*`
7. Save

## Note

Firebase API keys for web apps are inherently public — Firestore security rules
are the actual security layer. Restricting the key adds an extra layer by preventing
use from unexpected origins.
```

- [ ] **Step 2: Commit**

```bash
git add docs/firebase-api-key-restriction.md
git commit -m "docs: add Firebase API key restriction instructions"
```

---

## Chunk 2: Faz 2 — Altyapı

---

### Task 5: `src/lib/clipboard.ts` — cross-browser clipboard

**Files:**
- Create: `src/lib/clipboard.ts`
- Create: `src/lib/__tests__/clipboard.test.ts`

- [ ] **Step 1: Failing test yaz**

`src/lib/__tests__/clipboard.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// clipboard.ts testleri jsdom ortamında çalışır
// navigator.clipboard mock'la

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()  // module cache'i temizle — isSecureContext mock'u sızmaz
  })

  it('returns true when clipboard API is available and succeeds', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    })

    const { copyToClipboard } = await import('../clipboard')
    const result = await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result).toBe(true)
  })

  it('falls back when isSecureContext is false', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true })
    // execCommand fallback
    document.execCommand = vi.fn().mockReturnValue(true)

    const { copyToClipboard } = await import('../clipboard')
    const result = await copyToClipboard('fallback text')
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Test'i çalıştır — FAIL bekleniyor**

```bash
npm run test -- clipboard
```
Beklenen: `Cannot find module '../clipboard'`

- [ ] **Step 3: `src/lib/clipboard.ts` implementasyonu**

```typescript
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to execCommand
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}
```

- [ ] **Step 4: Test'i çalıştır — PASS bekleniyor**

```bash
npm run test -- clipboard
```
Beklenen: `2 passed`

- [ ] **Step 5: lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/clipboard.ts src/lib/__tests__/clipboard.test.ts
git commit -m "feat: add cross-browser clipboard utility with execCommand fallback"
```

---

### Task 6: `src/lib/pricing.ts` — model-agnostic cost calculator

**Files:**
- Create: `src/lib/pricing.ts`
- Create: `src/lib/__tests__/pricing.test.ts`

- [ ] **Step 1: Failing test yaz**

`src/lib/__tests__/pricing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { estimateCostIDR, MODEL_PRICING } from '../pricing'

describe('estimateCostIDR', () => {
  it('calculates cost for flash model', () => {
    // 1M input + 1M output tokens with flash pricing
    const cost = estimateCostIDR('gemini-3-flash-preview', 1_000_000, 1_000_000)
    // (0.10 + 0.40) * 15800 = 0.50 * 15800 = 7900
    expect(cost).toBe(7900)
  })

  it('calculates cost for pro model', () => {
    const cost = estimateCostIDR('gemini-3.1-pro-preview', 1_000_000, 1_000_000)
    // (1.25 + 5.00) * 15800 = 6.25 * 15800 = 98750
    expect(cost).toBe(98750)
  })

  it('falls back to flash pricing for unknown model', () => {
    const flash = estimateCostIDR('gemini-3-flash-preview', 100_000, 100_000)
    const unknown = estimateCostIDR('gemini-unknown-model', 100_000, 100_000)
    expect(unknown).toBe(flash)
  })

  it('returns 0 for 0 tokens', () => {
    expect(estimateCostIDR('gemini-3-flash-preview', 0, 0)).toBe(0)
  })

  it('MODEL_PRICING contains both models', () => {
    expect(MODEL_PRICING).toHaveProperty('gemini-3-flash-preview')
    expect(MODEL_PRICING).toHaveProperty('gemini-3.1-pro-preview')
  })
})
```

- [ ] **Step 2: Test'i çalıştır — FAIL bekleniyor**

```bash
npm run test -- pricing
```
Beklenen: `Cannot find module '../pricing'`

- [ ] **Step 3: `src/lib/pricing.ts` implementasyonu**

```typescript
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
}

const FALLBACK_MODEL = 'gemini-3-flash-preview'
const IDR_RATE = 15800

export function estimateCostIDR(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[modelId] ?? MODEL_PRICING[FALLBACK_MODEL]
  const usd = (inputTokens / 1_000_000 * p.input) + (outputTokens / 1_000_000 * p.output)
  return Math.round(usd * IDR_RATE)
}
```

- [ ] **Step 4: Test — PASS bekleniyor**

```bash
npm run test -- pricing
```
Beklenen: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/__tests__/pricing.test.ts
git commit -m "feat: add model-agnostic cost calculator with IDR conversion"
```

---

### Task 7: `src/lib/svg.ts` — safe SVG parser

**Files:**
- Create: `src/lib/svg.ts`
- Create: `src/lib/__tests__/svg.test.ts`

- [ ] **Step 1: Failing test yaz**

`src/lib/__tests__/svg.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseSVGSafe } from '../svg'

describe('parseSVGSafe', () => {
  it('returns outerHTML for valid SVG', () => {
    const svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>'
    const result = parseSVGSafe(svgString)
    expect(result).not.toBeNull()
    expect(result).toContain('<circle')
  })

  it('returns null for invalid SVG', () => {
    const invalid = '<svg><unclosed'
    const result = parseSVGSafe(invalid)
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSVGSafe('')).toBeNull()
  })

  it('handles SVG with nested elements', () => {
    const nested = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10"/></g></svg>'
    const result = parseSVGSafe(nested)
    expect(result).not.toBeNull()
    expect(result).toContain('<rect')
  })
})
```

- [ ] **Step 2: Test — FAIL bekleniyor**

```bash
npm run test -- svg
```

- [ ] **Step 3: `src/lib/svg.ts` implementasyonu**

```typescript
/**
 * Safely parses an SVG string using DOMParser.
 * Returns the validated outerHTML, or null if the SVG is malformed.
 */
export function parseSVGSafe(svgString: string): string | null {
  if (!svgString.trim()) return null
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null
  return doc.documentElement.outerHTML
}
```

- [ ] **Step 4: Test — PASS bekleniyor**

```bash
npm run test -- svg
```
Beklenen: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/svg.ts src/lib/__tests__/svg.test.ts
git commit -m "feat: add safe SVG parser using DOMParser instead of dangerouslySetInnerHTML regex"
```

---

### Task 8: Gemini `withRetry` ve hata yönetimi

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: `gemini.ts`'e `GeminiError` tipi ve `withRetry` ekle**

`src/lib/gemini.ts` dosyasının en üstüne (import'lardan sonra, mevcut sabitlerin önüne) şu bloğu ekle:

```typescript
// ---- Error handling ----
export interface GeminiError {
  type: 'rate_limit' | 'model_overloaded' | 'invalid_response' | 'network' | 'unknown'
  retryable: boolean
  message: string
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  onRetry?: (attempt: number) => void
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      const status = err?.status ?? err?.code
      if (status === 429 && i < maxRetries - 1) {
        onRetry?.(i + 1)
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
        continue
      }
      if (status === 503) {
        throw {
          type: 'model_overloaded',
          retryable: false,
          message: 'Model şu an meşgul. Flash modele geçmeyi deneyin.',
        } satisfies GeminiError
      }
      throw err
    }
  }
  throw {
    type: 'rate_limit',
    retryable: false,
    message: 'Rate limit aşıldı. Birkaç dakika bekleyip tekrar deneyin.',
  } satisfies GeminiError
}
// -------------------------
```

- [ ] **Step 2: `generateTest()` çağrısını `withRetry` ile sar**

`generateTest` fonksiyonundaki `const response = await ai.models.generateContent(...)` satırını şöyle değiştir:

```typescript
const response = await withRetry(() => ai.models.generateContent({
  model: config.model || "gemini-3-flash-preview",
  contents: { parts },
  config: {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
    responseSchema: { /* mevcut schema aynen kalır */ },
    systemInstruction: `/* mevcut instruction aynen kalır */`,
  },
}))
```

- [ ] **Step 3: `auditTest()` ve `analyzeFile()` çağrılarını `withRetry` ile sar**

Aynı pattern'i `auditTest` ve `analyzeFile` içindeki `ai.models.generateContent` çağrılarına uygula.

- [ ] **Step 4: `lint` ile doğrula**

```bash
npm run lint
```
Beklenen: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add withRetry to Gemini calls with exponential backoff for 429/503 errors"
```

---

### Task 9: Firebase Storage entegrasyonu

**Files:**
- Modify: `src/lib/firebase.ts` — Storage init + `saveResource`/`deleteResource` güncelleme
- Create: `storage.rules`
- Modify: `firebase.json`

> **Ön koşul:** Firebase Console'da `igcse-tools` projesi için Storage'ı etkinleştir (Spark plan sınırları dahilinde). `firebase-applet-config.json`'da `"storageBucket": "igcse-tools.firebasestorage.app"` olduğunu doğrula.

- [ ] **Step 1: `firebase.ts`'e Storage import, `setDoc` import ve init ekle**

`firebase/firestore` import bloğuna `setDoc` ekle (mevcut `addDoc`, `updateDoc` yanına):
```typescript
import {
  getFirestore, collection, addDoc, query, where, getDocs,
  deleteDoc, doc, serverTimestamp, Timestamp, orderBy,
  updateDoc, deleteField, getDoc,
  setDoc    // ← yeni
} from 'firebase/firestore';
```

Firestore import bloğunun altına Storage import'unu ekle:
```typescript
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

export const storage = getStorage(app)
```

- [ ] **Step 2: `Resource` interface'ini güncelle**

Mevcut `Resource` interface'ini (satır 111-119) şununla değiştir:

```typescript
export interface Resource {
  id: string    // required — saveResource artık id'yi kendisi oluşturup döndürüyor
  name: string
  subject: string
  storagePath: string   // "resources/{userId}/{resourceId}/{filename}"
  downloadURL: string   // Firebase Storage download URL
  mimeType: string
  userId: string
  createdAt: Timestamp
}
```

> **Not:** Task 10'da `types.ts` oluşturulduktan sonra bu interface tanımı kaldırılacak ve `import type { Resource } from './types'` kullanılacak (Task 12'de yapılır).

- [ ] **Step 3: `saveResource()` fonksiyonunu yeniden yaz**

Mevcut `saveResource` (satır 234-252) yerine:

```typescript
export const saveResource = async (
  file: { name: string; data: ArrayBuffer; mimeType: string },
  subject: string
): Promise<Resource> => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save resource")
  const uid = auth.currentUser.uid
  const resourcesRef = collection(db, 'resources')
  const docRef = doc(resourcesRef)
  const resourceId = docRef.id
  const path = `resources/${uid}/${resourceId}/${file.name}`
  const sRef = storageRef(storage, path)
  await uploadBytes(sRef, file.data, { contentType: file.mimeType })
  const downloadURL = await getDownloadURL(sRef)
  const metadata = {
    name: file.name,
    subject,
    storagePath: path,
    downloadURL,
    mimeType: file.mimeType,
    userId: uid,
    createdAt: serverTimestamp(),
  }
  await setDoc(docRef, metadata)
  return { id: resourceId, ...metadata, createdAt: Timestamp.now() }
}
```

Ayrıca `setDoc` import'unu `firebase/firestore` import bloğuna ekle.

- [ ] **Step 4: `deleteResource()` fonksiyonunu güncelle**

Mevcut `deleteResource` (satır 285-292) yerine:

```typescript
export const deleteResource = async (resource: Resource): Promise<void> => {
  // Storage dosyasını sil (başarısız olsa bile Firestore'u temizle)
  try {
    const sRef = storageRef(storage, resource.storagePath)
    await deleteObject(sRef)
  } catch (e) {
    console.warn('Storage delete failed, continuing with Firestore cleanup:', e)
  }
  const docRef = doc(db, 'resources', resource.id!)
  try {
    await deleteDoc(docRef)
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `resources/${resource.id}`)
  }
}
```

- [ ] **Step 5: `storage.rules` dosyası oluştur**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /resources/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 6: `firebase.json`'u güncelle**

Mevcut `firebase.json` içeriğini şununla değiştir:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 7: `firestore.rules`'da `resources` kuralını güncelle**

`isValidResource` fonksiyonunu şöyle değiştir (`data` kaldır, `storagePath`/`downloadURL` ekle):

```
function isValidResource(data) {
  return hasOnlyAllowedFields(['name', 'subject', 'storagePath', 'downloadURL', 'mimeType', 'userId', 'createdAt']) &&
         data.name is string && data.name.size() > 0 && data.name.size() < 200 &&
         data.subject is string && data.subject.size() > 0 &&
         data.storagePath is string && data.storagePath.size() > 0 &&
         data.downloadURL is string && data.downloadURL.size() > 0 &&
         data.mimeType is string &&
         data.userId == request.auth.uid &&
         data.createdAt is timestamp;
}
```

- [ ] **Step 8: lint — App.tsx hataları bekleniyor**

```bash
npm run lint
```

> **Not:** Bu adımdan sonra `src/App.tsx`'de `saveResource` ve `deleteResource` çağrılarında tip hataları görünecek. Bu **beklenen bir durumdur** — App.tsx Task 21'de tamamen yeniden yazılacak ve bu çağrılar da güncellenecek. Şu an `firebase.ts` ve `firestore.rules`/`firebase.json`/`storage.rules` değişikliklerini doğrulamak yeterli; App.tsx hatalarını bu aşamada düzeltme.

- [ ] **Step 9: Storage rules deploy**

```bash
firebase deploy --only storage --project igcse-tools
```
Beklenen: `Deploy complete!`

- [ ] **Step 10: Commit**

```bash
git add src/lib/firebase.ts storage.rules firebase.json firestore.rules
git commit -m "feat: migrate resource storage from Firestore base64 to Firebase Storage"
```

---

## Chunk 3: Faz 3 — Veri Modeli

---

### Task 10: `src/lib/types.ts` — shared TypeScript interfaces

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: `types.ts` dosyasını oluştur**

```typescript
import { Timestamp } from 'firebase/firestore'

export interface QuestionItem {
  id: string
  text: string           // markdown — soru metni
  answer: string         // markdown — cevap
  markScheme: string     // markdown — puan şeması
  marks: number
  commandWord: string    // "Calculate", "Explain", vs.
  type: 'mcq' | 'short_answer' | 'structured'
  hasDiagram: boolean
}

export interface Assessment {
  id: string
  subject: string
  topic: string
  difficulty: string
  questions: QuestionItem[]
  userId: string
  folderId?: string
  createdAt: Timestamp
}

export interface Question extends QuestionItem {
  assessmentId?: string
  subject: string
  topic: string
  difficulty: string
  userId: string
  folderId?: string
  createdAt: Timestamp
}

export interface Folder {
  id: string
  name: string
  userId: string
  createdAt: Timestamp
}

export interface Resource {
  id: string
  name: string
  subject: string
  storagePath: string
  downloadURL: string
  mimeType: string
  userId: string
  createdAt: Timestamp
}

export interface GenerationConfig {
  subject: string
  topic: string
  difficulty: string
  count: number
  type: string
  calculator: boolean
  model: string
  syllabusContext?: string
}

export interface AnalyzeFileResult {
  analysis: string
  questions: QuestionItem[]
}

export interface GeminiError {
  type: 'rate_limit' | 'model_overloaded' | 'invalid_response' | 'network' | 'unknown'
  retryable: boolean
  message: string
}

export interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  dismissAt: number
}
```

- [ ] **Step 2: lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript interfaces in types.ts"
```

---

### Task 11: `gemini.ts` — yeni veri modeline geçiş

**Files:**
- Modify: `src/lib/gemini.ts`

Bu task, `gemini.ts`'in `TestResponse` (düz string) formatından `QuestionItem[]` formatına tam geçişini yapar.

- [ ] **Step 1: `types.ts`'i import et, `TestResponse` tipini kaldır**

`gemini.ts` başına ekle:
```typescript
import type { QuestionItem, Assessment, AnalyzeFileResult, GenerationConfig } from './types'
```

Mevcut `TestResponse` ve `TestRequest` interface tanımlarını sil (57-61. satırlar). Bunun yerine `types.ts`'deki tipler kullanılacak.

- [ ] **Step 2: `generateTest()` imzasını ve response schema'sını güncelle**

`generateTest(config: TestRequest)` → yeni imza:

```typescript
export async function generateTest(
  config: GenerationConfig & { references?: { data: string; mimeType: string }[] },
  onRetry?: (attempt: number) => void
): Promise<QuestionItem[]>
```

`onRetry` parametresi `withRetry` çağrısına iletilir:
```typescript
const response = await withRetry(
  () => ai.models.generateContent({ ... }),
  3,
  onRetry
)
```

Response schema'yı güncelle:
```typescript
responseSchema: {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          answer: { type: Type.STRING },
          markScheme: { type: Type.STRING },
          marks: { type: Type.NUMBER },
          commandWord: { type: Type.STRING },
          type: { type: Type.STRING },
          hasDiagram: { type: Type.BOOLEAN },
        },
        required: ['text', 'answer', 'markScheme', 'marks', 'commandWord', 'type', 'hasDiagram'],
      },
    },
  },
  required: ['questions'],
},
```

Return tipi güncelle:
```typescript
const raw = safeJsonParse(response.text || '{}') as { questions: Omit<QuestionItem, 'id'>[] }
return (raw.questions ?? []).map(q => ({ ...q, id: crypto.randomUUID() }))
```

Prompt'u da güncelle — artık `questions`, `answerKey`, `markScheme` ayrı alanlar değil, her soru içinde `text`, `answer`, `markScheme` var:
```
Generate a Cambridge IGCSE ${config.subject} assessment.
Topic: ${config.topic}
Difficulty: ${config.difficulty}
Number of Questions: ${config.count}
Question Type: ${config.type}
Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}
${config.syllabusContext ? `Syllabus Context: ${config.syllabusContext}` : ""}

Rules:
1. Generate EXACTLY ${config.count} questions.
2. Each question must have: text (markdown, bold), answer, markScheme, marks (integer), commandWord, type (mcq/short_answer/structured), hasDiagram (boolean).
3. For diagrams, include SVG inside the 'text' field as \`\`\`svg ... \`\`\` using camelCase attributes.
4. Use LaTeX for math ($H_2O$, $x^2$).
5. For MCQ: put options A/B/C/D each on new line with double newlines between them.
6. Add **Syllabus Reference:** at end of each question text.
```

- [ ] **Step 3: `auditTest()` imzasını güncelle**

```typescript
export async function auditTest(
  subject: string,
  assessment: Assessment,
  model: string = 'gemini-3.1-pro-preview'
): Promise<QuestionItem[]>
```

Prompt'u güncelle — soruları serialize ederek gönder:
```typescript
const questionsText = assessment.questions
  .map((q, i) => `**Q${i + 1}** [${q.marks} marks] (${q.commandWord})\n${q.text}\n\nAnswer: ${q.answer}\n\nMark Scheme: ${q.markScheme}`)
  .join('\n\n---\n\n')
```

Response schema `generateTest` ile aynı (`questions` array).

Return:
```typescript
const raw = JSON.parse(response.text || '{}') as { questions: Omit<QuestionItem, 'id'>[] }
return (raw.questions ?? []).map((q, i) => ({
  ...q,
  id: assessment.questions[i]?.id ?? crypto.randomUUID(),
}))
```

- [ ] **Step 4: `getStudentFeedback()` imzasını güncelle**

```typescript
export async function getStudentFeedback(
  subject: string,
  assessment: Assessment,
  studentAnswers: string[],
  modelName: string = 'gemini-3-flash-preview'
): Promise<string>
```

Prompt'u güncelle — serialize:
```typescript
const questionsText = assessment.questions
  .map((q, i) => `**Q${i + 1}** [${q.marks} marks]\n${q.text}\n\nMark Scheme: ${q.markScheme}`)
  .join('\n\n')
const answersText = studentAnswers
  .map((a, i) => `Q${i + 1}: ${a || '(no answer)'}`)
  .join('\n')
```

- [ ] **Step 5: `analyzeFile()` return tipini güncelle**

```typescript
export async function analyzeFile(
  base64Data: string,
  mimeType: string,
  subject: string,
  count: number = 3,
  model: string = 'gemini-3-flash-preview',
  references?: { data: string; mimeType: string }[]
): Promise<AnalyzeFileResult>
```

Response schema:
```typescript
responseSchema: {
  type: Type.OBJECT,
  properties: {
    analysis: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          answer: { type: Type.STRING },
          markScheme: { type: Type.STRING },
          marks: { type: Type.NUMBER },
          commandWord: { type: Type.STRING },
          type: { type: Type.STRING },
          hasDiagram: { type: Type.BOOLEAN },
        },
        required: ['text', 'answer', 'markScheme', 'marks', 'commandWord', 'type', 'hasDiagram'],
      },
    },
  },
  required: ['analysis', 'questions'],
},
```

Return:
```typescript
const raw = safeJsonParse(response.text || '{}')
return {
  analysis: raw.analysis ?? '',
  questions: (raw.questions ?? []).map((q: any) => ({ ...q, id: crypto.randomUUID() })),
}
```

- [ ] **Step 6: lint**

```bash
npm run lint
```
TypeScript type hataları varsa düzelt.

- [ ] **Step 7: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: migrate gemini.ts to structural QuestionItem[] data model, remove flat TestResponse"
```

---

### Task 12: `firebase.ts` — yeni Assessment/Question tiplerine geçiş

**Files:**
- Modify: `src/lib/firebase.ts`

- [ ] **Step 1: Eski interface tanımlarını `types.ts` import'u ile değiştir**

`firebase.ts`'in başına ekle:
```typescript
import type { Assessment, Question, Folder, Resource } from './types'
```

Mevcut `SavedAssessment`, `Question`, `Folder`, `Resource` interface tanımlarını (satır 91-133) sil. Artık `types.ts`'den geliyor.

- [ ] **Step 2: `saveAssessment()` imzasını güncelle**

```typescript
export const saveAssessment = async (
  data: Omit<Assessment, 'id' | 'createdAt' | 'userId'>
): Promise<string> => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save")
  const assessmentsRef = collection(db, 'assessments')
  const payload: any = {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  }
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
  try {
    const docRef = await addDoc(assessmentsRef, payload)
    return docRef.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assessments')
    throw error
  }
}
```

- [ ] **Step 3: `getSavedAssessments()` güncelle — eski format filtresi ekle**

```typescript
export const getSavedAssessments = async (folderId?: string): Promise<Assessment[]> => {
  if (!auth.currentUser) return []
  // ... mevcut query kodu aynen ...
  try {
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as Assessment))
      // Eski format (questions: string) kayıtlarını filtrele
      .filter(a => Array.isArray(a.questions))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessments')
    return []
  }
}
```

- [ ] **Step 4: `updateAssessment()` imzasını ve gövdesini güncelle**

Mevcut `updateAssessment` (satır 305-312) yerine:
```typescript
export const updateAssessment = async (
  id: string,
  updates: Partial<Omit<Assessment, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, 'assessments', id)
  try {
    await updateDoc(docRef, updates as any)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessments/${id}`)
  }
}
```

- [ ] **Step 5: `saveQuestion()` imzasını güncelle**

```typescript
export const saveQuestion = async (
  data: Omit<Question, 'id' | 'createdAt' | 'userId'>
): Promise<string>
```

- [ ] **Step 6: `getQuestions()` güncelle — eski format filtresi ekle**

```typescript
return querySnapshot.docs
  .map(d => ({ id: d.id, ...d.data() } as Question))
  // Eski format (content: string) kayıtlarını filtrele
  .filter(q => typeof (q as any).text === 'string')
```

- [ ] **Step 7: `firestore.rules` güncelle — yeni schema**

`isValidAssessment` fonksiyonunu güncelle:
```
function isValidAssessment(data) {
  return hasOnlyAllowedFields(['subject', 'topic', 'difficulty', 'questions', 'userId', 'createdAt', 'folderId']) &&
         data.subject is string && data.subject.size() > 0 && data.subject.size() < 100 &&
         data.topic is string && data.topic.size() > 0 && data.topic.size() < 200 &&
         data.questions is list &&
         data.userId == request.auth.uid &&
         data.createdAt is timestamp &&
         (!('folderId' in data) || data.folderId == null || data.folderId is string) &&
         (!('difficulty' in data) || data.difficulty == null || data.difficulty is string);
}
```

`isValidQuestion` fonksiyonunu güncelle (`content` → `text`, `marks`/`commandWord`/`type`/`hasDiagram` ekle):
```
function isValidQuestion(data) {
  return hasOnlyAllowedFields(['subject', 'topic', 'difficulty', 'text', 'answer', 'markScheme', 'marks', 'commandWord', 'type', 'hasDiagram', 'userId', 'createdAt', 'assessmentId', 'folderId']) &&
         data.subject is string && data.subject.size() > 0 &&
         data.topic is string && data.topic.size() > 0 &&
         data.text is string && data.text.size() > 0 && data.text.size() < 10000 &&
         data.userId == request.auth.uid &&
         data.createdAt is timestamp &&
         (!('marks' in data) || data.marks == null || data.marks is number) &&
         (!('commandWord' in data) || data.commandWord == null || data.commandWord is string) &&
         (!('type' in data) || data.type == null || data.type is string) &&
         (!('hasDiagram' in data) || data.hasDiagram == null || data.hasDiagram is bool) &&
         (!('answer' in data) || data.answer == null || data.answer is string) &&
         (!('markScheme' in data) || data.markScheme == null || data.markScheme is string) &&
         (!('assessmentId' in data) || data.assessmentId == null || data.assessmentId is string) &&
         (!('folderId' in data) || data.folderId == null || data.folderId is string);
}
```

- [ ] **Step 8: lint**

```bash
npm run lint
```

- [ ] **Step 9: Firestore rules deploy**

```bash
firebase deploy --only firestore:rules --project igcse-tools
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/firebase.ts firestore.rules
git commit -m "feat: migrate firebase.ts to structural Assessment/Question data model"
```

---

## Chunk 4: Faz 4 — App.tsx Refactoring

---

### Task 13: `useNotifications` hook

**Files:**
- Create: `src/hooks/useNotifications.ts`

- [ ] **Step 1: `src/hooks/` dizini oluştur**

```bash
mkdir -p "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/src/hooks"
```

- [ ] **Step 2: `useNotifications.ts` implementasyonu**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { Notification } from '../lib/types'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(n => n.filter(x => x.dismissAt > Date.now()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const notify = useCallback((message: string, type: Notification['type'] = 'info', durationMs = 5000) => {
    const id = crypto.randomUUID()
    setNotifications(n => [...n, { id, message, type, dismissAt: Date.now() + durationMs }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(n => n.filter(x => x.id !== id))
  }, [])

  return { notifications, notify, dismiss }
}

export type NotifyFn = ReturnType<typeof useNotifications>['notify']
```

- [ ] **Step 3: lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNotifications.ts
git commit -m "feat: add useNotifications hook with auto-dismiss and ID-based deduplication"
```

---

### Task 14: `useAssessments` hook

**Files:**
- Create: `src/hooks/useAssessments.ts`

- [ ] **Step 1: `useAssessments.ts` implementasyonu**

```typescript
import { useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { Assessment, Question, Folder } from '../lib/types'
import type { NotifyFn } from './useNotifications'
import {
  saveAssessment as fbSave,
  getSavedAssessments,
  deleteAssessment as fbDelete,
  updateAssessment as fbUpdate,
  moveAssessment as fbMove,
  saveQuestion as fbSaveQ,
  getQuestions,
  deleteQuestion as fbDeleteQ,
  moveQuestion as fbMoveQ,
  createFolder as fbCreateFolder,
  getFolders,
  deleteFolder as fbDeleteFolder,
} from '../lib/firebase'

export function useAssessments(user: User | null, notify: NotifyFn) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async (folderId?: string) => {
    if (!user) return
    setLoading(true)
    setAssessments([])
    setQuestions([])
    try {
      const [a, q, f] = await Promise.all([
        getSavedAssessments(folderId),
        getQuestions(folderId),
        getFolders(),
      ])
      setAssessments(a)
      setQuestions(q)
      setFolders(f)
    } catch (e) {
      notify('Failed to load library', 'error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user, notify])

  const saveAssessment = useCallback(async (assessment: Assessment): Promise<string | null> => {
    try {
      const { id, createdAt, userId, ...data } = assessment
      const newId = await fbSave(data)
      notify('Assessment saved to library', 'success')
      return newId
    } catch (e) {
      notify('Failed to save assessment', 'error')
      console.error(e)
      return null
    }
  }, [notify])

  const saveQuestions = useCallback(async (
    qs: Question[]
  ): Promise<void> => {
    try {
      await Promise.all(qs.map(q => {
        const { id, createdAt, userId, ...data } = q
        return fbSaveQ(data)
      }))
    } catch (e) {
      console.error('Failed to save questions:', e)
    }
  }, [])

  const deleteAssessment = useCallback(async (id: string) => {
    try {
      await fbDelete(id)
      setAssessments(a => a.filter(x => x.id !== id))
      notify('Assessment deleted', 'info')
    } catch (e) {
      notify('Failed to delete assessment', 'error')
    }
  }, [notify])

  const updateAssessment = useCallback(async (
    id: string,
    data: Partial<Omit<Assessment, 'id' | 'userId' | 'createdAt'>>
  ) => {
    try {
      await fbUpdate(id, data)
      setAssessments(a => a.map(x => x.id === id ? { ...x, ...data } : x))
    } catch (e) {
      notify('Failed to update assessment', 'error')
    }
  }, [notify])

  const moveAssessment = useCallback(async (id: string, folderId: string | null) => {
    try {
      await fbMove(id, folderId)
      setAssessments(a => a.map(x => x.id === id ? { ...x, folderId: folderId ?? undefined } : x))
    } catch (e) {
      notify('Failed to move assessment', 'error')
    }
  }, [notify])

  const deleteQuestion = useCallback(async (id: string) => {
    try {
      await fbDeleteQ(id)
      setQuestions(q => q.filter(x => x.id !== id))
    } catch (e) {
      notify('Failed to delete question', 'error')
    }
  }, [notify])

  const moveQuestion = useCallback(async (id: string, folderId: string | null) => {
    try {
      await fbMoveQ(id, folderId)
      setQuestions(q => q.map(x => x.id === id ? { ...x, folderId: folderId ?? undefined } : x))
    } catch (e) {
      notify('Failed to move question', 'error')
    }
  }, [notify])

  const createFolder = useCallback(async (name: string) => {
    try {
      await fbCreateFolder(name)
      await loadAll()
      notify(`Folder "${name}" created`, 'success')
    } catch (e) {
      notify('Failed to create folder', 'error')
    }
  }, [loadAll, notify])

  const deleteFolder = useCallback(async (id: string) => {
    try {
      await fbDeleteFolder(id)
      setFolders(f => f.filter(x => x.id !== id))
      notify('Folder deleted', 'info')
    } catch (e) {
      notify('Failed to delete folder', 'error')
    }
  }, [notify])

  return {
    assessments, questions, folders, loading,
    loadAll, saveAssessment, saveQuestions,
    deleteAssessment, updateAssessment, moveAssessment,
    deleteQuestion, moveQuestion,
    createFolder, deleteFolder,
  }
}
```

- [ ] **Step 2: lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAssessments.ts
git commit -m "feat: add useAssessments hook encapsulating all Firestore CRUD operations"
```

---

### Task 15: `useResources` hook

**Files:**
- Create: `src/hooks/useResources.ts`

- [ ] **Step 1: `useResources.ts` implementasyonu**

```typescript
import { useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { Resource } from '../lib/types'
import type { NotifyFn } from './useNotifications'
import { saveResource, getResources, deleteResource as fbDelete } from '../lib/firebase'

export function useResources(user: User | null, notify: NotifyFn) {
  const [resources, setResources] = useState<Resource[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<Resource[]>([])
  const [uploading, setUploading] = useState(false)

  const loadResources = useCallback(async (subject?: string) => {
    if (!user) return
    try {
      const data = await getResources(subject)
      setResources(data)
    } catch (e) {
      notify('Failed to load resources', 'error')
    }
  }, [user, notify])

  const uploadResource = useCallback(async (
    file: File,
    subject: string
  ): Promise<Resource | null> => {
    if (!user) { notify('Login required to save resources', 'error'); return null }
    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const resource = await saveResource(
        { name: file.name, data: arrayBuffer, mimeType: file.type },
        subject
      )
      setResources(r => [resource, ...r])
      notify(`"${file.name}" saved to resources`, 'success')
      return resource
    } catch (e) {
      notify('Failed to upload resource', 'error')
      return null
    } finally {
      setUploading(false)
    }
  }, [user, notify])

  const deleteResource = useCallback(async (resource: Resource) => {
    try {
      await fbDelete(resource)
      setResources(r => r.filter(x => x.id !== resource.id))
      setKnowledgeBase(kb => kb.filter(x => x.id !== resource.id))
      notify(`"${resource.name}" deleted`, 'info')
    } catch (e) {
      notify('Failed to delete resource', 'error')
    }
  }, [notify])

  const addToKnowledgeBase = useCallback((resource: Resource) => {
    setKnowledgeBase(kb => {
      if (kb.find(x => x.id === resource.id)) return kb
      return [...kb, resource]
    })
  }, [])

  const removeFromKnowledgeBase = useCallback((id: string) => {
    setKnowledgeBase(kb => kb.filter(x => x.id !== id))
  }, [])

  const getBase64 = useCallback(async (resource: Resource): Promise<string> => {
    const response = await fetch(resource.downloadURL)
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return btoa(binary)
  }, [])

  return {
    resources, knowledgeBase, uploading,
    loadResources, uploadResource, deleteResource,
    addToKnowledgeBase, removeFromKnowledgeBase, getBase64,
  }
}
```

- [ ] **Step 2: lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useResources.ts
git commit -m "feat: add useResources hook with Firebase Storage upload/download"
```

---

### Task 16: `useGeneration` hook

**Files:**
- Create: `src/hooks/useGeneration.ts`

- [ ] **Step 1: `useGeneration.ts` implementasyonu**

```typescript
import { useState, useCallback } from 'react'
import type { Assessment, QuestionItem, AnalyzeFileResult, GenerationConfig, GeminiError } from '../lib/types'
import type { Resource } from '../lib/types'
import type { NotifyFn } from './useNotifications'
import { generateTest, auditTest, getStudentFeedback as fbFeedback, analyzeFile as fbAnalyze } from '../lib/gemini'
import { Timestamp } from 'firebase/firestore'
import { auth } from '../lib/firebase'

export function useGeneration(notify: NotifyFn) {
  const [generatedAssessment, setGeneratedAssessment] = useState<Assessment | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAuditing, setIsAuditing] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<GeminiError | null>(null)

  const generate = useCallback(async (
    config: GenerationConfig,
    knowledgeBaseResources: Resource[],
    getBase64: (r: Resource) => Promise<string>
  ) => {
    setIsGenerating(true)
    setRetryCount(0)
    setError(null)
    try {
      const references = await Promise.all(
        knowledgeBaseResources.map(async r => ({
          data: await getBase64(r),
          mimeType: r.mimeType,
        }))
      )
      const questions = await generateTest({ ...config, references }, (attempt) => {
        setRetryCount(attempt)
        notify(`Rate limit, retrying (${attempt}/3)...`, 'info')
      })
      setIsAuditing(true)
      notify('Auditing assessment quality...', 'info')
      const draft: Assessment = {
        id: crypto.randomUUID(),
        subject: config.subject,
        topic: config.topic,
        difficulty: config.difficulty,
        questions,
        userId: auth.currentUser?.uid ?? '',
        createdAt: Timestamp.now(),
      }
      const auditedQuestions = await auditTest(config.subject, draft, config.model)
      setGeneratedAssessment({ ...draft, questions: auditedQuestions })
      notify('Assessment generated successfully!', 'success')
    } catch (e: any) {
      const ge = e as GeminiError
      const msg = ge.message ?? 'Failed to generate assessment'
      setError(ge)
      notify(msg, 'error')
    } finally {
      setIsGenerating(false)
      setIsAuditing(false)
    }
  }, [notify])

  const analyzeFile = useCallback(async (
    file: { base64: string; mimeType: string },
    subject: string,
    model: string,
    knowledgeBaseResources: Resource[],
    getBase64: (r: Resource) => Promise<string>
  ) => {
    setIsGenerating(true)
    setError(null)
    try {
      const references = await Promise.all(
        knowledgeBaseResources.map(async r => ({
          data: await getBase64(r),
          mimeType: r.mimeType,
        }))
      )
      const result: AnalyzeFileResult = await fbAnalyze(
        file.base64,
        file.mimeType,
        subject,
        3,
        model,
        references
      )
      setAnalysisText(result.analysis)
      setGeneratedAssessment({
        id: crypto.randomUUID(),
        subject,
        topic: 'Analyzed Content',
        difficulty: 'N/A',
        questions: result.questions,
        userId: auth.currentUser?.uid ?? '',
        createdAt: Timestamp.now(),
      })
      notify('File analyzed successfully!', 'success')
    } catch (e: any) {
      notify((e as GeminiError).message ?? 'Failed to analyze file', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [notify])

  const getStudentFeedback = useCallback(async (
    studentAnswers: string[],
    model: string
  ) => {
    if (!generatedAssessment) return
    try {
      const fb = await fbFeedback(
        generatedAssessment.subject,
        generatedAssessment,
        studentAnswers,
        model
      )
      notify('Feedback ready', 'success')
      return fb
    } catch (e) {
      notify('Failed to get feedback', 'error')
      return null
    }
  }, [generatedAssessment, notify])

  return {
    generatedAssessment,
    setGeneratedAssessment,
    analysisText,
    isGenerating,
    isAuditing,
    retryCount,
    error,
    generate,
    analyzeFile,
    getStudentFeedback,
  }
}
```

- [ ] **Step 2: lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGeneration.ts
git commit -m "feat: add useGeneration hook with Gemini generate/audit/analyze/feedback"
```

---

### Task 17: `Notifications` component

**Files:**
- Create: `src/components/Notifications/index.tsx`

- [ ] **Step 1: Dizin oluştur**

```bash
mkdir -p "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/src/components/Notifications"
```

- [ ] **Step 2: Implementasyon**

```tsx
import React from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import type { Notification } from '../../lib/types'

interface Props {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
}

const BG = {
  success: 'bg-emerald-50 border-emerald-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-stone-50 border-stone-200',
}

export function Notifications({ notifications, onDismiss }: Props) {
  if (notifications.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map(n => (
        <div key={n.id} className={`flex items-start gap-2 p-3 rounded-lg border shadow-sm ${BG[n.type]}`}>
          {ICONS[n.type]}
          <span className="flex-1 text-sm text-stone-700">{n.message}</span>
          <button onClick={() => onDismiss(n.id)} className="text-stone-400 hover:text-stone-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Notifications/index.tsx
git commit -m "feat: add Notifications component for toast display"
```

---

### Task 18: `Library` component

**Files:**
- Create: `src/components/Library/index.tsx`

- [ ] **Step 1: Dizin oluştur**

```bash
mkdir -p "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/src/components/Library"
```

- [ ] **Step 2: Implementasyon**

`Library` bileşeni mevcut App.tsx'teki "showBank" view bölümünü içerir. Mevcut `App.tsx`'i oku (satır 800-1200 arası, bankView kısmı) ve mantığı bu component'e taşı.

```tsx
import React, { useState } from 'react'
import { Folder as FolderIcon, Trash2, FolderInput, Plus, BookOpen, Library as LibraryIcon, Pencil, X, Check } from 'lucide-react'
import type { Assessment, Question, Folder } from '../../lib/types'

interface Props {
  assessments: Assessment[]
  questions: Question[]
  folders: Folder[]
  loading: boolean
  onSelect: (assessment: Assessment) => void
  onDeleteAssessment: (id: string) => void
  onMoveAssessment: (id: string, folderId: string | null) => void
  onRenameAssessment: (id: string, topic: string) => void
  onDeleteQuestion: (id: string) => void
  onMoveQuestion: (id: string, folderId: string | null) => void
  onCreateFolder: (name: string) => void
  onDeleteFolder: (id: string) => void
  selectedFolderId: string | null | undefined
  onSelectFolder: (id: string | null | undefined) => void
}

export function Library({
  assessments, questions, folders, loading,
  onSelect, onDeleteAssessment, onMoveAssessment, onRenameAssessment,
  onDeleteQuestion, onMoveQuestion,
  onCreateFolder, onDeleteFolder,
  selectedFolderId, onSelectFolder,
}: Props) {
  const [bankView, setBankView] = useState<'assessments' | 'questions'>('assessments')
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Component body: port existing bank UI from App.tsx lines ~800-1200
  // Key sections: folder sidebar, assessment grid, question list
  // Tip: Arama, folder filter, rename inline editing

  return (
    <div className="flex h-full">
      {/* Folder Sidebar */}
      <div className="w-56 border-r border-stone-200 p-3 flex flex-col gap-2">
        <div className="flex gap-1">
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="New folder..."
            className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded"
            onKeyDown={e => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                onCreateFolder(newFolderName.trim())
                setNewFolderName('')
              }
            }}
          />
          <button
            onClick={() => { if (newFolderName.trim()) { onCreateFolder(newFolderName.trim()); setNewFolderName('') } }}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => onSelectFolder(undefined)}
          className={`text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 ${selectedFolderId === undefined ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
        >
          <LibraryIcon className="w-3.5 h-3.5" /> All
        </button>
        {folders.map(f => (
          <div key={f.id} className="flex items-center gap-1 group">
            <button
              onClick={() => onSelectFolder(f.id)}
              className={`flex-1 text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 ${selectedFolderId === f.id ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              <FolderIcon className="w-3.5 h-3.5" /> {f.name}
            </button>
            <button
              onClick={() => onDeleteFolder(f.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setBankView('assessments')}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'assessments' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Assessments ({assessments.length})
          </button>
          <button
            onClick={() => setBankView('questions')}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'questions' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Questions ({questions.length})
          </button>
        </div>

        {loading && <div className="text-stone-400 text-sm">Loading...</div>}

        {bankView === 'assessments' && (
          <div className="grid grid-cols-1 gap-3">
            {assessments.map(a => (
              <div key={a.id} className="border border-stone-200 rounded-lg p-3 hover:border-emerald-300 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renamingId === a.id ? (
                      <div className="flex gap-1">
                        <input
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          className="flex-1 text-sm px-1 border border-emerald-400 rounded"
                          autoFocus
                        />
                        <button onClick={() => { onRenameAssessment(a.id, renameValue); setRenamingId(null) }} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setRenamingId(null)} className="text-stone-400"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => onSelect(a)} className="text-left">
                        <div className="text-sm font-medium text-stone-800">{a.topic}</div>
                        <div className="text-xs text-stone-500">{a.subject} · {a.difficulty} · {a.questions.length}q</div>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setRenamingId(a.id); setRenameValue(a.topic) }} className="p-1 text-stone-400 hover:text-stone-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <select
                      value={a.folderId ?? ''}
                      onChange={e => onMoveAssessment(a.id, e.target.value || null)}
                      className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                    >
                      <option value="">No folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button onClick={() => onDeleteAssessment(a.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            {assessments.length === 0 && !loading && (
              <div className="text-stone-400 text-sm text-center py-8">No assessments saved yet.</div>
            )}
          </div>
        )}

        {bankView === 'questions' && (
          <div className="grid grid-cols-1 gap-2">
            {questions.map(q => (
              <div key={q.id} className="border border-stone-200 rounded p-2 bg-white flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-stone-700 truncate">{q.text.replace(/\*\*/g, '').substring(0, 120)}...</div>
                  <div className="text-xs text-stone-400">{q.subject} · {q.marks}m · {q.commandWord}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={q.folderId ?? ''}
                    onChange={e => onMoveQuestion(q.id, e.target.value || null)}
                    className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                  >
                    <option value="">No folder</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button onClick={() => onDeleteQuestion(q.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {questions.length === 0 && !loading && (
              <div className="text-stone-400 text-sm text-center py-8">No questions saved yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Library/index.tsx
git commit -m "feat: add Library component for question bank browsing"
```

---

### Task 19: `AssessmentView` component

**Files:**
- Create: `src/components/AssessmentView/index.tsx`

- [ ] **Step 1: Dizin oluştur**

```bash
mkdir -p "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/src/components/AssessmentView"
```

- [ ] **Step 2: PDF export helper — `src/lib/pdf.ts`**

```typescript
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function injectPrintStyles(): HTMLStyleElement {
  const style = document.createElement('style')
  style.id = 'pdf-export-override'
  style.textContent = `
    :root {
      --color-emerald-50: #ecfdf5 !important;
      --color-emerald-100: #d1fae5 !important;
      --color-emerald-200: #a7f3d0 !important;
      --color-emerald-500: #10b981 !important;
      --color-emerald-600: #059669 !important;
      --color-emerald-700: #047857 !important;
      --color-emerald-800: #065f46 !important;
      --color-stone-50: #fafaf9 !important;
      --color-stone-100: #f5f5f4 !important;
      --color-stone-200: #e7e5e4 !important;
      --color-stone-300: #d6d3d1 !important;
      --color-stone-600: #57534e !important;
      --color-stone-700: #44403c !important;
      --color-stone-800: #292524 !important;
    }
  `
  document.head.appendChild(style)
  return style
}

export async function exportToPDF(element: HTMLElement, filename: string): Promise<void> {
  const styleTag = injectPrintStyles()
  try {
    const canvas = await html2canvas(element, { useCORS: true, scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width
    let heightLeft = imgH
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
      heightLeft -= pageH
    }
    pdf.save(filename)
  } finally {
    styleTag.remove()
  }
}
```

- [ ] **Step 3: `AssessmentView/index.tsx` implementasyonu**

Bu component, App.tsx'deki mevcut assessment display bölümünü (yaklaşık satır 1200-1600) kapsar. Temel yapı:

```tsx
import React, { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { Download, Copy, Save, Edit3, Eye, EyeOff, Check } from 'lucide-react'
import type { Assessment } from '../../lib/types'
import { copyToClipboard } from '../../lib/clipboard'
import { parseSVGSafe } from '../../lib/svg'
import { exportToPDF } from '../../lib/pdf'

interface Props {
  assessment: Assessment | null
  analysisText?: string | null
  isEditing: boolean
  studentMode: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onDownloadPDF: () => void
  onStudentFeedback?: (answers: string[]) => Promise<string | null | undefined>
  onCopy: (text: string) => void
  activeTab: 'questions' | 'answerKey' | 'markScheme'
  onTabChange: (tab: 'questions' | 'answerKey' | 'markScheme') => void
}

// Markdown renderer for question text with safe SVG support
function QuestionMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        code({ className, children }) {
          if (className === 'language-svg') {
            const svgStr = String(children)
            const safe = parseSVGSafe(svgStr)
            if (safe) return <div dangerouslySetInnerHTML={{ __html: safe }} className="my-2" />
            return <span className="text-stone-400 text-xs italic">[Diagram unavailable]</span>
          }
          return <code className={className}>{children}</code>
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function AssessmentView({
  assessment, analysisText, isEditing, studentMode,
  onEdit, onCancelEdit, onSave, onStudentFeedback, onCopy,
  activeTab, onTabChange,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [studentAnswers, setStudentAnswers] = useState<string[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  if (!assessment) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400">
        <div className="text-center">
          <p className="text-lg font-medium">No assessment generated yet</p>
          <p className="text-sm">Configure and generate an assessment using the sidebar</p>
        </div>
      </div>
    )
  }

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return
    const filename = `${assessment.subject}-${assessment.topic}-assessment.pdf`
      .replace(/\s+/g, '-').toLowerCase()
    await exportToPDF(contentRef.current, filename)
  }

  const questionsText = assessment.questions
    .map((q, i) => `### Question ${i + 1} [${q.marks} marks]\n\n${q.text}`)
    .join('\n\n---\n\n')
  const answerKeyText = assessment.questions
    .map((q, i) => `### Q${i + 1}\n\n${q.answer}`)
    .join('\n\n')
  const markSchemeText = assessment.questions
    .map((q, i) => `### Q${i + 1} Mark Scheme [${q.marks} marks]\n\n${q.markScheme}`)
    .join('\n\n')

  const currentText = activeTab === 'questions' ? questionsText
    : activeTab === 'answerKey' ? answerKeyText
    : markSchemeText

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-stone-200 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['questions', 'answerKey', 'markScheme'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${activeTab === tab ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {tab === 'questions' ? 'Questions' : tab === 'answerKey' ? 'Answer Key' : 'Mark Scheme'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onCopy(currentText)} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded" title="Copy">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={handleDownloadPDF} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded" title="Download PDF">
            <Download className="w-4 h-4" />
          </button>
          {isEditing ? (
            <>
              <button onClick={onSave} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-1">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={onCancelEdit} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={onEdit} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded" title="Edit">
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 markdown-body" ref={contentRef}>
        {analysisText && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>Analysis:</strong> {analysisText}
          </div>
        )}

        {isEditing ? (
          <textarea
            value={editContent || currentText}
            onChange={e => setEditContent(e.target.value)}
            className="w-full h-full min-h-[400px] font-mono text-sm p-3 border border-stone-300 rounded-lg"
          />
        ) : (
          <div>
            {activeTab === 'questions' && assessment.questions.map((q, i) => (
              <div key={q.id} className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    Q{i + 1} · {q.marks}m · {q.commandWord}
                  </span>
                  <span className="text-xs text-stone-400">{q.type}</span>
                </div>
                <QuestionMarkdown content={q.text} />
                {studentMode && (
                  <textarea
                    placeholder="Your answer..."
                    value={studentAnswers[i] ?? ''}
                    onChange={e => {
                      const next = [...studentAnswers]
                      next[i] = e.target.value
                      setStudentAnswers(next)
                    }}
                    className="w-full mt-2 p-2 border border-stone-300 rounded text-sm"
                    rows={3}
                  />
                )}
              </div>
            ))}

            {!studentMode && activeTab === 'answerKey' && (
              <QuestionMarkdown content={answerKeyText} />
            )}

            {!studentMode && activeTab === 'markScheme' && (
              <QuestionMarkdown content={markSchemeText} />
            )}

            {studentMode && activeTab !== 'questions' && (
              <div className="text-stone-400 text-sm italic">
                Answer key and mark scheme hidden in student mode.
              </div>
            )}
          </div>
        )}

        {studentMode && onStudentFeedback && (
          <div className="mt-4">
            <button
              onClick={async () => {
                const fb = await onStudentFeedback(studentAnswers)
                if (fb) setFeedback(fb)
              }}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium"
            >
              Get Feedback
            </button>
            {feedback && (
              <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                <QuestionMarkdown content={feedback} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AssessmentView/index.tsx src/lib/pdf.ts
git commit -m "feat: add AssessmentView component and PDF export with style-inject approach"
```

---

### Task 20: `Sidebar` component

**Files:**
- Create: `src/components/Sidebar/index.tsx`

- [ ] **Step 1: Dizin oluştur**

```bash
mkdir -p "c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/src/components/Sidebar"
```

- [ ] **Step 2: Implementasyon**

```tsx
import React, { useRef } from 'react'
import { BrainCircuit, Calculator, BookOpen, Loader2, Database, Trash2, Plus } from 'lucide-react'
import type { GenerationConfig, Resource } from '../../lib/types'
import { IGCSE_SUBJECTS, IGCSE_TOPICS, DIFFICULTY_LEVELS } from '../../lib/gemini'
import { estimateCostIDR, MODEL_PRICING } from '../../lib/pricing'

const QUESTION_TYPES = ['Mixed', 'Multiple Choice', 'Short Answer', 'Structured']
const MODELS = Object.keys(MODEL_PRICING)

interface Props {
  config: GenerationConfig
  onConfigChange: (patch: Partial<GenerationConfig>) => void
  onGenerate: () => void
  isGenerating: boolean
  isAuditing: boolean
  retryCount: number
  resources: Resource[]
  knowledgeBase: Resource[]
  onUploadResource: (file: File, subject: string) => void
  onAddToKB: (resource: Resource) => void
  onRemoveFromKB: (id: string) => void
  onDeleteResource: (resource: Resource) => void
  studentMode: boolean
  onStudentModeToggle: () => void
  syllabusContext: string
  onSyllabusContextChange: (v: string) => void
}

export function Sidebar({
  config, onConfigChange, onGenerate, isGenerating, isAuditing, retryCount,
  resources, knowledgeBase, onUploadResource, onAddToKB, onRemoveFromKB, onDeleteResource,
  studentMode, onStudentModeToggle, syllabusContext, onSyllabusContextChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inputTokens = Math.round(1500 + (syllabusContext.length / 4))
  const outputTokens = config.count * 600
  const costIDR = estimateCostIDR(config.model, inputTokens, outputTokens)

  return (
    <div className="w-80 border-r border-stone-200 bg-stone-50 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-stone-200">
        <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-emerald-600" />
          Assessment Designer
        </h2>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Subject */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
          <select
            value={config.subject}
            onChange={e => onConfigChange({ subject: e.target.value, topic: IGCSE_TOPICS[e.target.value][0] })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Topic</label>
          <select
            value={config.topic}
            onChange={e => onConfigChange({ topic: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {(IGCSE_TOPICS[config.subject] ?? []).map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Difficulty</label>
          <select
            value={config.difficulty}
            onChange={e => onConfigChange({ difficulty: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {DIFFICULTY_LEVELS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Count */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">
            Questions: {config.count}
          </label>
          <input
            type="range" min={1} max={20} value={config.count}
            onChange={e => onConfigChange({ count: Number(e.target.value) })}
            className="w-full accent-emerald-600"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Question Type</label>
          <select
            value={config.type}
            onChange={e => onConfigChange({ type: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {QUESTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">AI Model</label>
          <select
            value={config.model}
            onChange={e => onConfigChange({ model: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {MODELS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Calculator */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="calc" checked={config.calculator}
            onChange={e => onConfigChange({ calculator: e.target.checked })}
            className="accent-emerald-600"
          />
          <label htmlFor="calc" className="text-xs text-stone-600 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Calculator Allowed
          </label>
        </div>

        {/* Syllabus context */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Syllabus Context (optional)</label>
          <textarea
            value={syllabusContext}
            onChange={e => onSyllabusContextChange(e.target.value)}
            placeholder="Paste specific learning objectives..."
            rows={3}
            className="w-full text-xs border border-stone-300 rounded-lg px-2 py-1.5 resize-none"
          />
        </div>

        {/* Cost estimate */}
        <div className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-1.5">
          Estimated cost: ~Rp {costIDR.toLocaleString('id-ID')}
        </div>

        {/* Student mode */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="student" checked={studentMode} onChange={onStudentModeToggle} className="accent-emerald-600" />
          <label htmlFor="student" className="text-xs text-stone-600">Student Mode (hide answers)</label>
        </div>

        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isAuditing ? 'Auditing...' : retryCount > 0 ? `Retry ${retryCount}/3...` : 'Generating...'}
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" />
              Generate Assessment
            </>
          )}
        </button>

        {/* Knowledge Base */}
        <div className="border-t border-stone-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Knowledge Base
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onUploadResource(file, config.subject)
                e.target.value = ''
              }}
            />
          </div>
          {resources.length === 0 && (
            <div className="text-xs text-stone-400 italic">No resources uploaded</div>
          )}
          {resources.map(r => {
            const inKB = knowledgeBase.some(x => x.id === r.id)
            return (
              <div key={r.id} className="flex items-center gap-1 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={inKB}
                  onChange={() => inKB ? onRemoveFromKB(r.id) : onAddToKB(r)}
                  className="accent-emerald-600"
                />
                <span className="flex-1 truncate text-stone-700">{r.name}</span>
                <button onClick={() => onDeleteResource(r)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/index.tsx
git commit -m "feat: add Sidebar component with config, cost estimate, and knowledge base"
```

---

### Task 21: `App.tsx` yeniden yaz

**Files:**
- Modify: `src/App.tsx` (tam yeniden yazım)

Bu task, tüm önceki hook ve component'leri bir araya getirir. Mevcut `App.tsx`'i oku, sonra yenisiyle değiştir.

- [ ] **Step 1: Mevcut `App.tsx`'i yedekle**

```bash
cp src/App.tsx src/App.tsx.bak
```

- [ ] **Step 2: Yeni `App.tsx`'i yaz**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { BookOpen, LogIn, LogOut, Library } from 'lucide-react'
import { auth, signInWithGoogle, logout } from './lib/firebase'
import { IGCSE_TOPICS } from './lib/gemini'
import type { GenerationConfig } from './lib/types'
import { useNotifications } from './hooks/useNotifications'
import { useAssessments } from './hooks/useAssessments'
import { useGeneration } from './hooks/useGeneration'
import { useResources } from './hooks/useResources'
import { Sidebar } from './components/Sidebar'
import { AssessmentView } from './components/AssessmentView'
import { Library as LibraryView } from './components/Library'
import { Notifications } from './components/Notifications'
import { copyToClipboard } from './lib/clipboard'

const DEFAULT_CONFIG: GenerationConfig = {
  subject: 'Mathematics',
  topic: 'Mixed Topics',
  difficulty: 'Balanced',
  count: 10,
  type: 'Mixed',
  calculator: true,
  model: 'gemini-3-flash-preview',
  syllabusContext: '',
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<'main' | 'library'>('main')
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG)
  const [syllabusContext, setSyllabusContext] = useState('')
  const [studentMode, setStudentMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'questions' | 'answerKey' | 'markScheme'>('questions')
  const [isEditing, setIsEditing] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined)

  const { notifications, notify, dismiss } = useNotifications()
  const library = useAssessments(user, notify)
  const generation = useGeneration(notify)
  const resources = useResources(user, notify)

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u)
      if (u) {
        library.loadAll()
        resources.loadResources(config.subject)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) resources.loadResources(config.subject)
  }, [config.subject, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && view === 'library') library.loadAll(selectedFolderId ?? undefined)
  }, [view, selectedFolderId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(() => {
    generation.generate({ ...config, syllabusContext }, resources.knowledgeBase, resources.getBase64)
  }, [config, syllabusContext, resources.knowledgeBase, resources.getBase64, generation])

  const handleSave = useCallback(async () => {
    if (!generation.generatedAssessment) return
    await library.saveAssessment(generation.generatedAssessment)
  }, [generation.generatedAssessment, library])

  const handleCopy = useCallback(async (text: string) => {
    const ok = await copyToClipboard(text)
    notify(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error')
  }, [notify])

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-800 mb-2">IGCSE Tools</h1>
          <p className="text-stone-500 mb-6">Cambridge IGCSE Assessment Designer</p>
          <button
            onClick={signInWithGoogle}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto"
          >
            <LogIn className="w-4 h-4" /> Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        config={config}
        onConfigChange={patch => setConfig(c => ({ ...c, ...patch, topic: patch.subject ? IGCSE_TOPICS[patch.subject][0] : (patch.topic ?? c.topic) }))}
        onGenerate={handleGenerate}
        isGenerating={generation.isGenerating}
        isAuditing={generation.isAuditing}
        retryCount={generation.retryCount}
        resources={resources.resources}
        knowledgeBase={resources.knowledgeBase}
        onUploadResource={resources.uploadResource}
        onAddToKB={resources.addToKnowledgeBase}
        onRemoveFromKB={resources.removeFromKnowledgeBase}
        onDeleteResource={resources.deleteResource}
        studentMode={studentMode}
        onStudentModeToggle={() => setStudentMode(s => !s)}
        syllabusContext={syllabusContext}
        onSyllabusContextChange={setSyllabusContext}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="border-b border-stone-200 px-4 py-2 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            IGCSE Tools
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(v => v === 'library' ? 'main' : 'library')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium ${view === 'library' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <Library className="w-3.5 h-3.5" />
              Library
            </button>
            <span className="text-xs text-stone-500">{user.displayName}</span>
            <button onClick={logout} className="p-1.5 text-stone-400 hover:text-stone-600" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main content */}
        {view === 'library' ? (
          <LibraryView
            assessments={library.assessments}
            questions={library.questions}
            folders={library.folders}
            loading={library.loading}
            onSelect={a => { generation.setGeneratedAssessment(a); setView('main') }}
            onDeleteAssessment={library.deleteAssessment}
            onMoveAssessment={library.moveAssessment}
            onRenameAssessment={(id, topic) => library.updateAssessment(id, { topic })}
            onDeleteQuestion={library.deleteQuestion}
            onMoveQuestion={library.moveQuestion}
            onCreateFolder={library.createFolder}
            onDeleteFolder={library.deleteFolder}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
          />
        ) : (
          <AssessmentView
            assessment={generation.generatedAssessment}
            analysisText={generation.analysisText}
            isEditing={isEditing}
            studentMode={studentMode}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSave={handleSave}
            onStudentFeedback={(answers) => generation.getStudentFeedback(answers, config.model)}
            onCopy={handleCopy}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </div>

      <Notifications notifications={notifications} onDismiss={dismiss} />
    </div>
  )
}
```

- [ ] **Step 3: `.bak` dosyasını sil**

```bash
rm src/App.tsx.bak
```

- [ ] **Step 4: lint — tüm type hatalarını düzelt**

```bash
npm run lint
```
TypeScript hataları çıkarsa birer birer düzelt. Yaygın hatalar:
- `useAssessments`/`useResources` hook parametreleri
- `Library` component prop adları tutarsızlığı
- `onDownloadPDF` eksik prop (AssessmentView içinde kendi handle ediyor — prop olarak iletilmeyecek)

- [ ] **Step 5: Dev server'ı başlat ve manuel test**

```bash
npm run dev
```

Kontrol listesi:
- [ ] Login sayfası açılıyor
- [ ] Google ile giriş çalışıyor
- [ ] Assessment oluşturma çalışıyor (generate tıkla)
- [ ] Questions / Answer Key / Mark Scheme tabları çalışıyor
- [ ] Library açılıyor, assessment listesi yükleniyor
- [ ] Assessment kaydet çalışıyor
- [ ] PDF indir çalışıyor

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: rewrite App.tsx to ~120 lines using hooks and components"
```

---

## Chunk 5: Faz 5 — UX Düzeltmeleri

---

### Task 22: `gemini.ts` — `generateTest()` içine `withRetry` entegrasyonu doğrula

Bu task, Task 8'de eklenen `withRetry`'ın Faz 3 değişiklikleriyle hâlâ doğru çalıştığını doğrular.

- [ ] **Step 1: `generateTest` içinde `withRetry` kullanımını kontrol et**

`src/lib/gemini.ts`'i oku. `ai.models.generateContent` çağrısının `withRetry(() => ...)` içinde olduğunu doğrula.

- [ ] **Step 2: `onRetry` callback'ini `generateTest` parametresine ekle**

Eğer Task 8'de `onRetry` callback'i `generateTest`'e eklenmemişse şimdi ekle:

```typescript
export async function generateTest(
  config: GenerationConfig & { references?: {data: string; mimeType: string}[] },
  onRetry?: (attempt: number) => void
): Promise<QuestionItem[]>
```

`withRetry` çağrısına `onRetry`'ı ilet.

- [ ] **Step 3: `useGeneration.ts`'de `generate()` çağrısını güncelle**

`hooks/useGeneration.ts`'deki `generateTest` çağrısının `onRetry` callback'i ilettiğinden emin ol:
```typescript
const questions = await generateTest(
  { ...config, syllabusContext: config.syllabusContext, references },
  (attempt) => { setRetryCount(attempt); notify(`Rate limit, retrying (${attempt}/3)...`, 'info') }
)
```

- [ ] **Step 4: lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit (gerekiyorsa)**

```bash
git add src/lib/gemini.ts src/hooks/useGeneration.ts
git commit -m "fix: ensure withRetry onRetry callback wired through to useGeneration"
```

---

### Task 23: `App.tsx`'teki clipboard kullanımlarını `copyToClipboard` ile değiştir

Bu task, App.tsx yeniden yazıldıktan sonra kalan eski `navigator.clipboard` kullanımlarını doğrular.

- [ ] **Step 1: Eski clipboard kullanımını ara**

```bash
grep -n "navigator.clipboard" src/App.tsx
grep -n "navigator.clipboard" src/components/AssessmentView/index.tsx
```

Beklenen: Hiçbir sonuç çıkmamalı (Task 21'deki yeni App.tsx zaten `copyToClipboard` kullanıyor).

Eğer bulunursa değiştir:
```typescript
// Eski:
await navigator.clipboard.writeText(text)
// Yeni:
import { copyToClipboard } from '../lib/clipboard'
await copyToClipboard(text)
```

- [ ] **Step 2: lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit (değişiklik varsa)**

```bash
git add src/App.tsx src/components/AssessmentView/index.tsx
git commit -m "fix: replace navigator.clipboard with cross-browser copyToClipboard utility"
```

---

### Task 24: Tüm testleri çalıştır ve tamamla

- [ ] **Step 1: Tüm testleri çalıştır**

```bash
npm run test
```
Beklenen: `pricing.test.ts`, `clipboard.test.ts`, `svg.test.ts` — hepsi PASS.

- [ ] **Step 2: TypeScript full lint**

```bash
npm run lint
```
Beklenen: Hata yok.

- [ ] **Step 3: Production build**

```bash
npm run build
```
Beklenen: Build başarılı, `dist/` oluşur.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify all tests pass and production build succeeds"
```

---

### Task 25: Başarı kriterleri doğrulaması

- [ ] **Step 1: Manuel smoke test**

`npm run dev` ile uygulamayı başlat. Şu akışları test et:

1. Login → Assessment oluştur → Library'ye kaydet
2. Library'den bir assessment aç → düzenle → kaydet
3. PDF indir → dosya açılıyor ve renkleri doğru
4. Resource yükle → Knowledge Base'e ekle → assessment oluştur (kaynak dahil)
5. Student mode → cevap gir → feedback al
6. **Analyze File akışı:** Sidebar'da bir PNG/PDF yükle → "Analyze" → questions tab'ında sorular ve `analysisText` banner görünüyor
7. HTTP ortamında clipboard (localhost değil): `npm run preview` ile test et

- [ ] **Step 2: Başarı kriteri kontrol listesi**

- [ ] `.env` git geçmişinde yok — `git log --all -- .env` boş döndürüyor
- [ ] `motion` paketi `package.json`'da yok
- [ ] Resource yükleme Firebase Storage'a gidiyor (Firebase Console'da Storage bucket kontrolü)
- [ ] `storage.rules` deploy edilmiş
- [ ] Gemini 429 hatası simüle edilirse retry + notify çalışıyor
- [ ] `App.tsx` satır sayısı 150'den az: `wc -l src/App.tsx`
- [ ] Yeni formatla assessment kaydetme çalışıyor
- [ ] Eski Firestore kayıtlar UI'da gözükmiyor
- [ ] SVG'ler `parseSVGSafe` ile render ediliyor (AssessmentView component'inde)
- [ ] Clipboard HTTP'de çalışıyor (execCommand fallback)
- [ ] PDF export oklch renk sorunsuz

- [ ] **Step 3: Final tag**

```bash
git tag v2.0.0-improvements
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-16-igcse-tools-improvements.md`. Ready to execute?**
