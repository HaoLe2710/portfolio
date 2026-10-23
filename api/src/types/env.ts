export type WorkerBindings = {
  DB: D1Database;
  CORS_ALLOWED_ORIGINS?: string;
};

export type WorkerEnv = {
  Bindings: WorkerBindings;
  Variables: {
    admin: {
      id: string;
      email: string;
      role: "OWNER" | "ADMIN";
    };
  };
};
