export const apiAdmin = {
  storage: {
    listBuckets: async () => ({ data: [] as Array<{ name: string; public: boolean }>, error: null }),
    createBucket: async () => ({ error: null }),
  },
};
