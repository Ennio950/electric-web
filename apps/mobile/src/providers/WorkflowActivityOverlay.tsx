import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { buildWorkflowViewerUrl, getWorkflowViewerUrl } from '@/src/config/mobileEnv';

type WorkflowChangeEvent = {
  eventId: string;
  agent: string;
  taskId: string;
  files: string[];
  lastFile: string | null;
  timestamp: string;
  status: string;
};

const refreshIntervalMs = 4_000;

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function getAgentAccent(agent: string) {
  return agent === 'claude' ? '#00c2ff' : '#ff7a18';
}

async function fetchLatestEvent() {
  const response = await fetch(buildWorkflowViewerUrl('/api/change-events', { limit: 1 }), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Workflow viewer unavailable (${response.status}).`);
  }

  const payload = (await response.json()) as { events?: WorkflowChangeEvent[] };
  return payload.events?.[0] ?? null;
}

export function WorkflowActivityOverlay() {
  const viewerBaseUrl = getWorkflowViewerUrl();
  const [event, setEvent] = useState<WorkflowChangeEvent | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }

    let mounted = true;

    const refresh = async () => {
      try {
        const latestEvent = await fetchLatestEvent();
        if (mounted) {
          setEvent(latestEvent);
        }
      } catch {
        if (mounted) {
          setEvent((current) => current);
        }
      }
    };

    refresh().catch(() => undefined);
    const timer = setInterval(() => {
      refresh().catch(() => undefined);
    }, refreshIntervalMs);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [viewerBaseUrl]);

  if (process.env.NODE_ENV === 'production' || !event) {
    return null;
  }

  const accent = getAgentAccent(event.agent);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Pressable
        accessibilityLabel="Mostrar u ocultar actividad del workflow"
        onPress={() => {
          setCollapsed((current) => !current);
        }}
        style={[styles.card, { borderColor: accent }]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.agentPill, { backgroundColor: accent }]}>
            <Text style={styles.agentPillText}>{event.agent.toUpperCase()}</Text>
          </View>
          <Text style={styles.headerText}>{collapsed ? 'Workflow' : event.taskId}</Text>
        </View>

        {!collapsed ? (
          <View style={styles.details}>
            <Text style={styles.line}>Archivo: {event.lastFile ?? event.files[0] ?? 'sin cambios de archivo'}</Text>
            <Text style={styles.line}>Hora: {formatTime(event.timestamp)}</Text>
            <Text style={styles.line}>Estado: {event.status}</Text>
            <Text style={styles.meta}>
              Fuente: {viewerBaseUrl.replace(/^https?:\/\//, '')}
              {Platform.OS === 'web' ? ' via web preview' : ' via dev preview'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 18,
    right: 14,
    zIndex: 999,
  },
  card: {
    width: 300,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 18, 24, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  agentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  agentPillText: {
    color: '#061015',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  details: {
    marginTop: 10,
    gap: 4,
  },
  line: {
    color: '#d6deeb',
    fontSize: 11,
    lineHeight: 15,
  },
  meta: {
    color: '#8ea0b8',
    fontSize: 10,
    marginTop: 4,
  },
});
