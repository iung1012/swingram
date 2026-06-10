type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple" | "microsoft" | "lovable", _opts?: SignInOptions) => {
      return {
        error: new Error("Login social indisponível neste backend."),
      };
    },
  },
};

