import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(part.slice(2), 'true');
      continue;
    }

    args.set(part.slice(2), next);
    index += 1;
  }

  return args;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const playwrightPath = path.join(globalRoot, 'playwright', 'index.mjs');
    return import(pathToFileURL(playwrightPath).href);
  }
}

function createTimestamp() {
  return new Date().toISOString().replaceAll(':', '-');
}

function createAuthState() {
  return {
    state: {
      token: 'demo-token',
      user: {
        id: 'u1',
        tg_id: 123456789,
        username: 'Alex',
        language_code: 'ru',
      },
    },
    version: 0,
  };
}

function createWorkoutState() {
  return {
    state: {
      workoutId: 'w-local',
      status: 'active',
      startedAt: Date.now() - 35 * 60 * 1000,
      restStartedAt: null,
      restDurationSeconds: null,
      exercises: [
        {
          localId: 'ex-1',
          exerciseId: 'bench',
          workoutExerciseId: 'we-1',
          name: 'Жим лёжа',
          targetMuscleGroup: 'Грудь',
          order: 1,
          syncStatus: 'synced',
          lastError: null,
          sets: [
            {
              localId: 'set-1',
              setId: 's1',
              reps: '8',
              weight: '80',
              syncStatus: 'synced',
              lastError: null,
              lastSyncedReps: '8',
              lastSyncedWeight: '80',
            },
            {
              localId: 'set-2',
              setId: 's2',
              reps: '6',
              weight: '85',
              syncStatus: 'failed',
              lastError: 'Ошибка синхронизации. Повторим попытку автоматически.',
              lastSyncedReps: '6',
              lastSyncedWeight: '85',
            },
          ],
        },
        {
          localId: 'ex-2',
          exerciseId: 'row',
          workoutExerciseId: 'we-2',
          name: 'Тяга штанги в наклоне с очень длинным названием упражнения',
          targetMuscleGroup: 'Спина',
          order: 2,
          syncStatus: 'synced',
          lastError: null,
          sets: [
            {
              localId: 'set-3',
              setId: 's3',
              reps: '10',
              weight: '60',
              syncStatus: 'synced',
              lastError: null,
              lastSyncedReps: '10',
              lastSyncedWeight: '60',
            },
          ],
        },
      ],
      unsyncedChanges: [],
    },
    version: 0,
  };
}

function createEmptyWorkoutState() {
  return {
    state: {
      workoutId: null,
      status: 'draft',
      startedAt: null,
      restStartedAt: null,
      restDurationSeconds: null,
      exercises: [],
      unsyncedChanges: [],
    },
    version: 0,
  };
}

function createSettingsState() {
  return {
    state: {
      restTimerEnabled: true,
      restDuration: 90,
    },
    version: 0,
  };
}

function createHistory() {
  return [
    {
      id: 'h1',
      user_id: 'u1',
      name: null,
      status: 'completed',
      start_time: '2026-04-15T09:00:00Z',
      end_time: '2026-04-15T10:05:00Z',
      notes: null,
      created_at: '2026-04-15T10:05:00Z',
      updated_at: '2026-04-15T10:05:00Z',
      workout_exercises: [
        {
          id: 'w1',
          workout_id: 'h1',
          exercise_id: 'e1',
          order: 1,
          exercise: {
            id: 'e1',
            name: 'Жим лёжа',
            target_muscle_group: 'Грудь',
            user_id: null,
            visibility: 'system',
            created_at: '2026-04-01T10:00:00Z',
          },
          sets: [
            {
              id: 'a',
              workout_exercise_id: 'w1',
              reps: 8,
              weight: 80,
              duration_seconds: null,
              rest_time_after_seconds: null,
              created_at: '2026-04-15T09:05:00Z',
            },
          ],
        },
      ],
    },
  ];
}

function createExercises() {
  return [
    {
      id: 'e1',
      name: 'Жим лёжа',
      target_muscle_group: 'Грудь',
      user_id: null,
      visibility: 'system',
      created_at: '2026-04-01T10:00:00Z',
    },
    {
      id: 'e2',
      name: 'Тяга вертикального блока',
      target_muscle_group: 'Спина',
      user_id: null,
      visibility: 'system',
      created_at: '2026-04-01T10:00:00Z',
    },
    {
      id: 'e3',
      name: 'Подъём на бицепс',
      target_muscle_group: 'Руки',
      user_id: 'u1',
      visibility: 'private',
      created_at: '2026-04-01T10:00:00Z',
    },
  ];
}

async function addAppState(page, options = {}) {
  const { workoutState = createEmptyWorkoutState() } = options;
  await page.addInitScript(
    ([authState, workoutState, settingsState]) => {
      localStorage.setItem('auth-storage', JSON.stringify(authState));
      localStorage.setItem('active-workout-session', JSON.stringify(workoutState));
      localStorage.setItem('workout-settings', JSON.stringify(settingsState));
    },
    [createAuthState(), workoutState, createSettingsState()],
  );
}

async function registerApiMocks(page, authError = false) {
  const history = createHistory();
  const exercises = createExercises();

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (authError && url.includes('/auth/telegram-auth') && method === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Mock auth error' }),
      });
      return;
    }

    if (url.includes('/auth/telegram-auth') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'demo-token',
          user: createAuthState().state.user,
        }),
      });
      return;
    }

    if (url.endsWith('/workouts/') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(history),
      });
      return;
    }

    if (url.includes('/workouts/h1') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(history[0]),
      });
      return;
    }

    if (url.includes('/exercises/similar') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matches: [
            {
              id: 'e1',
              name: 'Жим лёжа',
              target_muscle_group: 'Грудь',
              visibility: 'system',
              similarity: 0.91,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/exercises/') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(exercises),
      });
      return;
    }

    if (url.includes('/exercises/seed') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inserted: 0, message: 'ok' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

async function openWithState(page, url, options = {}) {
  const {
    authError = false,
    workoutState = createEmptyWorkoutState(),
    expectedPathname,
  } = options;
  await registerApiMocks(page, authError);
  if (!authError) {
    await addAppState(page, { workoutState });
  }

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  if (expectedPathname) {
    const currentPathname = new URL(page.url()).pathname;
    if (currentPathname !== expectedPathname) {
      throw new Error(
        `Expected route ${expectedPathname} but landed on ${currentPathname} while opening ${url}`,
      );
    }
  }
}

async function writeReport(reportPath, screenshotDir) {
  const relativeScreenshotDir = path.relative(process.cwd(), screenshotDir);
  const reportLines = [
    '# UX/UI Audit Report',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Screenshot directory: \`${relativeScreenshotDir}\``,
    '',
    '## Findings',
    '',
    'Add findings in this format:',
    '- Severity: `critical` | `major` | `minor`',
    '- Type: `code` | `visual`',
    '- Location: file path / route / screenshot scenario',
    '- Problem / Impact / Fix',
    '',
    '## Screenshot Scenarios',
    '',
    '- `dashboard-desktop.png`',
    '- `workout-mobile.png`',
    '- `workout-manage-mobile.png`',
    '- `settings-mobile.png`',
    '- `history-desktop.png`',
    '- `auth-error-desktop.png`',
    '',
    '## Open Questions',
    '',
    'Add only unresolved product ambiguities.',
    '',
    '## Suggested Next Changes',
    '',
    '- Fix dialog/accessibility issues first.',
    '- Fix action hierarchy and recovery states second.',
    '- Apply polish after usability blockers are resolved.',
    '',
  ];

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, reportLines.join('\n'), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.get('base-url') ?? 'http://127.0.0.1:5173';
  const stamp = createTimestamp();
  const outputDir = path.resolve(
    process.cwd(),
    args.get('output-dir') ?? path.join('..', 'artifacts', 'ux-audit', stamp),
  );
  const reportPath = path.resolve(
    process.cwd(),
    args.get('report') ?? path.join('..', 'docs', 'ux-audit', 'reports', `${stamp}.md`),
  );

  const { chromium, devices } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    await fs.mkdir(outputDir, { recursive: true });

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await openWithState(desktop, `${baseUrl}/`, {
      workoutState: createEmptyWorkoutState(),
      expectedPathname: '/',
    });
    await desktop.screenshot({
      path: path.join(outputDir, 'dashboard-desktop.png'),
      fullPage: true,
    });
    await openWithState(desktop, `${baseUrl}/history/h1`, {
      workoutState: createEmptyWorkoutState(),
      expectedPathname: '/history/h1',
    });
    await desktop.screenshot({
      path: path.join(outputDir, 'history-desktop.png'),
      fullPage: true,
    });
    await desktop.close();

    const mobile = await browser.newPage({ ...devices['iPhone 13'] });
    await openWithState(mobile, `${baseUrl}/workout`, {
      workoutState: createWorkoutState(),
      expectedPathname: '/workout',
    });
    await mobile.screenshot({
      path: path.join(outputDir, 'workout-mobile.png'),
      fullPage: true,
    });
    await mobile.getByRole('button', { name: /Управлять упражнениями/i }).click();
    await mobile.waitForTimeout(300);
    await mobile.screenshot({
      path: path.join(outputDir, 'workout-manage-mobile.png'),
      fullPage: true,
    });
    await openWithState(mobile, `${baseUrl}/settings`, {
      workoutState: createEmptyWorkoutState(),
      expectedPathname: '/settings',
    });
    await mobile.screenshot({
      path: path.join(outputDir, 'settings-mobile.png'),
      fullPage: true,
    });
    await mobile.close();

    const authPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openWithState(authPage, `${baseUrl}/`, {
      authError: true,
      expectedPathname: '/',
    });
    await authPage.screenshot({
      path: path.join(outputDir, 'auth-error-desktop.png'),
      fullPage: true,
    });
    await authPage.close();

    await writeReport(reportPath, outputDir);

    console.log(`Screenshots saved to ${outputDir}`);
    console.log(`Report stub saved to ${reportPath}`);
  } finally {
    await browser.close();
  }
}

await main();
