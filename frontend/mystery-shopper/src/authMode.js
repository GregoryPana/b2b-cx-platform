export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || "entra").trim().toLowerCase();

export const isMysteryPublicAuthMode = AUTH_MODE === "mystery_public";
