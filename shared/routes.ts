import { z } from 'zod';
import { 
  insertUserSchema, 
  insertTournamentSchema,
  insertMatchSchema,
  insertMatchNoteSchema,
  users,
  tournaments,
  matches,
  players,
  groups,
  matchNotes
} from './schema';

export type InsertUser = z.infer<typeof insertUserSchema>;

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  auth: {
    signup: {
      method: 'POST' as const,
      path: '/api/auth/signup' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
        rememberMe: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  tournaments: {
    list: {
      method: 'GET' as const,
      path: '/api/tournaments' as const,
      responses: {
        200: z.array(z.custom<typeof tournaments.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tournaments/:id' as const,
      responses: {
        200: z.object({
          tournament: z.custom<typeof tournaments.$inferSelect>(),
          players: z.array(z.custom<typeof players.$inferSelect>()),
          groups: z.array(z.custom<typeof groups.$inferSelect>()),
          matches: z.array(z.custom<typeof matches.$inferSelect>()),
          groupMemberships: z.array(z.object({
            id: z.number(),
            groupId: z.number(),
            playerId: z.number(),
          })).optional().default([]),
        }),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tournaments' as const,
      input: z.object({
        name: z.string(),
        type: z.string(),
        playerNames: z.array(z.string()),
        randomize: z.boolean(),
        settings: z.any(),
        leagueId: z.number().nullable().optional(),
        isLegacy: z.boolean().optional(),
      }),
      responses: {
        201: z.custom<typeof tournaments.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    bulkPlayers: {
      method: 'POST' as const,
      path: '/api/tournaments/:id/players/bulk' as const,
      input: z.object({
        players: z.array(z.object({
          name: z.string(),
          seed: z.number().optional(),
        })),
        replace: z.boolean().default(false),
      }),
      responses: {
        200: z.array(z.custom<typeof players.$inferSelect>()),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tournaments/:id' as const,
      input: insertTournamentSchema.partial(),
      responses: {
        200: z.custom<typeof tournaments.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tournaments/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    share: {
      enable: {
        method: 'POST' as const,
        path: '/api/tournaments/:id/share/enable' as const,
        responses: {
          200: z.custom<typeof tournaments.$inferSelect>(),
          401: errorSchemas.unauthorized,
        },
      },
      disable: {
        method: 'POST' as const,
        path: '/api/tournaments/:id/share/disable' as const,
        responses: {
          200: z.custom<typeof tournaments.$inferSelect>(),
          401: errorSchemas.unauthorized,
        },
      },
      regenerate: {
        method: 'POST' as const,
        path: '/api/tournaments/:id/share/regenerate' as const,
        responses: {
          200: z.custom<typeof tournaments.$inferSelect>(),
          401: errorSchemas.unauthorized,
        },
      },
    },
    export: {
      csv: {
        method: 'GET' as const,
        path: '/api/tournaments/:id/export.csv' as const,
        responses: {
          200: z.any(), // File download
          401: errorSchemas.unauthorized,
        },
      }
    }
  },
  matches: {
    update: {
      method: 'PUT' as const,
      path: '/api/matches/:id' as const,
      input: z.object({
        scoreA: z.number(),
        scoreB: z.number(),
        notes: z.object({
          highestCheckout: z.number().optional(),
          numberOf180s: z.number().optional(),
          customNote: z.string().optional(),
        }).optional(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  public: {
    get: {
      method: 'GET' as const,
      path: '/api/public/t/:shareToken' as const,
      responses: {
        200: z.object({
          tournament: z.custom<typeof tournaments.$inferSelect>(),
          players: z.array(z.custom<typeof players.$inferSelect>()),
          groups: z.array(z.custom<typeof groups.$inferSelect>()),
          matches: z.array(z.custom<typeof matches.$inferSelect>()),
        }),
        404: errorSchemas.notFound,
      },
    }
  },
  account: {
    updateProfile: {
      method: 'PUT' as const,
      path: '/api/account/profile' as const,
      input: z.object({
        name: z.string().optional(),
        dateOfBirth: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        billingAddress: z.string().nullable().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    updateEmail: {
      method: 'PUT' as const,
      path: '/api/account/email' as const,
      input: z.object({ email: z.string(), currentPassword: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    updatePassword: {
      method: 'PUT' as const,
      path: '/api/account/password' as const,
      input: z.object({ currentPassword: z.string(), newPassword: z.string() }),
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    setMemorableWord: {
      method: 'PUT' as const,
      path: '/api/account/memorable-word' as const,
      input: z.object({ memorableWord: z.string(), currentPassword: z.string() }),
      responses: {
        200: z.void(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    regenerateRecoveryKey: {
      method: 'POST' as const,
      path: '/api/account/recovery-key' as const,
      input: z.object({ currentPassword: z.string() }),
      responses: {
        200: z.object({ recoveryKey: z.string() }),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/account' as const,
      input: z.object({ password: z.string(), confirmationPhrase: z.literal("DELETE") }),
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
