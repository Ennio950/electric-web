import type { ConfigContext, ExpoConfig } from 'expo/config';

type ExpoExtra = {
  eas?: {
    projectId?: string;
  };
  mobile?: {
    releaseStage?: string;
  };
};

type ReleaseStage = 'development' | 'preview' | 'production';

function cleanOptionalEnv(value: string | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function resolveProjectId(extra: ExpoExtra | undefined) {
  return (
    cleanOptionalEnv(process.env.EXPO_PUBLIC_EAS_PROJECT_ID) ??
    cleanOptionalEnv(process.env.EAS_PROJECT_ID) ??
    cleanOptionalEnv(extra?.eas?.projectId)
  );
}

function resolveReleaseStage(extra: ExpoExtra | undefined): ReleaseStage {
  const explicitStage =
    cleanOptionalEnv(process.env.EXPO_PUBLIC_APP_ENV) ??
    cleanOptionalEnv(process.env.EAS_BUILD_PROFILE) ??
    cleanOptionalEnv(extra?.mobile?.releaseStage);

  if (explicitStage === 'preview' || explicitStage === 'production') {
    return explicitStage;
  }

  return 'development';
}

function assertRequiredReleaseEnv(releaseStage: ReleaseStage) {
  if (releaseStage === 'development') {
    return;
  }

  const apiBaseUrl = cleanOptionalEnv(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (apiBaseUrl) {
    return;
  }

  // Only throw on actual EAS cloud builds — locally just warn so CLI doesn't block
  if (process.env.EAS_BUILD === 'true') {
    throw new Error(
      `[app.config] EXPO_PUBLIC_API_BASE_URL es obligatoria para builds ${releaseStage}.`,
    );
  }

  console.warn(
    `[app.config] EXPO_PUBLIC_API_BASE_URL no configurada para build ${releaseStage}. Configúrala en EAS antes de hacer build.`,
  );
}

export default function configureApp({ config }: ConfigContext): ExpoConfig {
  const resolvedConfig = config as ExpoConfig;
  const extra = (resolvedConfig.extra as ExpoExtra | undefined) ?? {};
  const releaseStage = resolveReleaseStage(extra);
  assertRequiredReleaseEnv(releaseStage);
  const projectId = resolveProjectId(extra);

  // EAS Update URL — only active when projectId is known (preview + production).
  const updatesUrl = projectId ? `https://u.expo.dev/${projectId}` : undefined;

  return {
    ...resolvedConfig,
    ...(updatesUrl
      ? {
          updates: {
            url: updatesUrl,
            enabled: true,
            fallbackToCacheTimeout: 0,
          },
        }
      : {}),
    extra: {
      ...extra,
      mobile: {
        ...extra.mobile,
        releaseStage,
      },
      eas: {
        ...extra.eas,
        ...(projectId ? { projectId } : {}),
      },
    },
  };
}
